import { getOptionalEnv, getRequiredEnv } from "../runtime-env";
import { getMarketplaceCredential } from "../marketplace-credentials";

export type TrendyolCredentials = {
  supplierId: string;
  apiKey: string;
  apiSecret: string;
};

export type TrendyolEnvironment = "prod" | "stage";

// PROD ve STAGE (Trendyol'un sandbox ortamı) için kimlik bilgileri farklı
// olabiliyor - TRENDYOL_ENVIRONMENT env değişkeni hangisinin kullanılacağını
// seçiyor, varsayılan "prod".
export function getTrendyolEnvironment(): TrendyolEnvironment {
  return getOptionalEnv("TRENDYOL_ENVIRONMENT", "prod").toLowerCase() === "stage"
    ? "stage"
    : "prod";
}

// Öncelik admin panelinden (Ayarlar > Trendyol) girilip D1'de şifreli
// saklanan kimlik bilgilerinde - satıcı, wrangler CLI kullanmadan doğrudan
// admin panelinden anahtarlarını girip kaydedebiliyor (bu, PROD/STAGE
// ayrımından bağımsız, tek bir aktif kayıt). D1'de kayıtlı ve
// etkinleştirilmiş bir şey yoksa (ör. CLI ile Worker secret olarak elle
// eklemeyi tercih edenler için) TRENDYOL_ENVIRONMENT'e göre seçilen
// _PROD/_STAGE son ekli ortam değişkenlerine düşer.
export async function getTrendyolCredentials(): Promise<TrendyolCredentials> {
  const stored = await getMarketplaceCredential("trendyol");
  if (stored) {
    return {
      supplierId: stored.supplierId,
      apiKey: stored.apiKey,
      apiSecret: stored.apiSecret,
    };
  }
  if (getTrendyolEnvironment() === "stage") {
    return {
      supplierId: getRequiredEnv("TRENDYOL_SUPPLIER_ID_STAGE"),
      apiKey: getRequiredEnv("TRENDYOL_API_KEY_STAGE"),
      apiSecret: getRequiredEnv("TRENDYOL_API_SECRET_STAGE"),
    };
  }
  return {
    supplierId: getRequiredEnv("TRENDYOL_SUPPLIER_ID_PROD"),
    apiKey: getRequiredEnv("TRENDYOL_API_KEY_PROD"),
    apiSecret: getRequiredEnv("TRENDYOL_API_SECRET_PROD"),
  };
}

export { buildTrendyolAuthHeader, buildTrendyolUserAgent } from "./http-utils";
