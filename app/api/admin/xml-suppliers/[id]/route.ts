import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

async function idFrom(context: { params: Promise<Record<string, string | string[]>> }) {
  return Number((await context.params).id);
}

export async function PUT(request: Request, context: { params: Promise<Record<string, string | string[]>> }) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const id = await idFrom(context);
    const body = await request.json() as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const feedUrl = String(body.feedUrl ?? "").trim();
    if (!Number.isInteger(id) || id < 1 || !name || !feedUrl) return Response.json({ error: "Geçerli tedarikçi bilgileri girilmelidir." }, { status: 400 });
    new URL(feedUrl);
    await getD1().prepare(
      "UPDATE xml_suppliers SET name = ?, feed_url = ?, field_mapping = ?, filters = ?, default_markup_percent = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(name, feedUrl, JSON.stringify(body.fieldMapping ?? {}), JSON.stringify(body.filters ?? {}), Math.max(0, Number(body.defaultMarkupPercent) || 0), body.active === false ? 0 : 1, id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Tedarikçi güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<Record<string, string | string[]>> }) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const id = await idFrom(context);
  await getD1().prepare("DELETE FROM xml_suppliers WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}