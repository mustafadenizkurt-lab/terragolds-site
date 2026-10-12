import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { auditHepsiburadaStock } from "../../../../../lib/hepsiburada/sync";
import { pushStockAndPriceToTrendyol } from "../../../../../lib/trendyol/sync";
import { pushStockAndPriceToN11 } from "../../../../../lib/n11/sync";

export const dynamic = "force-dynamic";

// Hepsiburada'nın GERÇEK (canlı) listeleme API'sinden okuduğu stok, D1'deki
// stock ile karşılaştırılır. En sık görülen uyumsuzluk: Hepsiburada 0
// (tükendi/pasif) diyor ama D1 hâlâ pozitif bir sayı tutuyor - genellikle
// tedarikçi feed'ine hiç bağlı olmayan ("manual") ürünlerde, çünkü
// otomatik stok senkronu bunları hiç izlemiyor (bkz. restockSupplierProducts
// - sadece xml_supplier_id+external_id eşleşen satırları kapsıyor).
// ?apply=1 verilmezse sadece önizleme - D1'e hiçbir yazma yapılmaz.
// ?apply=1 ile: SADECE Hepsiburada'nın 0 dediği ama D1'in pozitif tuttuğu
// satırlar D1'de 0'a çekilir ve Trendyol/N11'e de aynı stok bildirilir -
// fiziksel gerçeklik tek, ürün hangi kanaldan satılırsa satılsın aynı anda
// tükenmiş demektir.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const apply = searchParams.get("apply") === "1";
  try {
    const db = getD1();
    const result = await auditHepsiburadaStock(db, apply);
    // D1'de 0'a çekilen satırlar Hepsiburada'da zaten 0 - aynı fiziksel
    // ürün Trendyol/N11'de de satışta kalmasın diye oraya da bildiriliyor
    // (restockSupplierProducts'taki pushStockEverywhere ile aynı fikir).
    if (apply) {
      for (const entry of result.outOfStockAtHepsiburada) {
        try {
          await pushStockAndPriceToTrendyol(db, entry.id);
        } catch {
          // Self-heals on the next stock change or a manual price/stock backfill.
        }
        try {
          await pushStockAndPriceToN11(db, entry.id);
        } catch {
          // Self-heals on the next stock change or a manual price/stock backfill.
        }
      }
    }
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Hepsiburada stok denetimi başarısız." },
      { status: 500 },
    );
  }
}
