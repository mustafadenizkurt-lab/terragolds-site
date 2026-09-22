import { updateOrderStatus } from "./client";

// fulfillTrendyolOrder/fulfillHepsiburadaOrder ile aynı tek yönlü kural:
// Terragolds admin kargo durumunun değiştirildiği TEK yer - bu sadece N11'e
// "kargoya verildi" bilgisini bildirir, hiçbir zaman bir durumu N11'den
// geri okumaz.
export async function fulfillN11Order(
  shipmentPackageId: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  const numericId = Number(shipmentPackageId);
  if (!Number.isFinite(numericId)) {
    throw new Error("Geçersiz N11 paket numarası.");
  }
  await updateOrderStatus(numericId, {
    status: "Shipped",
    trackingNumber,
    cargoProviderName: carrier,
  });
}
