// Kasıtlı olarak D1Database veya fetch'e bağımlı değil - Trendyol'un sipariş
// yanıtını bizim satır şeklimize çeviren saf bir fonksiyon, böylece gerçek
// API kimlik bilgileri olmadan bile örnek bir yanıtla (tests/ altında)
// doğrudan test edilebiliyor. lib/trendyol/orders.ts bu şekli D1'e yazarken
// kullanıyor.

export type TrendyolOrderLineItem = {
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type MappedTrendyolOrder = {
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
  items: TrendyolOrderLineItem[];
};

// Trendyol tutarları TL cinsinden ondalıklı sayı gönderiyor (örn. 149.9) -
// diğer her yerde olduğu gibi (bkz. lib/shopify/orders.ts'in toKurus'u)
// kuruşa (tam sayı) çeviriyoruz.
function toKurus(amount: number | undefined): number {
  return Number.isFinite(amount) ? Math.round((amount as number) * 100) : 0;
}

// Trendyol'un "Awaiting"/"Created"/"Picking"/"Invoiced"/"Shipped"/
// "Delivered"/"Cancelled"/"Returned" durumlarını kendi sipariş
// durumlarımıza (orders.status ile aynı sözlük) eşliyor - kargoya verme
// hâlâ sadece admin panelinden, Trendyol'a tek yönlü bildiriliyor (bkz.
// client.ts:updateOrderStatus), bu eşleme sadece Trendyol'dan yeni bir
// sipariş ilk çekildiğinde başlangıç durumunu belirlemek için.
function mapStatus(trendyolStatus: string): string {
  const normalized = trendyolStatus.trim().toLowerCase();
  if (["shipped"].includes(normalized)) return "shipped";
  if (["delivered"].includes(normalized)) return "delivered";
  if (["cancelled", "returned"].includes(normalized)) return "cancelled";
  return "paid";
}

export function mapTrendyolOrderPayload(payload: {
  orderNumber: string;
  status: string;
  grossAmount: number;
  totalDiscount: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  cargoTrackingNumber?: number;
  shipmentAddress?: {
    address1?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
  };
  lines: {
    barcode: string;
    productName: string;
    quantity: number;
    price: number;
    productId?: number;
  }[];
}): MappedTrendyolOrder {
  const address = payload.shipmentAddress;
  const items: TrendyolOrderLineItem[] = (payload.lines ?? []).map((line) => ({
    productId: line.productId ?? null,
    name: line.productName,
    quantity: line.quantity,
    unitPrice: toKurus(line.price),
  }));

  return {
    orderNumber: payload.orderNumber,
    status: mapStatus(payload.status),
    customerFirstName: payload.customerFirstName ?? "",
    customerLastName: payload.customerLastName ?? "",
    customerEmail: payload.customerEmail ?? "",
    customerPhone: address?.phone ?? "",
    shippingAddress: address?.address1 ?? "",
    shippingDistrict: address?.district ?? "",
    shippingCity: address?.city ?? "",
    shippingPostcode: address?.postalCode ?? "",
    shippingCountry: address?.countryCode ?? "TR",
    totalAmount: toKurus(payload.grossAmount),
    discountAmount: toKurus(payload.totalDiscount),
    currency: "TRY",
    trackingNumber: payload.cargoTrackingNumber
      ? String(payload.cargoTrackingNumber)
      : "",
    items,
  };
}
