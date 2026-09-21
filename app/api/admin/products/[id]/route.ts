import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { parseProductInput } from "../../../../../lib/product-input";
import { resolveProductSlug } from "../../../../../lib/product-slugs";
import { ensureSeedData, getD1 } from "../../../../../lib/store-db";
import { pushInventoryToShopify } from "../../../../../lib/shopify/inventory";
import { excludeSupplierProducts } from "../../../../../lib/xml-sync/excluded-products";
import { pushStockAndPriceToTrendyol } from "../../../../../lib/trendyol/sync";
import { pushStockAndPriceToHepsiburada } from "../../../../../lib/hepsiburada/sync";

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
    await ensureSeedData();
    const db = getD1();
    const slug = await resolveProductSlug(db, product.name, id, product.slug);
    const result = await db
      .prepare(
        `UPDATE products
         SET name = ?, stone = ?, category = ?, price = ?, cost = ?, stock = ?,
             image = ?, hover_image = ?, badge = ?, campaign_label = ?, discount_percent = ?,
             description = ?, status = ?,
             shopier_url = ?, shopier_product_id = ?,
             shopier_sync_status = ?, slug = ?, meta_title = ?, meta_description = ?,
             featured = ?, sort_order = ?, is_daily_deal = ?, daily_deal_order = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      )
      .bind(
        product.name,
        product.stone,
        product.category,
        product.price,
        product.cost,
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
        product.isDailyDeal ? 1 : 0,
        product.dailyDealOrder,
        id,
      )
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    // D1 is the source of truth for stock - push this product's new count
    // to Shopify (a no-op if it isn't synced there yet).
    try {
      await pushInventoryToShopify(db, id);
    } catch {
      // Self-heals on the next stock change or scheduled sync.
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
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();

  const id = Number((await context.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Geçersiz ürün." }, { status: 400 });
  }

  const db = getD1();
  const product = await db
    .prepare(
      "SELECT xml_sync_status AS xmlSyncStatus, xml_supplier_id AS xmlSupplierId, xml_external_id AS xmlExternalId FROM products WHERE id = ?",
    )
    .bind(id)
    .first<{ xmlSyncStatus: string | null; xmlSupplierId: number | null; xmlExternalId: string | null }>();
  if (!product) {
    return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }

  // Bir tedarikçiye bağlı ürün silinirse (taslağa alınsa da gerçekten
  // silinse de), o ürünün kodu hariç tutma tablosuna eklenir - feed'de hâlâ
  // varsa bir sonraki senkron artık onu hiç yeniden oluşturmuyor/güncellemiyor
  // (bkz. lib/xml-sync/excluded-products.ts). Satır tamamen silinse bile bu
  // koruma kalıcı, çünkü ayrı bir tabloda tutuluyor.
  if (product.xmlSupplierId && product.xmlExternalId) {
    await excludeSupplierProducts(
      db,
      [{ supplierId: product.xmlSupplierId, externalId: product.xmlExternalId }],
      admin.id,
    );
  }

  // Silme/hariç tutma sadece D1'i güncelliyordu - ürün Trendyol/Hepsiburada'da
  // zaten listelenmişse, biz onu sildikten sonra da orada son bildirilen
  // stok/fiyatla görünmeye devam ediyor, kimse fark etmeden sipariş
  // alınabiliyordu. Satır silinmeden/taslağa alınmadan ÖNCE stoğu 0'a çekip
  // pazaryerlerine bildiriyoruz (push* fonksiyonları zaten "hiç
  // listelenmemişse no-op" davranışında, satırın hâlâ var olmasına ihtiyaç
  // duyuyorlar - bu yüzden sıra önemli).
  await db
    .prepare("UPDATE products SET stock = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(id)
    .run();
  try {
    await pushStockAndPriceToTrendyol(db, id);
  } catch {
    // Self-heals on the next stock change or a manual price/stock backfill.
  }
  try {
    await pushStockAndPriceToHepsiburada(db, id);
  } catch {
    // Self-heals on the next stock change or a manual price/stock backfill.
  }

  // A tedarikçi-senkron ürünü tamamen silinirse, o ürünün kodu feed'de hâlâ
  // varsa bir sonraki senkron onu "yeni ürün" sanıp sıfırdan yeniden
  // oluşturuyordu (syncSupplier.ts sadece (tedarikçi, ürün kodu) eşleşmesine
  // bakıyor, satır yoksa INSERT ediyor). Bunun yerine satırı taslağa alıp
  // xml_sync_status'u 'manual' yapıyoruz: syncSupplier.ts "synced" olmayan
  // satırlara hiç dokunmuyor, yani bu ürün bir daha asla geri gelmiyor ve
  // müşteriye de görünmüyor (status='draft'). Senkrona hiç bağlı olmayan
  // (elle eklenmiş) ürünlerde bu risk yok, onlar gerçekten siliniyor.
  if (product.xmlSyncStatus === "synced") {
    await db
      .prepare(
        "UPDATE products SET status = 'draft', xml_sync_status = 'manual', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .bind(id)
      .run();
    return Response.json({ ok: true });
  }

  const result = await db
    .prepare("DELETE FROM products WHERE id = ?")
    .bind(id)
    .run();

  if (!result.meta.changes) {
    return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  }
  return Response.json({ ok: true });
}
