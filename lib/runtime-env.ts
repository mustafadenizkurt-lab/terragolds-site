import { env } from "cloudflare:workers";

type RuntimeBindings = {
  SHOPIER_API_KEY?: string;
  SHOPIER_SECRET_KEY?: string;
  SHOPIER_PAYMENT_URL?: string;
  PAYMENT_CONFIG_ENCRYPTION_KEY?: string;
  NEXT_AUTH_SECRET?: string;
  ADMIN_EMAILS?: string;
  RESEND_API_KEY?: string;
  TRANSACTIONAL_EMAIL_FROM?: string;
  PASSWORD_RESET_FROM_EMAIL?: string;
  PASSWORD_RESET_DEV_MODE?: string;
  EMAIL_VERIFICATION_DEV_MODE?: string;
  GOOGLE_SITE_VERIFICATION?: string;
  ANTHROPIC_API_KEY?: string;
};

function runtimeBindings() {
  return env as unknown as RuntimeBindings;
}

export function getOptionalEnv(
  key: keyof RuntimeBindings,
  fallback = "",
) {
  const value = runtimeBindings()[key]?.trim();
  return value || fallback;
}

export function getRequiredEnv(key: keyof RuntimeBindings) {
  const value = getOptionalEnv(key);
  if (!value) {
    throw new Error(`${key} ortam değişkeni ayarlanmamış.`);
  }
  return value;
}
