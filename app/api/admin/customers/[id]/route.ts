import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  }
  if (id === admin.id) {
    return Response.json(
      { error: "Kendi hesabınızı buradan silemezsiniz." },
      { status: 400 },
    );
  }

  const db = getD1();
  const customer = await db
    .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
    .bind(id)
    .first<{ id: number }>();
  if (!customer) {
    return Response.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  }

  const orderCount = await db
    .prepare("SELECT COUNT(*) AS total FROM orders WHERE user_id = ?")
    .bind(id)
    .first<{ total: number }>();
  if ((orderCount?.total ?? 0) > 0) {
    return Response.json(
      {
        error:
          "Bu müşterinin sipariş geçmişi var, bu yüzden silinemez. Sipariş kayıtlarının bütünlüğünü korumak için siparişi olan hesaplar silinemiyor.",
      },
      { status: 409 },
    );
  }

  // No orders: password_reset_tokens/email_verification_tokens/
  // saved_payment_methods cascade-delete via their user_id FK, and
  // product_favorites/site_content.updated_by/etc. fall back to
  // user_id/updated_by = NULL - both safe with zero order history.
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();

  return Response.json({ ok: true });
}
