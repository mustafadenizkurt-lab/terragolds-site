import { getOptionalEnv } from "../../../../lib/runtime-env";
import {
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";
import { sendTransactionalEmail } from "../../../../lib/transactional-email";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genericMessage =
  "Bu e-posta ile kayıtlı bir hesap varsa sıfırlama bağlantısı gönderildi.";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 190);
    const requestUrl = new URL(request.url);
    const localDev =
      getOptionalEnv("PASSWORD_RESET_DEV_MODE") === "true" &&
      ["localhost", "127.0.0.1"].includes(requestUrl.hostname);

    if (!emailPattern.test(email)) {
      return Response.json({ message: genericMessage });
    }

    const db = getD1();
    await db
      .prepare(
        "DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL",
      )
      .bind(new Date().toISOString())
      .run();

    const user = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: number }>();
    if (!user) return Response.json({ message: genericMessage });

    const recent = await db
      .prepare(
        `SELECT id FROM password_reset_tokens
         WHERE user_id = ? AND created_at >= datetime('now', '-60 seconds')
         LIMIT 1`,
      )
      .bind(user.id)
      .first<{ id: number }>();
    if (recent) return Response.json({ message: genericMessage });

    const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await db
      .prepare(
        `INSERT INTO password_reset_tokens
          (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
      )
      .bind(user.id, tokenHash, expiresAt)
      .run();

    const resetUrl = new URL("/reset-password", requestUrl.origin);
    resetUrl.searchParams.set("token", token);

    if (localDev) {
      return Response.json({
        message: genericMessage,
        devResetUrl: resetUrl.toString(),
      });
    }

    const safeUrl = escapeHtml(resetUrl.toString());
    try {
      await sendTransactionalEmail({
        to: email,
        subject: "Terragolds şifre sıfırlama bağlantınız",
        idempotencyKey: `password-reset-${tokenHash}`,
        html: `<div style="font-family:Arial,sans-serif;color:#122e27;line-height:1.6">
          <h1 style="font-family:Georgia,serif;font-weight:400">Şifrenizi yenileyin</h1>
          <p>Terragolds hesabınız için bir şifre sıfırlama isteği aldık.</p>
          <p><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;background:#123b31;color:#fff;text-decoration:none">Yeni şifre oluştur</a></p>
          <p>Bu bağlantı 30 dakika boyunca ve yalnızca bir kez kullanılabilir.</p>
          <p>Bu isteği siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.</p>
        </div>`,
        text: `Terragolds hesabınızın şifresini yenilemek için bağlantıyı açın: ${resetUrl.toString()}\n\nBağlantı 30 dakika boyunca ve yalnızca bir kez kullanılabilir.`,
      });
    } catch {
      await db
        .prepare("DELETE FROM password_reset_tokens WHERE token_hash = ?")
        .bind(tokenHash)
        .run();
      return Response.json(
        { error: "Sıfırlama e-postası şu anda gönderilemedi." },
        { status: 502 },
      );
    }

    return Response.json({ message: genericMessage });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Şifre sıfırlama isteği alınamadı.",
      },
      { status: 500 },
    );
  }
}
