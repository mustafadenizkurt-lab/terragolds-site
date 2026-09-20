import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { checkPaytrOrderStatus } from "../../../../../lib/payment-gateways";

export const dynamic = "force-dynamic";

// Teşhis: PayTR'nin bildirim URL'si (callback) bir siparişe hiç
// ulaşmamış/işlenememiş olabilir - D1'de sipariş "pending" görünse de
// müşteriden gerçekten para çekilmiş olabilir. Bu, PayTR'nin kendi "Durum
// Sorgu" servisinden o siparişin GERÇEK ödeme durumunu çeker.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId")?.trim();
  if (!orderId) {
    return Response.json({ error: "orderId parametresi gerekli." }, { status: 400 });
  }
  try {
    const result = await checkPaytrOrderStatus(orderId);
    return Response.json({ orderId, result });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "PayTR sorgusu başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
