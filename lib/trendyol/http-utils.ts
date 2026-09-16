// Kasıtlı olarak hiçbir şey import etmiyor (runtime-env/cloudflare:workers
// dahil) - auth.ts ve client.ts bu saf fonksiyonları gerçek istekler için
// kullanıyor, testler ise gerçek kimlik bilgisi veya Cloudflare Workers
// ortamı gerektirmeden doğrudan bunları import edip test edebiliyor.

// Trendyol authenticates with plain HTTP Basic auth (apiKey:apiSecret),
// unlike Shopify's OAuth token exchange.
export function buildTrendyolAuthHeader(apiKey: string, apiSecret: string): string {
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
}

// Trendyol requires a "{supplierId} - {selfIntegrationName}" User-Agent on
// every request (their docs reject requests without one).
export function buildTrendyolUserAgent(supplierId: string): string {
  return `${supplierId} - SelfIntegration`;
}
