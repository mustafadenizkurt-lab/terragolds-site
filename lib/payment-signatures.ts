const encoder = new TextEncoder();

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function hmacSha256(
  data: string,
  secret: string,
  format: "base64" | "hex",
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(data)),
  );
  if (format === "base64") return bytesToBase64(signature);
  return [...signature]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function constantTimeEquals(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function utf8ToBase64(value: string) {
  return bytesToBase64(encoder.encode(value));
}
