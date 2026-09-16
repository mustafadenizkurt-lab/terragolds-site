import { getRequiredEnv } from "../runtime-env";
import { getMarketplaceCredential } from "../marketplace-credentials";

export type TrendyolCredentials = {
  supplierId: string;
  apiKey: string;
  apiSecret: string;
};

// Öncelik admin panelinden (Ayarlar > Trendyol) girilip D1'de şifreli
// saklanan kimlik bilgilerinde - satıcı, wrangler CLI kullanmadan doğrudan
// admin panelinden anahtarlarını girip kaydedebiliyor. D1'de kayıtlı ve
// etkinleştirilmiş bir şey yoksa (ör. CLI ile Worker secret olarak elle
// eklemeyi tercih edenler için) TRENDYOL_SUPPLIER_ID/API_KEY/API_SECRET
// ortam değişkenlerine düşer.
export async function getTrendyolCredentials(): Promise<TrendyolCredentials> {
  const stored = await getMarketplaceCredential("trendyol");
  if (stored) {
    return {
      supplierId: stored.supplierId,
      apiKey: stored.apiKey,
      apiSecret: stored.apiSecret,
    };
  }
  return {
    supplierId: getRequiredEnv("TRENDYOL_SUPPLIER_ID"),
    apiKey: getRequiredEnv("TRENDYOL_API_KEY"),
    apiSecret: getRequiredEnv("TRENDYOL_API_SECRET"),
  };
}

export { buildTrendyolAuthHeader, buildTrendyolUserAgent } from "./http-utils";
