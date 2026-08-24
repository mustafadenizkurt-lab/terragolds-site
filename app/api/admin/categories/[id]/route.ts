import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { isSameOriginRequest } from "../../../../../lib/customer-auth";
import {
  parseCategoryInput,
  readProductCategories,
} from "../../../../../lib/product-categories";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: Request, context: RouteContext) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const id = parseId((await context.params).id);
  if (!id) {
    return Response.json({ error: "Geçersiz kategori." }, { status: 400 });
  }

  try {
    const category = parseCategoryInput(await request.json());
    const db = getD1();
    const current = await db
      .prepare("SELECT name FROM product_categories WHERE id = ? LIMIT 1")
      .bind(id)
      .first<{ name: string }>();
    if (!current) {
      return Response.json({ error: "Kategori bulunamadı." }, { status: 404 });
    }
    await db.batch([
      db
        .prepare(
          `UPDATE product_categories
           SET name = ?, description = ?, active = ?, sort_order = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(
          category.name,
          category.description,
          category.active ? 1 : 0,
          category.sortOrder,
          id,
        ),
      db
        .prepare(
          `UPDATE products
           SET category = ?, updated_at = CURRENT_TIMESTAMP
           WHERE category = ?`,
        )
        .bind(category.name, current.name),
    ]);
    return Response.json({
      categories: await readProductCategories(true),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Response.json(
      {
        error: message.toLowerCase().includes("unique")
          ? "Bu kategori adı zaten kullanılıyor."
          : message || "Kategori güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  const id = parseId((await context.params).id);
  if (!id) {
    return Response.json({ error: "Geçersiz kategori." }, { status: 400 });
  }
  const db = getD1();
  const current = await db
    .prepare(
      `SELECT product_categories.name, COUNT(products.id) AS product_count
       FROM product_categories
       LEFT JOIN products ON products.category = product_categories.name
       WHERE product_categories.id = ?
       GROUP BY product_categories.id`,
    )
    .bind(id)
    .first<{ name: string; product_count: number }>();
  if (!current) {
    return Response.json({ error: "Kategori bulunamadı." }, { status: 404 });
  }
  if (Number(current.product_count) > 0) {
    return Response.json(
      {
        error:
          "Bu kategoride ürün bulunuyor. Önce ürünleri başka kategoriye taşıyın.",
      },
      { status: 409 },
    );
  }
  await db.prepare("DELETE FROM product_categories WHERE id = ?").bind(id).run();
  return Response.json({ categories: await readProductCategories(true) });
}
