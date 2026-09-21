import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { ensureTrendyolColumns } from "../../../../../lib/trendyol/client";

export const dynamic = "force-dynamic";

// Trendyol'da marka/logo/yasaklı kelime gibi sebeplerle pasife alınan
// ürünlerin görselini admin Trendyol panelinden elle düzeltiyor. Bu route
// o ürünü işaretleyip refreshTrendyolImages()'ın (ve benzer toplu görsel
// gönderme araçlarının) bir daha üzerine yazmasını engelliyor - D1'deki
// eski (tedarikçi kaynaklı, düzeltilmemiş) görsel hâlâ orada duruyor ama
// artık Trendyol'a tekrar gönderilmiyor. ?id= (bizim ürün id'miz) veya
// ?barcode= (Trendyol barkodu) ile çağrılabilir - admin panelinden Trendyol
// barkoduyla çalışmak genelde daha pratik. ?unlock=1 ile geri alınabilir.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const barcode = searchParams.get("barcode");
    const unlock = searchParams.get("unlock") === "1";
    if (!id && !barcode) {
      return Response.json({ error: "id veya barcode parametresi gerekli." }, { status: 400 });
    }
    if (id && (!Number.isInteger(Number(id)) || Number(id) <= 0)) {
      return Response.json({ error: "Geçersiz ürün id'si." }, { status: 400 });
    }

    const db = getD1();
    await ensureTrendyolColumns(db);
    const where = id ? "id = ?" : "trendyol_barcode = ?";
    const bindValue = id ? Number(id) : barcode;

    const result = await db
      .prepare(
        `UPDATE products SET trendyol_image_locked_at = ${unlock ? "NULL" : "CURRENT_TIMESTAMP"}, updated_at = CURRENT_TIMESTAMP WHERE ${where}`,
      )
      .bind(bindValue)
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }
    return Response.json({ ok: true, locked: !unlock });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "İşlem başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
