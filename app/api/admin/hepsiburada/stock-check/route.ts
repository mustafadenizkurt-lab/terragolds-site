import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { auditHepsiburadaStock } from "../../../../../lib/hepsiburada/sync";
import { reconcileHepsiburadaStock } from "../../../../../lib/xml-sync/syncSupplier";

export const dynamic = "force-dynamic";

// Hepsiburada'nın GERÇEK (canlı) listeleme API'sinden okuduğu stok, D1'deki
// stock ile karşılaştırılır. En sık görülen uyumsuzluk: Hepsiburada 0
// (tükendi/pasif) diyor ama D1 hâlâ pozitif bir sayı tutuyor - genellikle
// tedarikçi feed'ine hiç bağlı olmayan ("manual") ürünlerde, çünkü
// otomatik stok senkronu bunları hiç izlemiyor (bkz. restockSupplierProducts
// - sadece xml_supplier_id+external_id eşleşen satırları kapsıyor).
// ?apply=1 verilmezse sadece önizleme - D1'e hiçbir yazma yapılmaz.
// ?apply=1 ile: reconcileHepsiburadaStock (artık 6 saatlik cron'da da
// otomatik çalışıyor, bkz. worker/index.ts) SADECE Hepsiburada'nın 0 dediği
// ama D1'in pozitif tuttuğu satırları D1'de 0'a çeker ve Trendyol/N11'e de
// aynı stoğu bildirir.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const apply = searchParams.get("apply") === "1";
  try {
    const db = getD1();
    const result = apply
      ? await reconcileHepsiburadaStock(db)
      : await auditHepsiburadaStock(db, false);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Hepsiburada stok denetimi başarısız." },
      { status: 500 },
    );
  }
}
