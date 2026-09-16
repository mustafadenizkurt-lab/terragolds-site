import { updateOrderStatus } from "./client";

// fulfillShopifyOrder (lib/shopify/fulfillment.ts) ile aynı tek yönlü kural:
// Terragolds admin kargo durumunun değiştirildiği TEK yer - bu sadece
// Trendyol'a "kargoya verildi" bilgisini bildirir, hiçbir zaman bir durumu
// Trendyol'dan geri okumaz.
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
