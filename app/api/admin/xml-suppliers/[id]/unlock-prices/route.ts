import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../../lib/admin-auth";
import { getD1 } from "../../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Tek seferlik, açıkça talep edilen temizlik: bu tedarikçi için kalan tüm
// price_locked_at kilitlerini ve excluded_supplier_products kayıtlarını
// kaldırır ki sıradaki reprice çağrısı tedarikçinin güncel fiyatını TÜM
// ürünlere uygulayabilsin. "Her Şey 50 TL" kampanyası kaldırıldıktan sonra
// kalan kilitli ürünler bu yüzden eklendi (bkz. lib/product-price-lock.ts).
async function handle(
  request: Request,
  context: { params: Promise<Record<string, string | string[]>> },
) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Geçersiz tedarikçi id'si." }, { status: 400 });
    }
    const db = getD1();
    const unlocked = await db
      .prepare(
        "UPDATE products SET price_locked_at = NULL WHERE xml_supplier_id = ? AND price_locked_at IS NOT NULL",
      )
      .bind(id)
      .run();
    const unexcluded = await db
      .prepare("DELETE FROM excluded_supplier_products WHERE supplier_id = ?")
      .bind(id)
      .run();
    return Response.json({
      unlockedCount: unlocked.meta.changes,
      unexcludedCount: unexcluded.meta.changes,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kilitler kaldırılamadı." },
      { status: 500 },
    );
  }
}

export const POST = handle;
export const GET = handle;
