// Kasıtlı olarak hiçbir şey import etmiyor (runtime-env/cloudflare:workers
// dahil) - lib/trendyol/http-utils.ts ile aynı gerekçe: auth.ts ve client.ts
// bu saf fonksiyonları gerçek istekler için kullanıyor, testler ise gerçek
// kimlik bilgisi veya Cloudflare Workers ortamı gerektirmeden doğrudan
// bunları import edip test edebiliyor.

// Hepsiburada'nın 2024'te güncellenen entegratör kimlik doğrulama yapısı
// (developers.hepsiburada.com, "Entegratöre Servis Anahtarı Ekleme"):
// Basic Auth'ta kullanıcı adı olarak MerchantId (mağaza GUID'iniz), şifre
// olarak da "Servis Anahtarı" (Secret Key, entegratör ekranında üretilen
// 12 haneli alfanümerik değer) kullanılıyor - Trendyol'daki gibi ayrı bir
// "kullanıcı adı" alanı YOK.
export function buildHepsiburadaAuthHeader(merchantId: string, secretKey: string): string {
  return `Basic ${btoa(`${merchantId}:${secretKey}`)}`;
}

// developers.hepsiburada.com'un Ocak 2024 entegrasyon güncellemesine göre
// User-Agent "{MerchantId} - {EntegratörAdı}" formatında olmalı - eski
// Basic Auth'ta kullanılan kullanıcı adı bilgisinin artık User-Agent'a
// taşınması gerekiyor. Sadece entegratör adını göndermek (önceki hatalı
// halimiz) 401/403 ile reddediliyor.
export function buildHepsiburadaUserAgent(
  merchantId: string,
  integratorName: string,
): string {
  return `${merchantId} - ${integratorName}`;
}
