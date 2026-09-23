// Kasıtlı olarak D1Database veya fetch'e bağımlı değil - lib/trendyol/
// order-mapping.ts ile aynı gerekçe: N11'in sipariş yanıtını bizim satır
// şeklimize çeviren saf bir fonksiyon, gerçek API kimlik bilgileri olmadan
// örnek bir yanıtla test edilebiliyor.

export type N11OrderLineItem = {
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
  // "Picking" onayında (PUT /rest/order/v1/update) gönderilmesi gereken
  // satır kimliği - N11'in resmi dokümanındaki orderLineId.
  lineId: number | null;
};

export type MappedN11Order = {
  orderNumber: string;
  status: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingDistrict: string;
  shippingCity: string;
  shippingPostcode: string;
  shippingCountry: string;
  totalAmount: number;
  discountAmount: number;
  currency: string;
  trackingNumber: string;
  items: N11OrderLineItem[];
};

// N11 tutarları TL cinsinden ondalıklı sayı gönderiyor - diğer her yerde
// olduğu gibi (lib/trendyol/order-mapping.ts'in toKurus'u) kuruşa (tam
// sayı) çeviriyoruz.
function toKurus(amount: number | undefined): number {
  return Number.isFinite(amount) ? Math.round((amount as number) * 100) : 0;
}

// N11'in shipmentPackageStatus sözlüğü (resmi dokümanda "Picking" dışındaki
// değerler örneklenmedi) - normalize edilmiş metinde bilinen anahtar
// kelimeler aranıyor, eşleşmezse "paid" varsayılıyor (Trendyol'daki
// mapStatus ile aynı temkinli yaklaşım).
function mapStatus(n11Status: string): string {
  const normalized = (n11Status ?? "").trim().toLocaleLowerCase("tr-TR");
  if (normalized.includes("ship")) return "shipped";
  if (normalized.includes("deliver")) return "delivered";
  if (normalized.includes("cancel") || normalized.includes("iptal") || normalized.includes("iade"))
    return "cancelled";
  return "paid";
}

export function mapN11OrderPayload(payload: {
  orderNumber: string;
  shipmentPackageStatus: string;
  totalAmount?: number;
  discountAmount?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  trackingNumber?: string;
  shippingAddress?: {
    address?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
  };
  lines: {
    stockCode: string;
    productName?: string;
    quantity: number;
    price: number;
    productId?: number;
    orderLineId?: number;
  }[];
}): MappedN11Order {
  const address = payload.shippingAddress;
  const items: N11OrderLineItem[] = (payload.lines ?? []).map((line) => ({
    productId: line.productId ?? null,
    name: line.productName ?? line.stockCode,
    quantity: line.quantity,
    unitPrice: toKurus(line.price),
    lineId: line.orderLineId ?? null,
  }));

  // totalAmount resmi dokümanda örneklenmedi (sadece billingAddress/
  // shippingAddress/orderNumber/lines/shipmentPackageStatus doğrulandı) -
  // varsa kullanılıyor, yoksa satır toplamından hesaplanıyor.
  const computedTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return {
    orderNumber: payload.orderNumber,
    status: mapStatus(payload.shipmentPackageStatus),
    customerFirstName: payload.customerFirstName ?? "",
    customerLastName: payload.customerLastName ?? "",
    customerEmail: payload.customerEmail ?? "",
    customerPhone: address?.phone ?? "",
    shippingAddress: address?.address ?? "",
    shippingDistrict: address?.district ?? "",
    shippingCity: address?.city ?? "",
    shippingPostcode: address?.postalCode ?? "",
    shippingCountry: address?.countryCode ?? "TR",
    totalAmount: payload.totalAmount !== undefined ? toKurus(payload.totalAmount) : computedTotal,
    discountAmount: toKurus(payload.discountAmount),
    currency: "TRY",
    trackingNumber: payload.trackingNumber ?? "",
    items,
  };
}
