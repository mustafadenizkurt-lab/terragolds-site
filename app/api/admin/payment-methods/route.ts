import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import {
  ensureSavedPaymentMethodsTable,
  mapSavedPaymentMethod,
  type SavedPaymentMethodRow,
} from "../../../../lib/saved-payment-methods";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  await ensureSavedPaymentMethodsTable();
  const rows = await getD1()
    .prepare(
      `SELECT
          saved_payment_methods.*,
          TRIM(users.first_name || ' ' || users.last_name) AS customer_name,
          users.email AS customer_email
        FROM saved_payment_methods
        INNER JOIN users ON users.id = saved_payment_methods.user_id
        ORDER BY datetime(saved_payment_methods.created_at) DESC
        LIMIT 500`,
    )
    .all<SavedPaymentMethodRow>();

  return Response.json({
    paymentMethods: rows.results.map(mapSavedPaymentMethod),
  });
}
