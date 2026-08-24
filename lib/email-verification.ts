import { getOptionalEnv, getRequiredEnv } from "./runtime-env";
import { getD1 } from "./store-db";
import { sendTransactionalEmail } from "./transactional-email";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const CHECKOUT_COOKIE = "tg_checkout_email_verified";
const VERIFICATION_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 60;

type VerificationKind = "account" | "checkout";

type VerificationRow = {
  id: number;
  user_id: number | null;
  email: string;
  token_hash: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(normalized + padding);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
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

function createToken() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function createCode() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return random.toString().padStart(6, "0");
}

function isLocalDevelopment(origin: string) {
  const hostname = new URL(origin).hostname;
  return (
    getOptionalEnv("EMAIL_VERIFICATION_DEV_MODE") === "true" &&
    ["localhost", "127.0.0.1"].includes(hostname)
  );
}

export async function createEmailVerification(input: {
  email: string;
  userId?: number;
  kind: VerificationKind;
  origin: string;
}) {
  const email = input.email.trim().toLowerCase().slice(0, 190);
  const db = getD1();
  await db
    .prepare(
      `DELETE FROM email_verification_tokens
       WHERE expires_at <= ? OR used_at IS NOT NULL`,
    )
    .bind(new Date().toISOString())
    .run();

  const recent = await db
    .prepare(
      `SELECT id FROM email_verification_tokens
       WHERE email = ? AND kind = ? AND used_at IS NULL
         AND created_at >= datetime('now', '-60 seconds')
       LIMIT 1`,
    )
    .bind(email, input.kind)
    .first<{ id: number }>();
  if (recent) {
    throw new Error(
      `Yeni kod istemeden önce ${RESEND_COOLDOWN_SECONDS} saniye bekleyin.`,
    );
  }

  const token = createToken();
  const code = createCode();
  const tokenHash = await sha256(token);
  const codeHash = await sha256(`${email}:${code}`);
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
  await db
    .prepare(
      `INSERT INTO email_verification_tokens
        (user_id, email, kind, token_hash, code_hash, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.userId ?? null,
      email,
      input.kind,
      tokenHash,
      codeHash,
      expiresAt,
    )
    .run();

  if (isLocalDevelopment(input.origin)) {
    return {
      sent: true,
      devCode: code,
      devVerifyUrl:
        input.kind === "account"
          ? `${input.origin}/verify-email?token=${encodeURIComponent(token)}`
          : undefined,
    };
  }

  const verifyUrl = `${input.origin}/verify-email?token=${encodeURIComponent(
    token,
  )}`;
  const accountVerification = input.kind === "account";
  const safeVerifyUrl = escapeHtml(verifyUrl);
  try {
    await sendTransactionalEmail({
      to: email,
      subject: accountVerification
        ? "Terragolds e-posta adresinizi doğrulayın"
        : "Terragolds ödeme doğrulama kodunuz",
      idempotencyKey: `email-verification-${tokenHash}`,
      html: `<div style="font-family:Arial,sans-serif;color:#122e27;line-height:1.6">
        <h1 style="font-family:Georgia,serif;font-weight:400">${
          accountVerification
            ? "E-posta adresinizi doğrulayın"
            : "Ödeme doğrulama kodunuz"
        }</h1>
        <p>${
          accountVerification
            ? "Terragolds hesabınızı kullanmaya devam etmek için e-posta adresinizi doğrulayın."
            : "Ödemeye devam etmek için aşağıdaki tek kullanımlık kodu kullanın."
        }</p>
        <p style="font-size:28px;letter-spacing:8px;font-weight:700">${code}</p>
        ${
          accountVerification
            ? `<p><a href="${safeVerifyUrl}" style="display:inline-block;padding:13px 20px;background:#123b31;color:#fff;text-decoration:none">E-postamı doğrula</a></p>`
            : ""
        }
        <p>Bu doğrulama 30 dakika boyunca ve yalnızca bir kez kullanılabilir.</p>
        <p>Bu isteği siz yapmadıysanız e-postayı dikkate almayabilirsiniz.</p>
      </div>`,
      text: accountVerification
        ? `Terragolds e-posta doğrulama kodunuz: ${code}\n\nDoğrulama bağlantısı: ${verifyUrl}\n\nBu doğrulama 30 dakika geçerlidir.`
        : `Terragolds ödeme doğrulama kodunuz: ${code}\n\nBu kod 30 dakika geçerlidir.`,
    });
  } catch (error) {
    await db
      .prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
    throw error;
  }

  return { sent: true };
}

export async function verifyAccountEmailToken(token: string) {
  const tokenHash = await sha256(token);
  const db = getD1();
  const row = await db
    .prepare(
      `SELECT id, user_id, email, token_hash, code_hash, attempts, expires_at
       FROM email_verification_tokens
       WHERE token_hash = ? AND kind = 'account' AND used_at IS NULL
       LIMIT 1`,
    )
    .bind(tokenHash)
    .first<VerificationRow>();
  if (!row || !row.user_id || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  }

  await db.batch([
    db
      .prepare(
        `UPDATE users
         SET email_verified_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND email = ?`,
      )
      .bind(row.user_id, row.email),
    db
      .prepare(
        `UPDATE email_verification_tokens
         SET used_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND kind = 'account' AND used_at IS NULL`,
      )
      .bind(row.user_id),
  ]);
  return { email: row.email };
}

export async function verifyCheckoutEmailCode(emailInput: string, code: string) {
  const email = emailInput.trim().toLowerCase().slice(0, 190);
  const db = getD1();
  const row = await db
    .prepare(
      `SELECT id, user_id, email, token_hash, code_hash, attempts, expires_at
       FROM email_verification_tokens
       WHERE email = ? AND kind = 'checkout' AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .bind(email)
    .first<VerificationRow>();

  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new Error("Doğrulama kodu geçersiz veya süresi dolmuş.");
  }
  if (row.attempts >= 5) {
    throw new Error("Çok fazla hatalı deneme yapıldı. Yeni kod isteyin.");
  }

  const submittedHash = await sha256(`${email}:${code.trim()}`);
  if (submittedHash !== row.code_hash) {
    await db
      .prepare(
        `UPDATE email_verification_tokens
         SET attempts = attempts + 1 WHERE id = ?`,
      )
      .bind(row.id)
      .run();
    throw new Error("Doğrulama kodu hatalı.");
  }

  await db
    .prepare(
      `UPDATE email_verification_tokens
       SET used_at = CURRENT_TIMESTAMP WHERE id = ?`,
    )
    .bind(row.id)
    .run();
  return email;
}

