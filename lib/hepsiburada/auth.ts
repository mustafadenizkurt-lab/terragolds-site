import { getRequiredEnv } from "../runtime-env";
import { getMarketplaceCredential } from "../marketplace-credentials";

export type HepsiburadaCredentials = {
  merchantId: string;
  secretKey: string;
  integratorName: string;
  // "test" ise Hepsiburada test (SIT) sunucularına gidilir, aksi halde canlı.
  environment?: string;
};

// Öncelik admin panelinden (Ayarlar > Hepsiburada) girilip D1'de şifreli
// saklanan kimlik bilgilerinde - satıcı, wrangler CLI kullanmadan doğrudan
// admin panelinden Merchant ID/Servis Anahtarı/Entegratör Adı'nı girip
// kaydedebiliyor. D1'de kayıtlı ve etkinleştirilmiş bir şey yoksa (ör. CLI
// ile Worker secret olarak elle eklemeyi tercih edenler için)
// HEPSIBURADA_MERCHANT_ID/SECRET_KEY/INTEGRATOR_NAME ortam değişkenlerine
// düşer.
export async function getHepsiburadaCredentials(): Promise<HepsiburadaCredentials> {
  const stored = await getMarketplaceCredential("hepsiburada");
  if (stored) {
    assertOwnIntegrator(stored.integratorName);
    return {
      merchantId: stored.merchantId,
      secretKey: stored.secretKey,
      integratorName: stored.integratorName,
      environment: stored.environment,
    };
  }
  const integratorName = getRequiredEnv("HEPSIBURADA_INTEGRATOR_NAME");
  assertOwnIntegrator(integratorName);
  return {
    merchantId: getRequiredEnv("HEPSIBURADA_MERCHANT_ID"),
    secretKey: getRequiredEnv("HEPSIBURADA_SECRET_KEY"),
    integratorName,
  };
}

import { assertOwnIntegrator } from "./http-utils";

export { buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "./http-utils";
