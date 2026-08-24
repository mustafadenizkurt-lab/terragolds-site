import { getRequiredEnv } from "./runtime-env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ENCRYPTION_VERSION = 1;

type EncryptedPayload = {
  v: number;
  iv: string;
  data: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getEncryptionKey() {
  const secret = getRequiredEnv("PAYMENT_CONFIG_ENCRYPTION_KEY");
  if (secret.length < 32) {
    throw new Error(
      "PAYMENT_CONFIG_ENCRYPTION_KEY en az 32 karakter olmalıdır.",
    );
  }
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

function additionalData(provider: string) {
  return encoder.encode(`terragolds:payment:${provider}:v${ENCRYPTION_VERSION}`);
}

export async function encryptPaymentCredentials(
  provider: string,
  credentials: Record<string, string>,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: additionalData(provider),
      tagLength: 128,
    },
    await getEncryptionKey(),
    encoder.encode(JSON.stringify(credentials)),
  );

  return JSON.stringify({
    v: ENCRYPTION_VERSION,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  } satisfies EncryptedPayload);
}

export async function decryptPaymentCredentials(
  provider: string,
  encryptedValue: string,
) {
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encryptedValue) as EncryptedPayload;
  } catch {
    throw new Error("Ödeme sağlayıcısı bilgileri okunamadı.");
  }
  if (
    payload.v !== ENCRYPTION_VERSION ||
    !payload.iv ||
    !payload.data
  ) {
    throw new Error("Ödeme sağlayıcısı şifreleme sürümü desteklenmiyor.");
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(payload.iv),
        additionalData: additionalData(provider),
        tagLength: 128,
      },
      await getEncryptionKey(),
      base64ToBytes(payload.data),
    );
    return JSON.parse(decoder.decode(decrypted)) as Record<string, string>;
  } catch {
    throw new Error(
      "Ödeme sağlayıcısı bilgileri çözülemedi. Şifreleme anahtarını kontrol edin.",
    );
  }
}
