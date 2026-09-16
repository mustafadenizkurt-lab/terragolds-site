import { getRequiredEnv } from "../runtime-env";

export type TrendyolCredentials = {
  supplierId: string;
  apiKey: string;
  apiSecret: string;
};

// Reads the three Trendyol Marketplace credentials from Worker secrets.
// None of these exist yet (onboarding/approval is still pending) - every
// caller throws a clear "ortam değişkeni ayarlanmamış" error via
// getRequiredEnv until TRENDYOL_SUPPLIER_ID/API_KEY/API_SECRET are added as
// real `wrangler secret put` values, mirroring how Shopify's
// SHOPIFY_CLIENT_ID/SECRET are read (see lib/shopify/auth.ts).
export function getTrendyolCredentials(): TrendyolCredentials {
  return {
    supplierId: getRequiredEnv("TRENDYOL_SUPPLIER_ID"),
    apiKey: getRequiredEnv("TRENDYOL_API_KEY"),
    apiSecret: getRequiredEnv("TRENDYOL_API_SECRET"),
  };
}

export { buildTrendyolAuthHeader, buildTrendyolUserAgent } from "./http-utils";
