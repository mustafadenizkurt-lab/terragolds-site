import { getD1 } from "./store-db";
import { normalizeCustomerName } from "./customer-name";
import { getRequiredEnv } from "./runtime-env";

const SESSION_COOKIE = "tg_customer_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type CustomerSession = {
  userId: number;
  email: string;
  sessionVersion: number;
  expiresAt: number;
};

export type CustomerUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerifiedAt: string | null;
  createdAt: string;
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

async function sign(value: string) {
  const secret = getRequiredEnv("NEXT_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("NEXT_AUTH_SECRET en az 32 karakter olmalıdır.");
  }
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

async function verifySignature(value: string, signature: string) {
  const secret = getRequiredEnv("NEXT_AUTH_SECRET");
  if (secret.length < 32) return false;
  const signatureBytes = base64UrlToBytes(signature);
  if (!signatureBytes) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(value),
  );
}

export async function createCustomerSessionToken(input: {
  userId: number;
  email: string;
  sessionVersion: number;
}) {
  const payload: CustomerSession = {
    userId: input.userId,
    email: input.email,
    sessionVersion: input.sessionVersion,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function verifyCustomerSessionToken(token: string) {
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra) return null;
  if (!(await verifySignature(payloadPart, signaturePart))) return null;

  const payloadBytes = base64UrlToBytes(payloadPart);
  if (!payloadBytes) return null;
  try {
    const payload = JSON.parse(
      decoder.decode(payloadBytes),
    ) as CustomerSession;
    if (payload.sessionVersion === undefined) {
      payload.sessionVersion = 0;
    }
    if (
      !Number.isInteger(payload.userId) ||
      typeof payload.email !== "string" ||
      !Number.isInteger(payload.sessionVersion) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

export async function getCustomerFromRequest(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  try {
    const session = await verifyCustomerSessionToken(token);
    if (!session) return null;
    const user = await getD1()
      .prepare(
        `SELECT id, first_name, last_name, email, phone, session_version,
                email_verified_at, created_at
         FROM users WHERE id = ? AND email = ?`,
      )
      .bind(session.userId, session.email)
      .first<{
        id: number;
        first_name: string;
        last_name: string;
        email: string;
        phone: string;
        session_version: number;
        email_verified_at: string | null;
        created_at: string;
      }>();

    if (!user || user.session_version !== session.sessionVersion) return null;
    return {
      id: user.id,
      firstName: normalizeCustomerName(user.first_name),
      lastName: normalizeCustomerName(user.last_name),
      email: user.email,
      phone: user.phone,
      emailVerifiedAt: user.email_verified_at,
      createdAt: user.created_at,
    } satisfies CustomerUser;
  } catch {
    return null;
  }
}

export function setCustomerSessionCookie(response: Response, token: string) {
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
  );
  response.headers.set("cache-control", "no-store");
  return response;
}

export function clearCustomerSessionCookie(response: Response) {
  response.headers.append(
    "set-cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  );
  response.headers.set("cache-control", "no-store");
  return response;
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export function customerUnauthorizedResponse() {
  return Response.json(
    { error: "Bu sayfa için müşteri girişi gerekli." },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}
