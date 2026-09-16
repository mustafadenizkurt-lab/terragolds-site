// Kasıtlı olarak hiçbir şey import etmiyor (runtime-env/cloudflare:workers
// dahil) - lib/trendyol/http-utils.ts ile aynı gerekçe: auth.ts ve client.ts
// bu saf fonksiyonları gerçek istekler için kullanıyor, testler ise gerçek
// kimlik bilgisi veya Cloudflare Workers ortamı gerektirmeden doğrudan
// bunları import edip test edebiliyor.

// Hepsiburada da (Trendyol gibi) düz HTTP Basic auth kullanıyor, ama
// apiKey/apiSecret yerine merchant hesabının kullanıcı adı/şifresiyle
// (username:password).
export function buildHepsiburadaAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

// Hepsiburada da her istekte "{merchantId} - {entegrasyonAdı}" biçiminde bir
// User-Agent bekliyor (Trendyol'daki zorunlulukla aynı).
export function buildHepsiburadaUserAgent(merchantId: string): string {
  return `${merchantId} - SelfIntegration`;
}
