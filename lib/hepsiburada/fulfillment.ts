import { updateOrderStatus } from "./client";

// fulfillTrendyolOrder (lib/trendyol/fulfillment.ts) ile aynı tek yönlü
// kural: Terragolds admin kargo durumunun değiştirildiği TEK yer - bu
// sadece Hepsiburada'ya "kargoya verildi" bilgisini bildirir, hiçbir zaman
// bir durumu Hepsiburada'dan geri okumaz.
export async function fulfillHepsiburadaOrder(
  packageNumber: string,
  carrier: string,
  trackingNumber: string,
): Promise<void> {
  await updateOrderStatus(packageNumber, {
    trackingNumber,
    cargoCompany: carrier,
  });
}
