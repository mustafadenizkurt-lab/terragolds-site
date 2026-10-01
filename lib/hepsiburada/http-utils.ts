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

export type HepsiburadaProxyConfig = { url: string; secret: string } | undefined;

// Hepsiburada'nın sipariş/listeleme sunucuları (oms-external-sit,
// listing-external-sit) Cloudflare Workers'tan (bizim barınma ortamımız)
// gelen istekleri Cloudflare 520 ile engelliyor - aynı istek normal bir
// bağlantıdan (curl, Hepsiburada'nın kendi testi) sorunsuz çalışıyor. Bu
// fonksiyon, yapılandırılmışsa isteği Cloudflare dışı bir sunucuda (Render
// vb.) çalışan köprü servisine yönlendirir; o servis isteği olduğu gibi
// Hepsiburada'ya iletip ham cevabı geri döner. Köprü yapılandırılmamışsa
// normal fetch'e düşer (davranış değişmez).
export async function hepsiburadaRelayFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  proxy?: HepsiburadaProxyConfig,
): Promise<Response> {
  if (!proxy?.url || !proxy.secret) return fetch(url, init);

  const relayResponse = await fetch(`${proxy.url.replace(/\/$/, "")}/relay`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-proxy-secret": proxy.secret },
    body: JSON.stringify({ method: init.method ?? "GET", url, headers: init.headers ?? {}, body: init.body }),
  });
  if (!relayResponse.ok) {
    throw new Error(`Hepsiburada köprü servisi hatası: HTTP ${relayResponse.status}`);
  }
  const data = (await relayResponse.json()) as { status: number; headers: Record<string, string>; body: string };
  // Köprü servisi gövdeyi zaten çözülmüş (decompressed) metin olarak
  // döndürüyor - content-encoding/content-length gibi header'lar olduğu
  // gibi iletilirse burada ikinci kez çözülmeye çalışılıp bozulabilir.
  const safeHeaders = Object.fromEntries(
    Object.entries(data.headers).filter(
      ([key]) => !["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase()),
    ),
  );
  return new Response(data.body, { status: data.status, headers: safeHeaders });
}
