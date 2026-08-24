import { hash } from "bcryptjs";
import {
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    if (token.length < 32 || token.length > 160) {
      return Response.json(
        { error: "Şifre sıfırlama bağlantısı geçersiz." },
        { status: 400 },
      );
    }
    if (password.length < 10 || password.length > 128) {
      return Response.json(
        { error: "Yeni şifre 10–128 karakter arasında olmalıdır." },
        { status: 400 },
      );
    }

    const db = getD1();
    const tokenHash = await sha256(token);
    const resetToken = await db
      .prepare(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
         LIMIT 1`,
      )
      .bind(tokenHash, new Date().toISOString())
      .first<{ id: number; user_id: number }>();
    if (!resetToken) {
      return Response.json(
        { error: "Bu bağlantının süresi dolmuş veya bağlantı daha önce kullanılmış." },
        { status: 400 },
      );
    }

    const passwordHash = await hash(password, 12);
    const usedMarker = `${new Date().toISOString()}-${crypto.randomUUID()}`;
    await db.batch([
      db
        .prepare(
          `UPDATE password_reset_tokens SET used_at = ?
           WHERE id = ? AND used_at IS NULL AND expires_at > ?`,
        )
        .bind(usedMarker, resetToken.id, new Date().toISOString()),
      db
        .prepare(
          `UPDATE users
           SET password_hash = ?, session_version = session_version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM password_reset_tokens
             WHERE id = ? AND used_at = ?
           )`,
        )
        .bind(passwordHash, resetToken.user_id, resetToken.id, usedMarker),
      db
        .prepare(
          `UPDATE password_reset_tokens SET used_at = COALESCE(used_at, ?)
           WHERE user_id = ? AND id <> ? AND used_at IS NULL`,
        )
        .bind(usedMarker, resetToken.user_id, resetToken.id),
    ]);

    const consumed = await db
      .prepare(
        "SELECT id FROM password_reset_tokens WHERE id = ? AND used_at = ?",
      )
      .bind(resetToken.id, usedMarker)
      .first<{ id: number }>();
    if (!consumed) {
      return Response.json(
        { error: "Bu bağlantı artık kullanılamıyor." },
        { status: 409 },
      );
    }

    return Response.json({
      message: "Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Şifre yenilenemedi.",
      },
      { status: 500 },
    );
  }
}
