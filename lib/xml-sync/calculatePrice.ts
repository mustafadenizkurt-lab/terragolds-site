export function calculatePrice(cost: number, markupPercent: number) {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("XML ürün fiyatı geçersiz.");
  const markup = Math.max(0, Math.min(500, Number(markupPercent) || 0));
  return Math.max(0, Math.round(cost * (1 + markup / 100)));
}
