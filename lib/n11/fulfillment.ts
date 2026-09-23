import { updateOrderStatus } from "./client";

// Trendyol/Hepsiburada'nın fulfillment.ts'i "Shipped" + kargo takip no
// bildirir - N11'in resmi entegrasyon dokümanında PUT /rest/order/v1/update
// için şu an SADECE "Picking" durumu destekleniyor, "Shipped"/"Delivered"
// YOK. Bu yüzden bu fonksiyon admin panelindeki "kargoya verildi" akışına
// BAĞLANMIYOR (yanlış bir sinyal olurdu) - bunun yerine lib/n11/orders.ts,
// bir sipariş ilk kez D1'e aktarıldığında N11'e "hazırlanıyor" bilgisini
// bildirmek için bunu çağırıyor. N11 ileride "Shipped" desteği eklerse bu
// dosya ve orders.ts'teki çağrı noktası buna göre güncellenmeli.
export async function acknowledgeN11Order(lineIds: number[]): Promise<void> {
  await updateOrderStatus(lineIds);
}
