// Kasıtlı olarak hiçbir şey import etmiyor (Trendyol'daki pricing-formula.ts
// ile aynı desen) - testler gerçek kimlik bilgisi veya Cloudflare Workers
// ortamı gerektirmeden doğrudan bu saf fonksiyonları import edip test
// edebiliyor.

// Kaynak: N11'in resmi "Komisyon Oranları" sayfası DEĞİL (oraya API/ağ
// erişimimiz yok) - kullanıcının paylaştığı bir arama özeti. Terragolds'un
// sattığı ürünler hep "Bijuteri ve Takı Aksesuarları" (Yüzük/Kolye/Bileklik/
// Küpe/Broş/Piercing/Çelik Takılar/2.El Antika) kategorisinde - bu aralığın
// (%18-%20,34) ÜST ucu (%20) kasıtlı olarak seçildi: komisyonu olduğundan
// düşük varsaymak fiyatı gerektiğinden az yükseltip kâr marjını eritir,
// olduğundan yüksek varsaymak sadece fiyatı gereğinden biraz fazla yükseltir
// (daha güvenli taraf). Satıcı panelindeki gerçek "Komisyon Oranları"
// sayfasından doğrulanınca bu sabit güncellenebilir.
export const N11_COMMISSION_RATE = 0.20;
// Satış fiyatı üzerinden ayrıca kesilen pazaryeri hizmet bedeli.
export const N11_SERVICE_FEE_RATE = 0.0167;
// Komisyon TUTARININ üzerine eklenen KDV (ürün fiyatının değil, N11'in
// kestiği komisyonun KDV'si) - bu yüzden commissionRate'e çarpılarak
// ekleniyor, ayrı bir kalem olarak satış fiyatına uygulanmıyor.
export const N11_COMMISSION_VAT_RATE = 0.20;
// Her satıştan kesilen stopaj.
export const N11_WITHHOLDING_RATE = 0.01;
// TL, sabit - N11 kargo ücreti 70-95 TL aralığında (ürün boyutuna göre);
// Trendyol'daki SHIPPING_COST gibi tek bir sabit kullanmak için aralığın
// ortası değil ÜST ucuna yakın (85 TL) seçildi - aynı "düşük tahmin kâr
// marjını eritir" gerekçesiyle.
export const N11_SHIPPING_COST = 85;
export const VAT_RATE = 0.2; // tedarikçi faturasına göre sabit (Trendyol ile aynı)
export const MIN_PROFIT_MARGIN_RATE = 0.5;
// listPrice, salePrice'ın bu oran kadar "indirimli" görünmesini sağlayacak
// şekilde üstte tutulur (satış fiyatı DEĞİŞMİYOR - sadece üzeri çizili
// referans fiyat yükseliyor). %10: N11'de ürün "%10 indirimli" rozetiyle
// görünsün diye (kâr marjını etkilemez, salePrice zaten computeRequiredPrice
// ile hesaplanan hedef kâr fiyatı).
export const LIST_PRICE_DISCOUNT_RATE = 0.10;

// Komisyon + KDV(komisyon) + hizmet bedeli + stopaj toplamı - satış
// fiyatının bu oranı N11'e/devlete gidiyor, geri kalanı bizde kalıyor.
export function n11EffectiveCommissionRate(): number {
  return (
    N11_COMMISSION_RATE * (1 + N11_COMMISSION_VAT_RATE) +
    N11_SERVICE_FEE_RATE +
    N11_WITHHOLDING_RATE
  );
}

// requiredPrice: bu fiyatın altına düşülürse hedef net kâr marjı
// tutturulamaz. cost, D1'de KDV HARİÇ tedarikçi maliyeti olarak tutuluyor
// (bkz. lib/xml-sync/calculatePrice.ts VAT_RATE yorumu) - KDV önce maliyete
// eklenip üstüne kâr hedefi ve efektif komisyon oranı geri hesaplanıyor
// (Trendyol'daki computeRequiredPrice ile aynı yapı, tek fark N11'in
// komisyon+hizmet bedeli+stopaj toplamının sabit oluşu - kategoriye göre
// değişen doğrulanmış oranlar yok).
export function computeRequiredPrice(cost: number): number {
  const productCostWithVat = cost * (1 + VAT_RATE);
  const totalCost = productCostWithVat + N11_SHIPPING_COST;
  const targetProfit = productCostWithVat * MIN_PROFIT_MARGIN_RATE;
  return (totalCost + targetProfit) / (1 - n11EffectiveCommissionRate());
}

// listPrice = salePrice / (1 - indirim oranı): salePrice, listPrice'ın
// %(LIST_PRICE_DISCOUNT_RATE*100) indirimlisi olarak görünür. Burada
// (pricing.ts yerine) tanımlı çünkü sync.ts de kullanıyor - bu dosyanın
// hiçbir şey import etmeme kuralına (testlerin kimlik bilgisi olmadan
// çalışabilmesi için) uymak amacıyla D1'e bağlı pricing.ts'e bağımlı
// kalınmıyor.
export function n11ListPriceFor(salePrice: number): number {
  return Math.round(salePrice / (1 - LIST_PRICE_DISCOUNT_RATE));
}
