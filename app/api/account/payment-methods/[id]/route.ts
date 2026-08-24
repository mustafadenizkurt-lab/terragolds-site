import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../../lib/customer-auth";
import { ensureSavedPaymentMethodsTable } from "../../../../../lib/saved-payment-methods";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();

  const { id } = await context.params;
  const paymentMethodId = Number(id);
  if (!Number.isInteger(paymentMethodId) || paymentMethodId <= 0) {
    return Response.json({ error: "Geçerli bir kart seçin." }, { status: 400 });
  }

  await ensureSavedPaymentMethodsTable();
  await getD1()
    .prepare("DELETE FROM saved_payment_methods WHERE id = ? AND user_id = ?")
    .bind(paymentMethodId, user.id)
    .run();

  return Response.json({ ok: true });
}
