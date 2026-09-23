// Kasıtlı olarak hiçbir şey import etmiyor (lib/trendyol/http-utils.ts ile
// aynı desen) - auth.ts ve client.ts bu saf fonksiyonları gerçek istekler
// için kullanıyor, testler ise gerçek kimlik bilgisi veya Cloudflare
// Workers ortamı gerektirmeden doğrudan bunları import edip test edebiliyor.

// N11 REST API, Trendyol'un Basic auth'undan farklı olarak appkey/appsecret'ı
// doğrudan HTTP header olarak istiyor (Authorization header'ı kullanılmıyor).
// Kimlik bilgileri so.n11.com > Hesabım > API Hesapları'ndan alınır.
export function buildN11Headers(
  appKey: string,
  appSecret: string,
): Record<string, string> {
  return {
    "content-type": "application/json",
    appkey: appKey,
    appsecret: appSecret,
  };
}

// Kullanıcının N11'den indirdiği resmi entegrasyon dokümanı fiyat
// alanlarında "virgül değil nokta, 2 ondalık hane zorunlu" diyor - JSON
// zaten ondalık ayıracı olarak nokta kullandığından tek gerçek risk kayan
// nokta yuvarlama hatası (ör. 129.999999999998). Bu yüzden her fiyat N11'e
// gitmeden önce buradan geçiriliyor.
export function roundToN11Price(value: number): number {
  return Math.round(value * 100) / 100;
}
