import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const rows = await getD1()
    .prepare(
      "SELECT id, image_url AS imageUrl, caption, sort_order AS sortOrder FROM custom_production_photos ORDER BY sort_order, id",
    )
    .all<{ id: number; imageUrl: string; caption: string; sortOrder: number }>();
  return Response.json({ photos: rows.results });
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as {
    imageUrl?: string;
    caption?: string;
  };
  const imageUrl = String(body.imageUrl ?? "").trim();
  const caption = String(body.caption ?? "").trim().slice(0, 200);
  if (!imageUrl) {
    return Response.json({ error: "Görsel gereklidir." }, { status: 400 });
  }
  const db = getD1();
  const maxOrder = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS maxOrder FROM custom_production_photos")
    .first<{ maxOrder: number }>();
  await db
    .prepare(
      "INSERT INTO custom_production_photos (image_url, caption, sort_order) VALUES (?, ?, ?)",
    )
    .bind(imageUrl, caption, (maxOrder?.maxOrder ?? -1) + 1)
    .run();
  const rows = await db
    .prepare(
      "SELECT id, image_url AS imageUrl, caption, sort_order AS sortOrder FROM custom_production_photos ORDER BY sort_order, id",
    )
    .all<{ id: number; imageUrl: string; caption: string; sortOrder: number }>();
  return Response.json({ photos: rows.results }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Geçersiz fotoğraf." }, { status: 400 });
  }
  await getD1().prepare("DELETE FROM custom_production_photos WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
