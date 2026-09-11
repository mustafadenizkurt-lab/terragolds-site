import { getAuthorizedPartner, unauthorizedPartnerResponse } from "../../../../lib/partner-auth";
import { COMMISSION_ELIGIBLE_STATUSES, ensurePartnerColumns } from "../../../../lib/partner-referral";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

const eligibleStatusList = COMMISSION_ELIGIBLE_STATUSES.map((status) => `'${status}'`).join(", ");

export async function GET(request: Request) {
  // partnerId comes only from the verified session (getAuthorizedPartner
  // reads the signed customer-session cookie and checks role in D1) -
  // never from any request parameter, so a partner cannot pass another
  // partner's id to see their data.
  const partner = await getAuthorizedPartner(request);
  if (!partner) return unauthorizedPartnerResponse();

  try {
    const db = getD1();
    await ensurePartnerColumns(db);

    const customerCount = await db
      .prepare("SELECT COUNT(*) AS c FROM users WHERE referred_by = ?")
      .bind(partner.id)
      .first<{ c: number }>();

    const orderStats = await db
      .prepare(
        `SELECT
            COUNT(*) AS orderCount,
            COALESCE(SUM(CASE WHEN status IN (${eligibleStatusList}) THEN total_amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN status IN (${eligibleStatusList}) AND commission_status = 'earned' THEN commission_amount ELSE 0 END), 0) AS commissionTotal
          FROM orders
          WHERE referred_by_partner_id = ?`,
      )
      .bind(partner.id)
      .first<{ orderCount: number; revenue: number; commissionTotal: number }>();

    const payoutTotalRow = await db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM partner_payouts WHERE partner_id = ?")
      .bind(partner.id)
      .first<{ total: number }>();

    const commissionTotal = orderStats?.commissionTotal ?? 0;
    const payoutTotal = payoutTotalRow?.total ?? 0;

    return Response.json({
      referralCode: partner.referralCode,
      commissionRate: partner.commissionRate,
      customerCount: customerCount?.c ?? 0,
      orderCount: orderStats?.orderCount ?? 0,
      revenue: orderStats?.revenue ?? 0,
      commissionTotal,
      payoutTotal,
      pendingTotal: Math.max(0, commissionTotal - payoutTotal),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Panel verileri alınamadı." },
      { status: 500 },
    );
  }
}
