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

export function effectiveCommissionRateFor(categoryId: number): number {
  return commissionRateFor(categoryId) * (1 + COMMISSION_VAT_RATE);
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
