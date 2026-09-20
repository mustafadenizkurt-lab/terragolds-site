import { checkPaytrOrderStatus } from "./payment-gateways";
import { markOrderPaid } from "./order-payment";

type PaytrStatusResult = {
  status?: string;
  payment_amount?: string;
  returns?: unknown[];
};

export type PaytrReconcileResult = {
  checked: number;
  markedPaid: string[];
  errors: string[];
};

// Kübra Kurt siparişinde (TGMU5KS0M3282782) keşfedildi: PayTR'nin bildirim
// URL'si (callback) bazen bir siparişe hiç ulaşmıyor/işlenemiyor - müşteriden
// para gerçekten çekiliyor ama D1'de sipariş sonsuza kadar "pending" kalıyor,
// kimse fark etmeden ürün kargolanabiliyor veya hiç kargolanmayabiliyor.
// Callback tek güvenceydi, otomatik bir yeniden deneme/kontrol yoktu.
//
// Bu, "pending" kalmış YAKIN ZAMANLI PayTR siparişlerini PayTR'nin kendi
// "Durum Sorgu" servisiyle (checkPaytrOrderStatus) tarayıp, gerçekten
// başarılı+iadesiz bir ödeme varsa markOrderPaid() ile düzeltiyor. Cron'da
// diğer senkronlarla birlikte çalışır (bkz. worker/index.ts). Son 15 dakika
// içindekiler hariç tutuluyor - müşteri hâlâ ödeme ekranındayken durum
// sorgusu genelde "henüz yok" döner, gereksiz PayTR isteği atmayalım.
export async function reconcilePendingPaytrOrders(
  db: D1Database,
): Promise<PaytrReconcileResult> {
  const pending = await db
    .prepare(
      `SELECT id, total_amount FROM orders
       WHERE payment_provider = 'paytr' AND status = 'pending'
             AND created_at <= datetime('now', '-15 minutes')
             AND created_at >= datetime('now', '-14 days')
       ORDER BY created_at DESC LIMIT 50`,
    )
    .all<{ id: string; total_amount: number }>();

  const markedPaid: string[] = [];
  const errors: string[] = [];

  for (const order of pending.results) {
    try {
      const result = (await checkPaytrOrderStatus(order.id)) as PaytrStatusResult;
      // NOT: PayTR'nin durum sorgu servisindeki payment_amount TL cinsinden
      // dönüyor (ör. "600"), oysa D1'deki total_amount kuruş cinsinden
      // saklanıyor (60000) - bildirim URL'sindeki (callback) payment_amount
      // parametresiyle KARIŞTIRILMAMALI, o kuruş cinsinden (bkz.
      // app/api/payments/paytr/callback/route.ts, /100 YOK orada).
      if (
        result.status !== "success" ||
        (result.returns?.length ?? 0) > 0 ||
        Number(result.payment_amount) !== order.total_amount / 100
      ) {
        continue;
      }
      await markOrderPaid({ orderId: order.id, provider: "paytr", paymentId: `paytr-${order.id}` });
      markedPaid.push(order.id);
    } catch (error) {
      errors.push(`${order.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  return { checked: pending.results.length, markedPaid, errors };
}
