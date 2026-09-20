import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { backfillTrendyolContentIds } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Onaylı ürün fotoğraf güncellemesi (content-bulk-update) barcode değil
// contentId istiyor - bu D1'de hiç saklanmıyordu. Bu araç, Trendyol'un ürün
// filtreleme (v2) servisinden barkod başına contentId'yi bulup
// trendyol_content_id kolonuna yazar. Kademeli çalışır (varsayılan 200
// ürün/çağrı) - "remaining" 0 olana kadar tekrar tekrar açılmalı, sonra
// refresh-images çalıştırılabilir.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const batchSize = Math.min(Number(searchParams.get("batchSize") ?? "200") || 200, 500);
    const result = await backfillTrendyolContentIds(getD1(), batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "contentId doldurulamadı." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
