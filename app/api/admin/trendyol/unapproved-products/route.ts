import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { getUnapprovedProducts, type TrendyolUnapprovedProduct } from "../../../../../lib/trendyol/client";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

const MAX_PAGES = 30; // güvenlik amaçlı üst sınır - beklenen hacim (~200-a few hundred) çok daha az sayfa gerektirir

// Salt-okunur teşhis: Trendyol'da reddedilmiş/onay bekleyen ürünleri
// rejectReason'a göre gruplayıp sayıyor - 200 ürünün marka/logo yüzünden
// pasife alındığı iddiasını doğrulamak ve bu ürünlerin barkod/görsel
// bilgisini D1'den çekmek için. Hiçbir şeyi değiştirmiyor, sadece listeliyor.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const { searchParams } = new URL(request.url);
    const filterText = (searchParams.get("reasonContains") ?? "").toLocaleLowerCase("tr-TR");
    const sampleLimit = Math.min(Number(searchParams.get("sample") ?? "30") || 30, 100);

    const all: TrendyolUnapprovedProduct[] = [];
    let page = 0;
    let totalPages = 1;
    while (page < totalPages && page < MAX_PAGES) {
      const result = await getUnapprovedProducts({ page, size: 200 });
      all.push(...result.content);
      totalPages = result.totalPages;
      page += 1;
    }

    const byReason = new Map<string, number>();
    for (const item of all) {
      const key = item.rejectReason || "(belirtilmemiş)";
      byReason.set(key, (byReason.get(key) ?? 0) + 1);
    }

    const matching = filterText
      ? all.filter(
          (item) =>
            item.rejectReason?.toLocaleLowerCase("tr-TR").includes(filterText) ||
            item.rejectReasonDetail?.toLocaleLowerCase("tr-TR").includes(filterText),
        )
      : all;

    const sample = matching.slice(0, sampleLimit);
    const db = getD1();
    const enriched = [];
    for (const item of sample) {
      const product = await db
        .prepare(
          "SELECT id, name, image, hover_image AS hoverImage FROM products WHERE trendyol_barcode = ? LIMIT 1",
        )
        .bind(item.barcode)
        .first<{ id: number; name: string; image: string; hoverImage: string | null }>();
      enriched.push({ ...item, localProduct: product ?? null });
    }

    return Response.json({
      totalUnapproved: all.length,
      pagesScanned: page,
      countsByReason: Object.fromEntries(byReason),
      matchingCount: matching.length,
      sample: enriched,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Onaysız ürünler alınamadı." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
