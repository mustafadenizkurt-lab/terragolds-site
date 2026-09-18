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
  SHOPIFY_CLIENT_ID?: string;
  SHOPIFY_CLIENT_SECRET?: string;
  // Not set yet - Trendyol Marketplace onboarding is still pending approval.
  // Referenced now so lib/trendyol/auth.ts's shape is ready; every call that
  // needs them throws a clear "ortam değişkeni ayarlanmamış" error via
  // getRequiredEnv until they're added as real Worker secrets.
  //
  // PROD ve STAGE (Trendyol'un sandbox ortamı) kimlik bilgileri farklı
  // olabildiği için ayrı env değişkenleri olarak tutuluyor -
  // TRENDYOL_ENVIRONMENT ("prod" | "stage", varsayılan "prod") hangisinin
  // kullanılacağını seçiyor (bkz. lib/trendyol/auth.ts).
  TRENDYOL_ENVIRONMENT?: string;
  TRENDYOL_SUPPLIER_ID_PROD?: string;
  TRENDYOL_API_KEY_PROD?: string;
  TRENDYOL_API_SECRET_PROD?: string;
  TRENDYOL_SUPPLIER_ID_STAGE?: string;
  TRENDYOL_API_KEY_STAGE?: string;
  TRENDYOL_API_SECRET_STAGE?: string;
  // Aynı durum Hepsiburada için de geçerli - onay bekleniyor, henüz gerçek
  // değer yok. Hepsiburada'nın kendi destek ekibinden gelen bilgiye göre
  // (developers.hepsiburada.com "Entegratöre Servis Anahtarı Ekleme"
  // rehberi): Basic Auth kullanıcı adı = MerchantId (mağaza GUID'i), şifre
  // = Servis Anahtarı (Secret Key). Entegratör adı ayrı bir alan - sadece
  // User-Agent header'ında kullanılıyor, Basic Auth'a girmiyor.
  HEPSIBURADA_MERCHANT_ID?: string;
  HEPSIBURADA_SECRET_KEY?: string;
  HEPSIBURADA_INTEGRATOR_NAME?: string;
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
