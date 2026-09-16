import { getRequiredEnv } from "../runtime-env";

export type HepsiburadaCredentials = {
  merchantId: string;
  secretKey: string;
  integratorName: string;
};

// Reads the three Hepsiburada Marketplace credentials from Worker secrets.
// None of these exist yet (onboarding/approval is still pending) - every
// caller throws a clear "ortam değişkeni ayarlanmamış" error via
// getRequiredEnv until HEPSIBURADA_MERCHANT_ID/SECRET_KEY/INTEGRATOR_NAME
// are added as real `wrangler secret put` values.
export function getHepsiburadaCredentials(): HepsiburadaCredentials {
  return {
    merchantId: getRequiredEnv("HEPSIBURADA_MERCHANT_ID"),
    secretKey: getRequiredEnv("HEPSIBURADA_SECRET_KEY"),
    integratorName: getRequiredEnv("HEPSIBURADA_INTEGRATOR_NAME"),
  };
}

export { buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "./http-utils";
