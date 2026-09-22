import { getMarketplaceCredential } from "../marketplace-credentials";

export type N11Credentials = {
  appKey: string;
  appSecret: string;
};

// Trendyol/Hepsiburada'daki gibi Worker secret (env değişkeni) yedeği yok -
// N11 kimlik bilgileri sadece admin panelinden (N11 senkronu sekmesi) D1'e
// şifreli kaydediliyor. Kayıtlı ve "Senkronu etkinleştir" işaretlenmiş bir
// kayıt yoksa net bir hata fırlatılır (getMarketplaceCredential zorunlu
// alanlardan biri boşsa da null döner - bkz. lib/marketplace-credentials.ts).
export async function getN11Credentials(): Promise<N11Credentials> {
  const stored = await getMarketplaceCredential("n11");
  if (!stored) {
    throw new Error(
      "N11 bağlantı bilgileri yapılandırılmamış - N11 senkronu sekmesinden appKey/appSecret girip etkinleştirin.",
    );
  }
  return { appKey: stored.appKey, appSecret: stored.appSecret };
}

export { buildN11Headers } from "./http-utils";
