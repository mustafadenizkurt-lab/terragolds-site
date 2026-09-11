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

    const body = (await request.json()) as { commissionRate?: unknown };
    const commissionRate = Number(body.commissionRate);
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
      return Response.json(
        { error: "Komisyon oranı 0 ile 100 arasında bir sayı olmalıdır." },
        { status: 400 },
      );
    }

    const db = getD1();
    await ensurePartnerColumns(db);
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
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Partner güncellenemedi." },
      { status: 500 },
    );
  }
}
