// Kasıtlı olarak hiçbir şey import etmiyor (cloudflare:workers dahil) -
// syncSupplier.ts bu saf fonksiyonu gerçek senkron için kullanıyor, testler
// ise gerçek kimlik bilgisi veya Cloudflare Workers ortamı gerektirmeden
// doğrudan import edip test edebiliyor.

// Tedarikçi, ürün kodlarını/besleme alanlarını değiştirmeden üretim
// malzemesini pirinçten çeliğe geçirdi (2026-10) - besleme hâlâ eski
// malzeme adlarını gönderiyor ama fiziksel ürün artık çelik. Besleme
// düzeltilene kadar bu, ürün adı/açıklamasındaki eski malzeme sözcüklerini
// senkron sırasında kalıcı olarak "Çelik" ile değiştiriyor - sadece bir
// kerelik D1 düzeltmesi yapsaydık bir sonraki senkronda eski adıyla geri
// dönerdi (syncSupplier() name/description'ı her çalıştırmada besleme
// değeriyle EZİYOR). "Deri"/"Doğal Taş" gibi metal OLMAYAN malzemeler
// kasıtlı olarak dokunulmuyor - değişen sadece metal/kaplama türü.
const OLD_MATERIAL_REPLACEMENTS: [RegExp, string][] = [
  [/pirinçtir/gi, "çeliktir"],
  [/pirinç/gi, "çelik"],
  [/gümüş kaplama/gi, "çelik"],
  [/altın kaplama/gi, "çelik"],
];

// Trendyol, ürün adındaki "316L" ibaresini (paslanmaz çelik kalite kodu,
// marka adı değil) kendi marka-algılama sistemine göre bilinmeyen/onaysız
// bir marka sanıp ürünü reddediyordu (2026-10). Tedarikçinin XML feed'i bu
// ibareyi hâlâ gönderiyor - yukarıdaki malzeme değişimiyle aynı gerekçeyle
// (sadece bir kerelik D1 düzeltmesi bir sonraki senkronda feed değeriyle
// geri gelirdi) burada kalıcı olarak siliniyor. Feed'de gözlemlenen TEK
// biçim "316L " (büyük harf + boşluk) - hem adın başında hem ortasında.
const STEEL_GRADE_LABEL = "316L ";

export function correctMaterialWording(value: string): string {
  let result = value;
  for (const [pattern, replacement] of OLD_MATERIAL_REPLACEMENTS) {
    result = result.replace(pattern, (match) =>
      match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()
        ? replacement[0].toUpperCase() + replacement.slice(1)
        : replacement,
    );
  }
  return result.split(STEEL_GRADE_LABEL).join("").trim();
}
