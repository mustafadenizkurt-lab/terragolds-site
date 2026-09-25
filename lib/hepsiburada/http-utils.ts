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

// Entegratör adı (User-Agent) ASCII bir kullanıcı adı ("selfit_dev" gibi);
// admin panelinde Türkçe klavye/otomatik küçük harf yüzünden noktasız "ı"
// ile ("selfıt_dev") kaydedilince Hepsiburada 401 "Merchant api authorization
// failed" veriyordu. Kullanırken kırpılıp Türkçe harfler ASCII'ye çevrilir.
export function normalizeIntegratorName(value: string): string {
  return value.trim().replaceAll("ı", "i").replaceAll("İ", "I");
}

// Hepsiburada test (SIT) ortamı: test ortam bilgileri açıldığında canlı
// sunucu adresleri bunlarla değiştirilir (kimlik bilgilerindeki "environment"
// alanı "test" ise).
const TEST_HOSTS: Record<string, string> = {
  "https://mpop.hepsiburada.com": "https://mpop-sit.hepsiburada.com",
  "https://listing-external.hepsiburada.com": "https://listing-external-sit.hepsiburada.com",
  "https://oms-external.hepsiburada.com": "https://oms-external-sit.hepsiburada.com",
};

export function applyHepsiburadaEnvironment(baseUrl: string, environment?: string): string {
  return environment?.trim().toLowerCase() === "test" ? (TEST_HOSTS[baseUrl] ?? baseUrl) : baseUrl;
}

// Hepsiburada kendi kayıtlı entegratör firmalarının (ör. Selfit) adlarının
// kendi geliştirmemiz için KULLANILMASINI kesinlikle yasakladı. Bu ad
// yapılandırmada durursa hiçbir Hepsiburada isteği gönderilmez.
export function assertOwnIntegrator(name: string): void {
  if (/selfit|selfıt/i.test(name)) {
    throw new Error(
      "Entegratör adı Hepsiburada'nın kayıtlı entegratör firmasına (Selfit) ait - kendi geliştirmemizde kullanılamaz. " +
        "Hepsiburada'nın kendi bünyemiz için vereceği entegratör adını Hepsiburada ayarlarına girin.",
    );
  }
}
