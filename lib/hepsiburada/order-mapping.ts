// lib/trendyol/order-mapping.ts ile aynı gerekçe: D1Database veya fetch'e
// bağımlı değil, Hepsiburada'nın sipariş yanıtını bizim satır şeklimize
// çeviren saf bir fonksiyon - kimlik bilgisi olmadan doğrudan test edilebilir.

export type HepsiburadaOrderLineItem = {
  productId: number | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type MappedHepsiburadaOrder = {
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
  items: HepsiburadaOrderLineItem[];
};

// Hepsiburada tutarları TL cinsinden ondalıklı sayı gönderiyor - diğer her
// yerde olduğu gibi (bkz. lib/trendyol/order-mapping.ts'in toKurus'u)
// kuruşa (tam sayı) çeviriyoruz.
function toKurus(amount: number | undefined): number {
  return Number.isFinite(amount) ? Math.round((amount as number) * 100) : 0;
}

// Hepsiburada'nın "Open"/"Packed"/"Shipped"/"Delivered"/"Cancelled" paket
// durumlarını kendi sipariş durumlarımıza eşliyor - kargoya verme hâlâ
// sadece admin panelinden, Hepsiburada'ya tek yönlü bildiriliyor (bkz.
// client.ts:updateOrderStatus), bu eşleme sadece yeni bir sipariş ilk
// çekildiğinde başlangıç durumunu belirlemek için.
function mapStatus(hepsiburadaStatus: string): string {
  const normalized = hepsiburadaStatus.trim().toLowerCase();
  if (normalized === "shipped") return "shipped";
  if (normalized === "delivered") return "delivered";
  if (["cancelled", "returned"].includes(normalized)) return "cancelled";
  return "paid";
}

// customerName Hepsiburada yanıtında tek bir alan olarak geliyor
// (Trendyol'un ayrı first/last name alanlarının aksine) - ilk boşluğa göre
// bölüyoruz, tamamı boşsa ikisi de boş kalıyor.
function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1),
  };
}

export function mapHepsiburadaOrderPayload(payload: {
  orderNumber: string;
  status: string;
  totalPrice: number;
  totalDiscount: number;
  customerName?: string;
  customerEmail?: string;
  cargoTrackingNumber?: string;
  deliveryAddress?: {
    address?: string;
    town?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phoneNumber?: string;
  };
  items: {
    merchantSku: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }[];
}): MappedHepsiburadaOrder {
  const address = payload.deliveryAddress;
  const { firstName, lastName } = splitCustomerName(payload.customerName ?? "");
  const items: HepsiburadaOrderLineItem[] = (payload.items ?? []).map((item) => ({
    productId: null,
    name: item.productName,
    quantity: item.quantity,
    unitPrice: toKurus(item.unitPrice),
  }));

  return {
    orderNumber: payload.orderNumber,
    status: mapStatus(payload.status),
    customerFirstName: firstName,
    customerLastName: lastName,
    customerEmail: payload.customerEmail ?? "",
    customerPhone: address?.phoneNumber ?? "",
    shippingAddress: address?.address ?? "",
    shippingDistrict: address?.town ?? "",
    shippingCity: address?.city ?? "",
    shippingPostcode: address?.postalCode ?? "",
    shippingCountry: address?.countryCode ?? "TR",
    totalAmount: toKurus(payload.totalPrice),
    discountAmount: toKurus(payload.totalDiscount),
    currency: "TRY",
    trackingNumber: payload.cargoTrackingNumber ?? "",
    items,
  };
}
