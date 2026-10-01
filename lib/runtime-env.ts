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
  // Cloudflare Workers'tan Hepsiburada'nın (kendisi de Cloudflare arkasında)
  // bazı uç noktalarına, özellikle sipariş (oms-external), atılan istekler
  // 520 ile dönüyor - bilinen bir Cloudflare Workers -> Cloudflare origin
  // çakışması, gerçekçi header eklemek tek başına çözmedi. İkisi de
  // tanımlıysa (bkz. hepsiburada-proxy/) istekler normal bir sunucu
  // IP'sinden atan bu vekil üzerinden gönderilir - bkz.
  // lib/hepsiburada/client.ts'teki hepsiburadaRawFetch.
  HEPSIBURADA_PROXY_URL?: string;
  HEPSIBURADA_PROXY_SECRET?: string;
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
