import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../lib/admin-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const result = await getD1().prepare(
    "SELECT id, name, feed_url AS feedUrl, field_mapping AS fieldMapping, filters, default_markup_percent AS defaultMarkupPercent, active, last_synced_at AS lastSyncedAt, created_at AS createdAt, updated_at AS updatedAt FROM xml_suppliers ORDER BY name",
  ).all();
  return Response.json({ suppliers: result.results });
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const feedUrl = String(body.feedUrl ?? "").trim();
    if (!name || !feedUrl) return Response.json({ error: "Tedarikçi adı ve XML URL'si zorunludur." }, { status: 400 });
    new URL(feedUrl);
    const created = await getD1().prepare(
      "INSERT INTO xml_suppliers (name, feed_url, field_mapping, filters, default_markup_percent, active) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    ).bind(name, feedUrl, JSON.stringify(body.fieldMapping ?? {}), JSON.stringify(body.filters ?? {}), Math.max(0, Number(body.defaultMarkupPercent) || 0), body.active === false ? 0 : 1).first<{ id: number }>();
    return Response.json({ id: created?.id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tedarikçi kaydedilemedi." }, { status: 400 });
  }
}