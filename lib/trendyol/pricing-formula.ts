// Kasıtlı olarak hiçbir şey import etmiyor (client.ts/sync.ts dahil) - aynı
// gerekçe http-utils.ts'teki gibi: testler gerçek kimlik bilgisi veya
// Cloudflare Workers ortamı gerektirmeden doğrudan bu saf fonksiyonları
// import edip test edebiliyor.

export const ORDER_FEE = 29; // TL, sipariş başına sabit (tek ürünlük sipariş varsayımıyla - muhafazakâr)
export const SHIPPING_COST = 80; // TL, sabit
export const VAT_RATE = 0.2; // tedarikçi faturasına göre sabit
export const DEFAULT_COMMISSION_RATE = 0.22;
// Web araştırmasıyla doğrulandı (N11/Hepsiburada'daki gibi): Trendyol'un
// kestiği komisyon TUTARININ üzerine ayrıca KDV ekleniyor (ürün fiyatının
// değil, komisyonun KDV'si) - önceki sürümde bu atlanmıştı, gerçek net kâr
// hesaplanandan biraz daha düşük çıkıyordu.
export const COMMISSION_VAT_RATE = 0.2;
// %22 komisyondan AYRI, satış fiyatı üzerinden ayrıca kesilen Trendyol
// hizmet bedeli (N11'deki N11_SERVICE_FEE_RATE ile aynı kavram) - kullanıcı
// bunu doğruladı, önceki formülde hiç yoktu.
export const SERVICE_FEE_RATE = 0.02;
export const MIN_PROFIT_MARGIN_RATE = 0.5;
export const LIST_PRICE_MARKUP_RATE = 0.01; // listPrice, salePrice'ın %1 üstü

// Trendyol categoryId -> gerçek komisyon oranı. Trendyol satıcı panelindeki
// "Komisyon Oranları" sayfasından gerçek oranlar girilene kadar TÜM
// kategoriler DEFAULT_COMMISSION_RATE'e (%22) düşüyor - yanlış tahmini bir
// oranla hesaplanan fiyat gerçek net kârı hedeften saptırır. Gerçek oranlar
// öğrenildikçe buraya eklenmeli (bkz. lib/trendyol/sync.ts
// TRENDYOL_CATEGORY_BY_GROUP_SLUG - aynı categoryId'ler).
export const CATEGORY_COMMISSION_RATES: Record<number, number> = {};

export function commissionRateFor(categoryId: number): number {
  return CATEGORY_COMMISSION_RATES[categoryId] ?? DEFAULT_COMMISSION_RATE;
}

// Satış fiyatının bu oranı Trendyol'a/devlete gidiyor, geri kalanı bizde
// kalıyor: komisyon + komisyon üzerine KDV + ayrı bir kalem olan hizmet
// bedeli (%2).
export function effectiveCommissionRateFor(categoryId: number): number {
  return commissionRateFor(categoryId) * (1 + COMMISSION_VAT_RATE) + SERVICE_FEE_RATE;
}

// requiredPrice: bu fiyatın altına düşülürse hedef net kâr marjı
// tutturulamaz. cost, D1'de KDV HARİÇ tedarikçi maliyeti olarak tutuluyor
// (bkz. lib/xml-sync/calculatePrice.ts VAT_RATE yorumu) - KDV önce maliyete
// eklenip üstüne kâr hedefi ve efektif komisyon oranı (komisyon üzerine KDV
// dahil) geri hesaplanıyor.
export function computeRequiredPrice(cost: number, categoryId: number): number {
  const productCostWithVat = cost * (1 + VAT_RATE);
  const totalCost = productCostWithVat + ORDER_FEE + SHIPPING_COST;
  const targetProfit = productCostWithVat * MIN_PROFIT_MARGIN_RATE;
  return (totalCost + targetProfit) / (1 - effectiveCommissionRateFor(categoryId));
}

// Admin panelinden ürün başına elle girilebilen ek güvenlik sınırları
// (trendyol_lower_limit_price/trendyol_upper_limit_price) - computeRequiredPrice
// zaten maliyet+kâr marjına göre bir taban hesaplıyor, ama bu iki sınır
// admin'in "bu ürün hiçbir koşulda X TL altına/Y TL üstüne çıkmasın" diye
// bilerek koyduğu ek bir tavan/taban. null olan sınır uygulanmaz.
export function clampToPriceLimits(
  price: number,
  lowerLimit: number | null,
  upperLimit: number | null,
): number {
  let clamped = price;
  if (lowerLimit != null) clamped = Math.max(clamped, lowerLimit);
  if (upperLimit != null) clamped = Math.min(clamped, upperLimit);
  return clamped;
}

