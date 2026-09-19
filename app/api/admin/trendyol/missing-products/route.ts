import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getProducts } from "../../../../../lib/trendyol/client";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Teşhis aracı: syncProductsToTrendyol() bir batchRequestId kabul edildiği an
// "başarılı" sayıp D1'e trendyol_listing_id yazıyor - ama Trendyol batch'i
// async işliyor, partinin İÇİNDEKİ tek tek ürünlerin gerçekten oluşup
// oluşmadığını garanti etmiyor. Satıcı panelindeki gerçek ürün sayısı bizim
// D1'deki "senkronlandı" sayısından düşük çıktı (Trendyol'un kendi
// getBatchRequestResult endpoint'i de tutarsız bir doğrulama hatasıyla
// sorgulanamadı) - bu yüzden gerçek kaynağa (Trendyol'un GERÇEKTEN sahip
// olduğu barkod listesi, getProducts ile sayfalanarak TÜMÜ) gidip bizim
// "senkronlandı" dediğimiz barkod listesiyle karşılaştırıyoruz.
async function fetchAllTrendyolBarcodes(): Promise<Set<string>> {
  const barcodes = new Set<string>();
  const size = 200;
  let page = 0;
  for (;;) {
    const result = await getProducts({ page, size });
    for (const product of result.content) {
      if (product.barcode) barcodes.add(product.barcode);
    }
    page += 1;
    if (page >= result.totalPages || result.content.length === 0) break;
  }
  return barcodes;
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  const db = getD1();
  const local = await db
    .prepare(
      `SELECT id, name, trendyol_barcode AS barcode FROM products
       WHERE status = 'published' AND trendyol_listing_id IS NOT NULL
             AND trendyol_barcode IS NOT NULL`,
    )
    .all<{ id: number; name: string; barcode: string }>();

  try {
    const trendyolBarcodes = await fetchAllTrendyolBarcodes();
    const missing = local.results.filter(
      (product) => !trendyolBarcodes.has(product.barcode),
    );

    return Response.json({
      localSyncedCount: local.results.length,
      trendyolProductCount: trendyolBarcodes.size,
      missingCount: missing.length,
      missing,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Trendyol isteği başarısız.",
      },
      { status: 400 },
    );
  }
}
