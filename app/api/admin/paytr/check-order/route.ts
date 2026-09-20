import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { checkPaytrOrderStatus } from "../../../../../lib/payment-gateways";
import { markOrderPaid } from "../../../../../lib/order-payment";

export const dynamic = "force-dynamic";

type PaytrStatusResult = {
  status?: string;
  payment_amount?: string;
  test_mode?: string;
  returns?: unknown[];
};

// Teşhis: PayTR'nin bildirim URL'si (callback) bir siparişe hiç
// ulaşmamış/işlenememiş olabilir - D1'de sipariş "pending" görünse de
// müşteriden gerçekten para çekilmiş olabilir. Bu, PayTR'nin kendi "Durum
// Sorgu" servisinden o siparişin GERÇEK ödeme durumunu çeker.
//
// ?markPaid=1 verilirse ve PayTR gerçekten "success" + iadesiz bir ödeme
// gösteriyorsa (Kübra Kurt siparişi TGMU5KS0M3282782'de doğrulandığı gibi -
// callback hiç ulaşmamış ama para gerçekten çekilmiş), markOrderPaid()
// çağrılıp sipariş normal ödeme akışıyla aynı şekilde (stok düşümü, sadakat
// puanı dahil) "paid" olarak işaretlenir.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim();
  const markPaid = searchParams.get("markPaid") === "1";
  if (!orderId) {
    return Response.json({ error: "orderId parametresi gerekli." }, { status: 400 });
  }
  try {
    const result = (await checkPaytrOrderStatus(orderId)) as PaytrStatusResult;
    if (!markPaid) return Response.json({ orderId, result });

    if (result.status !== "success" || (result.returns?.length ?? 0) > 0) {
      return Response.json(
        { orderId, result, marked: false, error: "PayTR başarılı/iadesiz bir ödeme göstermiyor - işaretlenmedi." },
        { status: 409 },
      );
    }
    await markOrderPaid({ orderId, provider: "paytr", paymentId: `paytr-${orderId}` });
    return Response.json({ orderId, result, marked: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "PayTR sorgusu başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
