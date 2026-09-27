const SITE_ORIGIN = "https://www.terragolds.com";

// Bazı entegrasyonlar (ör. bir zamanlar Shopify, hâlâ Trendyol/N11/
// Hepsiburada) mutlak, düzgün encode edilmiş bir görsel URL'si istiyor.
// D1'deki görsel değeri her zaman öyle değil: bazıları kendi medya
// API'mizden gelen göreli yol (domain'siz), bazıları tedarikçi feed'inden
// kopyalanmış, içinde boşluk veya kodlanmamış bir Türkçe karakter (ör. "İ")
// barındıran mutlak URL - üçü de tarayıcıda düzgün açılıyor (tarayıcı
// anlık encode ediyor) ama ham bir URI string olarak geçersizler.
export function toAbsoluteImageUrl(image: string): string | null {
  if (!image) return null;
  const absolute = /^https?:\/\//i.test(image)
    ? image
    : `${SITE_ORIGIN}${image.startsWith("/") ? "" : "/"}${image}`;
  try {
    // Boşluk/ASCII-dışı karakterleri percent-encode ediyor; zaten düzgün
    // encode edilmiş bir URL'de idempotent (encodeURI "%" karakterine dokunmaz).
    return encodeURI(absolute);
  } catch {
    return null;
  }
}
