import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { ensurePartnerColumns } from "../../../../../lib/partner-referral";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Geçersiz partner id'si." }, { status: 400 });
    }

    const body = (await request.json()) as { commissionRate?: unknown; isActive?: unknown };
    const db = getD1();
    await ensurePartnerColumns(db);

    if (body.commissionRate !== undefined) {
      const commissionRate = Number(body.commissionRate);
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
        return Response.json(
          { error: "Komisyon oranı 0 ile 100 arasında bir sayı olmalıdır." },
          { status: 400 },
        );
      }
      const result = await db
        .prepare(
          "UPDATE users SET commission_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'partner'",
        )
        .bind(commissionRate, id)
        .run();
      if (result.meta.changes === 0) {
        return Response.json({ error: "Partner bulunamadı." }, { status: 404 });
      }
      // Deliberately does NOT touch existing orders - each one already has
      // its own commission_rate_snapshot from the moment it was placed, so a
      // rate change here only ever applies to orders placed from now on.
    }

    if (body.isActive !== undefined) {
      const result = await db
        .prepare(
          "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND role = 'partner'",
        )
        .bind(body.isActive ? 1 : 0, id)
        .run();
      if (result.meta.changes === 0) {
        return Response.json({ error: "Partner bulunamadı." }, { status: 404 });
      }
      // Past commission/order history is untouched either way - deactivating
      // only stops new referral-code lookups and dashboard/login access
      // (see resolveCheckoutPartner / lib/partner-auth.ts).
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Partner güncellenemedi." },
      { status: 500 },
    );
  }
}
