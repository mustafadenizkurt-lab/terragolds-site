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
      `SELECT product_reviews.id, product_reviews.rating, product_reviews.title,
              product_reviews.comment, product_reviews.created_at AS createdAt,
              products.id AS productId, products.name AS productName,
              users.first_name AS firstName, users.last_name AS lastName,
              users.email AS email
       FROM product_reviews
       INNER JOIN products ON products.id = product_reviews.product_id
       INNER JOIN users ON users.id = product_reviews.user_id
       ORDER BY product_reviews.created_at DESC
       LIMIT 300`,
    )
    .all<{
      id: number;
      rating: number;
      title: string;
      comment: string;
      createdAt: string;
      productId: number;
      productName: string;
      firstName: string;
      lastName: string;
      email: string;
    }>();

  return Response.json({ reviews: rows.results });
}

export async function DELETE(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Geçersiz yorum." }, { status: 400 });
  }

  const result = await getD1()
    .prepare("DELETE FROM product_reviews WHERE id = ?")
    .bind(id)
    .run();
  if (!result.meta.changes) {
    return Response.json({ error: "Yorum bulunamadı." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
