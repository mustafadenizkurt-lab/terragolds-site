import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import {
  ensurePartnerColumns,
  listPartnerPayouts,
  recordPartnerPayout,
} from "../../../../../../lib/partner-referral";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

function readId(context: { params: Promise<Record<string, string | string[]>> }) {
  return context.params.then((params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) throw new Error("Geçersiz partner id'si.");
    return id;
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const id = await readId(context);
    const payouts = await listPartnerPayouts(getD1(), id);
    return Response.json({ payouts: payouts.results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ödeme geçmişi alınamadı." },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

  try {
    const id = await readId(context);
    const body = (await request.json()) as { amountTl?: unknown; note?: unknown };
    const amountTl = Number(body.amountTl);
    if (!Number.isFinite(amountTl) || amountTl <= 0) {
      return Response.json({ error: "Geçerli bir tutar girin." }, { status: 400 });
    }
    const note = String(body.note ?? "").trim().slice(0, 300);

    const db = getD1();
    await ensurePartnerColumns(db);
    const partner = await db
      .prepare("SELECT id FROM users WHERE id = ? AND role = 'partner'")
      .bind(id)
      .first<{ id: number }>();
    if (!partner) return Response.json({ error: "Partner bulunamadı." }, { status: 404 });

    await recordPartnerPayout(db, {
      partnerId: id,
      amount: Math.round(amountTl * 100),
      note,
      createdBy: admin.id,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Ödeme kaydedilemedi." },
      { status: 400 },
    );
  }
}
