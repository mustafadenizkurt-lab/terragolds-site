import { getMarketplaceCredential } from "../marketplace-credentials";

export type N11Credentials = {
  appKey: string;
  appSecret: string;
  // Ürün gönderiminde her sku'ya gömülmesi gereken hesap-genelinde sabitler
  // (N11'in resmi entegrasyon dokümanındaki product-create/update şeması
  // zorunlu kılıyor) - N11 Ortak Girişi başvurusunda onaylanan entegratör
  // adı, Satıcı Paneli'nde tanımlı kargo şablonu adı, ve gün cinsinden
  // hazırlanma süresi. Ürün bazlı değil, tek bir hesap için sabit
  // değerler olduğundan admin panelindeki kimlik bilgisi formunda
  // appKey/appSecret ile birlikte giriliyor.
  integrator: string;
  shipmentTemplate: string;
  preparingDay: number;
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
  const preparingDay = Number(stored.preparingDay);
  return {
    appKey: stored.appKey,
    appSecret: stored.appSecret,
    integrator: stored.integrator,
    shipmentTemplate: stored.shipmentTemplate,
    preparingDay: Number.isFinite(preparingDay) && preparingDay > 0 ? preparingDay : 3,
  };
}

export { buildN11Headers } from "./http-utils";
