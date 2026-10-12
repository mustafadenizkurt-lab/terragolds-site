import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getD1 } from "../../../../../lib/store-db";
import { reconcileStrayTrendyolListings } from "../../../../../lib/trendyol/sync";

export const dynamic = "force-dynamic";

// BKO10923 vakasında keşfedildi: admin panelinde 'draft'/'deleted' olan bir
// ürün Trendyol'da hâlâ gerçekten satışta kalabiliyordu (bkz. sync.ts'teki
// reconcileStrayTrendyolListings yorumu). ?apply=1 verilmezse sadece
// önizleme. ?batchSize= ile taranacak aday sayısı (varsayılan 200,
// getProductByBarcode'un hız limitine uysun diye) ayarlanabilir.
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const apply = searchParams.get("apply") === "1";
  const batchSize = Math.min(1000, Math.max(1, Number(searchParams.get("batchSize")) || 200));
  try {
    const result = await reconcileStrayTrendyolListings(getD1(), apply, batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Trendyol başıboş ilan denetimi başarısız." },
      { status: 500 },
    );
  }
}
