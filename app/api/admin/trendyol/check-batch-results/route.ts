import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { checkTrendyolBatchResults } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// check-barcodes'ın kullandığı getProducts() (v1 /product/sellers/{id}/products)
// Trendyol'un planlı brownout'u yüzünden 426 döndü - bu yüzden ürünlerin
// Trendyol'da gerçekten onaylı olup olmadığını, gönderim sırasında alınan
// batchRequestId'yi (trendyol_listing_id) getBatchRequestResult ile
// sorgulayarak kontrol eden ikinci bir teşhis aracı.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "3") || 3;
    const results = await checkTrendyolBatchResults(getD1(), limit);
    return Response.json({ results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Kontrol edilemedi." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
