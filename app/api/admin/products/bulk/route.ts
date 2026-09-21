import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { pushInventoryToShopify } from "../../../../../lib/shopify/inventory";
import { excludeSupplierProducts } from "../../../../../lib/xml-sync/excluded-products";

export const dynamic = "force-dynamic";

type BulkAction =
  | "publish"
  | "draft"
  | "increase-stock"
  | "set-discount"
  | "clear-discount"
  | "set-category"
  | "feature"
  | "unfeature"
  | "delete";

const actions = new Set<BulkAction>([
  "publish",
  "draft",
  "increase-stock",
  "set-discount",
  "clear-discount",
  "set-category",
  "feature",
  "unfeature",
  "delete",
]);

export async function PATCH(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

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

    if (action === "delete") {
      const db = getD1();
      const placeholders = productIds.map(() => "?").join(", ");

      // Tek ürün DELETE route'uyla (app/api/admin/products/[id]/route.ts)
      // aynı mantık: tedarikçiye bağlı olanların kodu hariç tutma tablosuna
      // eklenir - feed'de hâlâ varsa bir sonraki senkron artık onu hiç
      // yeniden oluşturmuyor/güncellemiyor (bkz.
      // lib/xml-sync/excluded-products.ts), satır taslağa alınsa da
      // gerçekten silinse de bu koruma kalıcı kalır.
      const toExclude = await db
        .prepare(
          `SELECT xml_supplier_id AS supplierId, xml_external_id AS externalId
           FROM products WHERE id IN (${placeholders})
             AND xml_supplier_id IS NOT NULL AND xml_external_id IS NOT NULL`,
        )
        .bind(...productIds)
        .all<{ supplierId: number; externalId: string }>();
      await excludeSupplierProducts(db, toExclude.results, admin.id);

      // Senkron ürünü (xml_sync_status = 'synced') gerçekten silinirse,
      // kodu tedarikçi feed'inde hâlâ varsa bir sonraki senkronda sıfırdan
      // geri geliyordu - taslağa alıp 'manual' işaretle, syncSupplier bir
      // daha hiç dokunmasın. Elle eklenmiş ürünler (senkrona bağlı olmayan)
      // gerçekten siliniyor.
      const excluded = await db
        .prepare(
          `UPDATE products SET status = 'draft', xml_sync_status = 'manual', updated_at = CURRENT_TIMESTAMP
           WHERE id IN (${placeholders}) AND xml_sync_status = 'synced'`,
        )
        .bind(...productIds)
        .run();
      const deleted = await db
        .prepare(
          `DELETE FROM products WHERE id IN (${placeholders}) AND (xml_sync_status IS NULL OR xml_sync_status != 'synced')`,
        )
        .bind(...productIds)
        .run();
      return Response.json({
        ok: true,
        updated: excluded.meta.changes + deleted.meta.changes,
      });
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

    if (action === "increase-stock") {
      // D1 is the source of truth for stock - push each affected product's
      // new count to Shopify (a no-op for ones not synced there yet).
      for (const productId of productIds) {
        try {
          await pushInventoryToShopify(getD1(), productId);
        } catch {
          // Self-heals on the next stock change or scheduled sync.
        }
      }
    }

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
