import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { parseProductInput } from "../../../../../lib/product-input";
import { resolveProductSlug } from "../../../../../lib/product-slugs";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0) {
      return Response.json({ error: "Geçersiz ürün." }, { status: 400 });
    }

    const product = parseProductInput(await request.json());
    const db = getD1();
    const slug = await resolveProductSlug(db, product.name, id, product.slug);
    const result = await db
      .prepare(
        `UPDATE products
         SET name = ?, stone = ?, category = ?, price = ?, stock = ?,
             image = ?, hover_image = ?, badge = ?, campaign_label = ?, discount_percent = ?,
             description = ?, status = ?,
             shopier_url = ?, shopier_product_id = ?,
             shopier_sync_status = ?, slug = ?, meta_title = ?, meta_description = ?,
             featured = ?, sort_order = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        product.name,
        product.stone,
        product.category,
        product.price,
        product.stock,
        product.image,
        product.hoverImage ?? null,
        product.badge ?? null,
        product.campaignLabel ?? null,
        product.discountPercent,
        product.description,
        product.status,
        product.shopierUrl ?? null,
        product.shopierProductId ?? null,
        product.shopierSyncStatus,
        slug,
        product.metaTitle ?? null,
        product.metaDescription ?? null,
        product.featured ? 1 : 0,
        product.sortOrder,
        id,
      )
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ürün güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Geçersiz ürün." }, { status: 400 });
  }

  const result = await getD1()
    .prepare("DELETE FROM products WHERE id = ?")
    .bind(id)
    .run();

  if (!result.meta.changes) {
    return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
