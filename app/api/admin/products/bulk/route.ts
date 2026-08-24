import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

type BulkAction =
  | "publish"
  | "draft"
  | "increase-stock"
  | "set-discount"
  | "clear-discount"
  | "set-category"
  | "feature"
  | "unfeature";

const actions = new Set<BulkAction>([
  "publish",
  "draft",
  "increase-stock",
  "set-discount",
  "clear-discount",
  "set-category",
  "feature",
  "unfeature",
]);

export async function PATCH(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productIds = Array.isArray(body.productIds)
      ? [
          ...new Set(
            body.productIds
              .map(Number)
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        ].slice(0, 150)
      : [];
    const action = String(body.action ?? "") as BulkAction;
    const value = Number(body.value ?? 0);
    const label = String(body.label ?? "").trim().slice(0, 80);
    const category = String(body.category ?? "").trim().slice(0, 80);

    if (!productIds.length || !actions.has(action)) {
      return Response.json({ error: "Ürün ve işlem seçimi gereklidir." }, { status: 400 });
    }

    let assignment = "";
    const values: Array<string | number> = [];
    if (action === "publish") assignment = "status = 'published'";
    if (action === "draft") assignment = "status = 'draft'";
    if (action === "feature") assignment = "featured = 1";
    if (action === "unfeature") assignment = "featured = 0";
    if (action === "clear-discount") {
      assignment = "discount_percent = 0, campaign_label = NULL";
    }
    if (action === "increase-stock") {
      if (!Number.isInteger(value) || value < -1000 || value > 1000 || value === 0) {
        return Response.json(
          { error: "Stok değişimi -1000 ile 1000 arasında olmalıdır." },
          { status: 400 },
        );
      }
      assignment = "stock = MAX(0, stock + ?)";
      values.push(value);
    }
    if (action === "set-discount") {
      if (!Number.isInteger(value) || value < 1 || value > 90) {
        return Response.json(
          { error: "İndirim oranı %1–90 arasında olmalıdır." },
          { status: 400 },
        );
      }
      assignment = "discount_percent = ?, campaign_label = ?";
      values.push(value, label || "İndirim Fırsatı");
    }
    if (action === "set-category") {
      if (!category) {
        return Response.json(
          { error: "Taşınacak kategori seçilmelidir." },
          { status: 400 },
        );
      }
      const categoryExists = await getD1()
        .prepare(
          `SELECT id FROM product_categories
           WHERE name = ? AND active = 1
           LIMIT 1`,
        )
        .bind(category)
        .first<{ id: number }>();
      if (!categoryExists) {
        return Response.json(
          { error: "Seçilen kategori bulunamadı veya kullanım dışı." },
          { status: 400 },
        );
      }
      assignment = "category = ?";
      values.push(category);
    }

    const placeholders = productIds.map(() => "?").join(", ");
    const result = await getD1()
      .prepare(
        `UPDATE products
         SET ${assignment}, updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
      )
      .bind(...values, ...productIds)
      .run();

    return Response.json({ ok: true, updated: result.meta.changes });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Toplu işlem tamamlanamadı.",
      },
      { status: 400 },
    );
  }
}
