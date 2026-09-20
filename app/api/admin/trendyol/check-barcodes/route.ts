import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { checkTrendyolBarcodes } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Teşhis aracı: refreshTrendyolImages()'daki AYNI aday listesinden ilk
// birkaç ürünü alıp, Trendyol'un kendi getProducts (barcode filtresiyle)
// servisinden gerçekten var/onaylı olup olmadığını kontrol eder - PUT/POST
// ve tam/kısmi payload denemelerinin hepsi aynı 404 hatasını verdiği için,
// sıradaki şüphe bu barkodların Trendyol'da hiç bulunmaması.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? "5") || 5;
    const results = await checkTrendyolBarcodes(getD1(), limit);
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
