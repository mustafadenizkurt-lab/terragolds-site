import { updateOrderStatus } from "./client";

// Terragolds admin kargo durumunun Trendyol'a bildirildiği TEK yer - bu
// çağrının kendisi tek yönlü. Trendyol'un o paket için SONRADAN
// raporladığı gerçek durum ayrıca syncTrendyolOrders() ile periyodik
// olarak geri okunuyor (bkz. lib/trendyol/orders.ts importTrendyolOrder).
export async function fulfillTrendyolOrder(
  shipmentPackageId: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  const numericId = Number(shipmentPackageId);
  if (!Number.isFinite(numericId)) {
    throw new Error("Geçersiz Trendyol paket numarası.");
  }
  await updateOrderStatus(numericId, {
    status: "Shipped",
    trackingNumber,
    cargoProviderName: carrier,
  });
}