async function signCheckoutPayload(value: string) {
  const secret = getRequiredEnv("NEXT_AUTH_SECRET");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function setCheckoutEmailVerificationCookie(
  response: Response,
  email: string,
) {
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        email,
        expiresAt: Date.now() + VERIFICATION_TTL_MS,
      }),
    ),
  );
  const signature = await signCheckoutPayload(payload);
  const secure =
    getOptionalEnv("EMAIL_VERIFICATION_DEV_MODE") === "true" ? "" : "; Secure";
  response.headers.append(
    "set-cookie",
    `${CHECKOUT_COOKIE}=${encodeURIComponent(
      `${payload}.${signature}`,
    )}; Path=/; Max-Age=${Math.floor(
      VERIFICATION_TTL_MS / 1000,
    )}; HttpOnly${secure}; SameSite=Lax`,
  );
  response.headers.set("cache-control", "no-store");
  return response;
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export async function getVerifiedCheckoutEmail(request: Request) {
  const token = readCookie(request, CHECKOUT_COOKIE);
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await signCheckoutPayload(payload);
  if (expected !== signature) return null;
  const bytes = base64UrlToBytes(payload);
  if (!bytes) return null;
  try {
    const value = JSON.parse(decoder.decode(bytes)) as {
      email?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof value.email !== "string" ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now()
    ) {
      return null;
    }
    return value.email.toLowerCase();
  } catch {
    return null;
  }
}
