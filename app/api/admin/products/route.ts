import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../lib/admin-auth";
import { parseProductInput } from "../../../../lib/product-input";
import { getD1, readProducts } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    return Response.json({ products: await readProducts(true) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ürünler alınamadı.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const product = parseProductInput(await request.json());
    const db = getD1();
    const created = await db
      .prepare(
        `INSERT INTO products
          (name, stone, category, price, stock, image, hover_image, badge,
           campaign_label, discount_percent, description,
           status, shopier_url, shopier_product_id, shopier_sync_status,
           featured, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         RETURNING id`,
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
        product.featured ? 1 : 0,
        product.sortOrder,
      )
      .first<{ id: number }>();

    return Response.json({ id: created?.id }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Ürün kaydedilemedi.",
      },
      { status: 400 },
    );
  }
}
