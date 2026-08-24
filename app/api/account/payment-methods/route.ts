import {
  customerUnauthorizedResponse,
  getCustomerFromRequest,
  isSameOriginRequest,
} from "../../../../lib/customer-auth";
import {
  ensureSavedPaymentMethodsTable,
  mapSavedPaymentMethod,
  normalizePaymentMethodInput,
  type SavedPaymentMethodRow,
} from "../../../../lib/saved-payment-methods";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();

  await ensureSavedPaymentMethodsTable();
  const rows = await getD1()
    .prepare(
      `SELECT *
        FROM saved_payment_methods
        WHERE user_id = ?
        ORDER BY is_default DESC, datetime(created_at) DESC`,
    )
    .bind(user.id)
    .all<SavedPaymentMethodRow>();

  return Response.json({
    paymentMethods: rows.results.map(mapSavedPaymentMethod),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const user = await getCustomerFromRequest(request);
  if (!user) return customerUnauthorizedResponse();

  try {
    const input = normalizePaymentMethodInput(
      (await request.json()) as Record<string, unknown>,
    );
    await ensureSavedPaymentMethodsTable();
    const db = getD1();

    if (input.isDefault) {
      await db
        .prepare("UPDATE saved_payment_methods SET is_default = 0 WHERE user_id = ?")
        .bind(user.id)
        .run();
    }

    const existing = await db
      .prepare(
        "SELECT COUNT(*) AS total FROM saved_payment_methods WHERE user_id = ?",
      )
      .bind(user.id)
      .first<{ total: number }>();

    await db
      .prepare(
        `INSERT INTO saved_payment_methods
          (user_id, provider, provider_payment_method_id, cardholder_name,
           brand, last4, exp_month, exp_year, is_default, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(
        user.id,
        input.provider,
        input.providerPaymentMethodId,
        input.cardholderName,
        input.brand,
        input.last4,
        input.expMonth,
        input.expYear,
        input.isDefault || !existing?.total ? 1 : 0,
      )
      .run();

    const rows = await db
      .prepare(
        `SELECT *
          FROM saved_payment_methods
          WHERE user_id = ?
          ORDER BY is_default DESC, datetime(created_at) DESC`,
      )
      .bind(user.id)
      .all<SavedPaymentMethodRow>();

    return Response.json(
      { paymentMethods: rows.results.map(mapSavedPaymentMethod) },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Kart kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
