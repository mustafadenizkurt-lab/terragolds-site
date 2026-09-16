import { getRequiredEnv } from "../runtime-env";

export type HepsiburadaCredentials = {
  merchantId: string;
  username: string;
  password: string;
};

// Reads the three Hepsiburada Marketplace credentials from Worker secrets.
// None of these exist yet (onboarding/approval is still pending) - every
// caller throws a clear "ortam değişkeni ayarlanmamış" error via
// getRequiredEnv until HEPSIBURADA_MERCHANT_ID/USERNAME/PASSWORD are added
// as real `wrangler secret put` values, mirroring lib/trendyol/auth.ts.
export function getHepsiburadaCredentials(): HepsiburadaCredentials {
  return {
    merchantId: getRequiredEnv("HEPSIBURADA_MERCHANT_ID"),
    username: getRequiredEnv("HEPSIBURADA_USERNAME"),
    password: getRequiredEnv("HEPSIBURADA_PASSWORD"),
  };
}

export { buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "./http-utils";
