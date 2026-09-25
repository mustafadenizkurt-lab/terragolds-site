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

// Hepsiburada Merchant Çözüm Merkezi'nden bu hesaba özel gelen gerçek
// destek yanıtına göre (genel web kaynaklarından değil, doğrudan bizim
// destek kaydımızdan): "User-Agent: Entegratör adınız (Örnek olarak
// x_dev)" - Basic Auth'tan tamamen bağımsız, MerchantId ile
// birleştirilmiyor.
export function buildHepsiburadaUserAgent(integratorName: string): string {
  return normalizeIntegratorName(integratorName);
}

// Entegratör adı (User-Agent): Hepsiburada satıcı panelinde kayıtlı haliyle
// ("selfıt_dev", noktasız ı) AYNEN gönderilir - Hepsiburada destek bunu
// açıkça istedi. Sadece baştaki/sondaki boşluk ve satır sonu kırpılır;
// Türkçe harfler ASCII'ye ÇEVRİLMEZ.
export function normalizeIntegratorName(value: string): string {
  return value.trim();
}
