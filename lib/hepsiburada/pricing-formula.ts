// Kasıtlı olarak hiçbir şey import etmiyor (Trendyol/N11'deki pricing-formula.ts
// ile aynı desen) - testler gerçek kimlik bilgisi veya Cloudflare Workers
// ortamı gerektirmeden doğrudan bu saf fonksiyonları import edip test
// edebiliyor.

// Kullanıcı komisyon oranını doğrudan belirtti: Hepsiburada'da da Trendyol
// ile aynı %22. Trendyol'un ORDER_FEE/SHIPPING_COST sabitleri (Hepsiburada'ya
// özel doğrulanmış bir değer paylaşılmadığı için) aynen kullanılıyor -
// gerçek değerler öğrenildikçe (satıcı panelindeki komisyon/kargo
// sayfasından) burası güncellenmeli.
export const ORDER_FEE = 29; // TL, sipariş başına sabit (tek ürünlük sipariş varsayımıyla - muhafazakâr)
export const SHIPPING_COST = 80; // TL, sabit
export const VAT_RATE = 0.2; // tedarikçi faturasına göre sabit
export const COMMISSION_RATE = 0.22;
// Web araştırmasıyla doğrulandı (N11'deki gibi): Hepsiburada'nın kestiği
// komisyon TUTARININ üzerine ayrıca KDV ekleniyor (ürün fiyatının değil,
// komisyonun KDV'si) - bu yüzden commissionRate'e çarpılarak ekleniyor,
// ayrı bir kalem olarak satış fiyatına uygulanmıyor.
export const COMMISSION_VAT_RATE = 0.2;
export const MIN_PROFIT_MARGIN_RATE = 0.5;

export function effectiveCommissionRate(): number {
  return COMMISSION_RATE * (1 + COMMISSION_VAT_RATE);
}

// requiredPrice: bu fiyatın altına düşülürse hedef net kâr marjı
// tutturulamaz. cost, D1'de KDV HARİÇ tedarikçi maliyeti olarak tutuluyor
// (bkz. lib/xml-sync/calculatePrice.ts VAT_RATE yorumu) - KDV önce maliyete
// eklenip üstüne kâr hedefi ve efektif komisyon oranı geri hesaplanıyor
// (Trendyol'daki computeRequiredPrice ile aynı yapı, N11'deki gibi komisyon
// üzerine KDV de dahil).
export function computeRequiredPrice(cost: number): number {
  const productCostWithVat = cost * (1 + VAT_RATE);
  const totalCost = productCostWithVat + ORDER_FEE + SHIPPING_COST;
  const targetProfit = productCostWithVat * MIN_PROFIT_MARGIN_RATE;
  return (totalCost + targetProfit) / (1 - effectiveCommissionRate());
}
