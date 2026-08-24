import { getOptionalEnv, getRequiredEnv } from "./runtime-env";

export const SHOPIER_DEFAULT_PAYMENT_URL =
  "https://www.shopier.com/ShowProduct/api_pay4.php";

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function hmacSha256Base64(data: string, secret: string) {
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
    encoder.encode(data),
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyShopierCallbackSignature(input: {
  randomNr: string;
  orderId: string;
  signature: string;
}) {
  const secret = getRequiredEnv("SHOPIER_SECRET_KEY");
  const expected = await hmacSha256Base64(
    `${input.randomNr}${input.orderId}`,
    secret,
  );
  return constantTimeBase64Equals(expected, input.signature);
}

export async function createShopierPaymentSignature(input: {
  randomNr: string;
  orderId: string;
  totalValue: string;
  currency: string;
}) {
  return hmacSha256Base64(
    `${input.randomNr}${input.orderId}${input.totalValue}${input.currency}`,
    getRequiredEnv("SHOPIER_SECRET_KEY"),
  );
}

export function getShopierConfig() {
  const paymentUrl = new URL(
    getOptionalEnv("SHOPIER_PAYMENT_URL", SHOPIER_DEFAULT_PAYMENT_URL),
  );
  if (
    paymentUrl.protocol !== "https:" ||
    (paymentUrl.hostname !== "shopier.com" &&
      !paymentUrl.hostname.endsWith(".shopier.com"))
  ) {
    throw new Error("SHOPIER_PAYMENT_URL güvenilir bir Shopier adresi olmalıdır.");
  }
  return {
    apiKey: getRequiredEnv("SHOPIER_API_KEY"),
    paymentUrl: paymentUrl.toString(),
  };
}

export function constantTimeStringEquals(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

function constantTimeBase64Equals(left: string, right: string) {
  const leftBytes = base64ToBytes(left);
  const rightBytes = base64ToBytes(right);
  if (!leftBytes || !rightBytes) return false;

  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}
