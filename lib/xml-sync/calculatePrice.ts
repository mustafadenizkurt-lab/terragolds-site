// Tedarikçi fiyatları (cost) KDV hariç değerlerdir; nihai satış fiyatı önce
// kâr marjı, sonra KDV eklenerek hesaplanır. Dışa aktarılıyor ki fiyat
// gösteriminde (quick-add-to-cart.tsx) KDV tutarını buradaki gerçek orana
// göre hesaplayabilelim - ayrı bir sabit tanımlanırsa iki yer birbirinden
// bağımsız kayabilir.
export const VAT_RATE = 0.2;

export function calculatePrice(cost: number, markupPercent: number) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("XML ürün fiyatı geçersiz.");
  const markup = Math.max(0, Math.min(500, Number(markupPercent) || 0));
  return Math.max(0, Math.round(cost * (1 + markup / 100) * (1 + VAT_RATE)));
}