// XML tedarikçi senkronu (syncSupplier.ts), yeni/güncellenen bir ürünün
// trendyol_lower_limit_price/trendyol_upper_limit_price alanlarını İLK KEZ
// (henüz boşsa) otomatik doldurmak için bu fonksiyonu kullanıyor -
// computeRequiredPrice'tan (asıl gece botunun kullandığı, kategori bazlı
// gerçek komisyon oranlarıyla çalışan motor) KASITLI olarak ayrı ve daha
// basit bir formül: bunlar sadece "ilk tahmin" güvenlik sınırları, admin
// istediği zaman /api/admin/products/trendyol-limits ile elle değiştirebilir
// - bir sonraki XML senkronu o zaman artık üzerine yazmaz (bkz.
// syncSupplier.ts'teki CASE koruması, image_locked_at ile aynı desen).
//
// Kargo için ayrı bir sabit YOK - yukarıdaki paylaşılan SHIPPING_COST (80 TL)
// kullanılıyor; kullanıcı bunu doğruladı (ilk halinde yanlışlıkla 45 TL
// kullanılmıştı).
//
// Ebijuteri'den ürün alırken hem ham fiyatın üzerine KDV ödeniyor (aşağıda
// costWithVat ile hesaba katılıyor) HEM DE ebijuteri sipariş başına ayrıca
// bir ücret kesiyor - bu, Trendyol'un kendi ORDER_FEE'sinden (computeRequiredPrice)
// FARKLI bir kalem, o yüzden ayrı bir sabit.
const AUTO_LIMIT_SUPPLIER_ORDER_FEE = 30; // TL, ebijuteri'nin sipariş başına kestiği ücret
const AUTO_LIMIT_UPPER_RATIO = 1.5; // upperLimit = lowerLimit * bu oran

// Min net kâr hedefi artık tek bir sabit değil, maliyete göre kademeli:
// "uygun" ürünlerde daha düşük, "yüksek" (daha pahalı, dolayısıyla daha
// yüksek TL kârı taşıyabilecek) ürünlerde daha yüksek. Eşik XML'den gelen
// HAM (KDV hariç) maliyete göre - Terragolds kataloğunun ~%88'i bu sınırın
// altında (10-1000 TL aralığında, ortalama ~96 TL).
const AUTO_LIMIT_PROFIT_TIER_COST_THRESHOLD = 150; // TL, ham maliyet
const AUTO_LIMIT_MIN_NET_PROFIT_LOW = 50; // TL, maliyet eşiğin altındaysa
const AUTO_LIMIT_MIN_NET_PROFIT_HIGH = 100; // TL, maliyet eşiğe ulaşmış/üstündeyse

export type TrendyolAutoLimits = { lowerLimit: number; upperLimit: number };

// cost, D1'de KDV HARİÇ tedarikçi maliyeti olarak tutuluyor (bkz.
// computeRequiredPrice yorumu ve lib/xml-sync/calculatePrice.ts) - KDV
// burada da aynı şekilde önce maliyete eklenip üstünden hesaplanıyor.
// Komisyon oranı da effectiveCommissionRateFor ile aynı (komisyon TUTARININ
// üzerine ayrıca KDV biniyor) - düz %22 kullanmak, tam da bu fonksiyonun
// garantilemeye çalıştığı min net kârı hedeften biraz düşük bırakırdı.
export function calculateTrendyolLimitsFromCost(cost: number, categoryId: number): TrendyolAutoLimits {
  const costWithVat = cost * (1 + VAT_RATE);
  const minNetProfit =
    cost >= AUTO_LIMIT_PROFIT_TIER_COST_THRESHOLD
      ? AUTO_LIMIT_MIN_NET_PROFIT_HIGH
      : AUTO_LIMIT_MIN_NET_PROFIT_LOW;
  const lowerLimit = Math.round(
    (costWithVat + SHIPPING_COST + AUTO_LIMIT_SUPPLIER_ORDER_FEE + minNetProfit) /
      (1 - effectiveCommissionRateFor(categoryId)),
  );
  return { lowerLimit, upperLimit: Math.round(lowerLimit * AUTO_LIMIT_UPPER_RATIO) };
}
