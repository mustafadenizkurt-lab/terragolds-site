import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { resubmitRejectedToN11 } from "../../../../../lib/n11/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// CatalogRejected ürünleri güncel kurallarla product-create ile yeniden
// gönderir (bkz. lib/n11/sync.ts > resubmitRejectedToN11 - ilk sürüm
// product-update kullanıyordu, gerçek denemede hepsi "SellerStockCode ile
// mağazanızda bir ürün bulunmamaktadır" hatası verdi çünkü N11 reddedilen
// ürünü kataloğundan tamamen kaldırıyor; create'e geçilince düzeldi).
// Varsayılan limit 1: her yeni kural/deney önce tek ürünle denenmeli.
// GET ile de tetiklenebiliyor (?limit=&stockCode=) - POST'u tarayıcı adres
// çubuğundan çalıştıramadığımız için, dynamic-pricing route'undaki
// GET/POST deseniyle aynı gerekçe.
async function run(request: Request, limit?: number, stockCode?: string) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    return Response.json(await resubmitRejectedToN11(getD1(), { limit, stockCode }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 yeniden gönderim başarısız." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  return run(
    request,
    limitParam ? Number(limitParam) : undefined,
    searchParams.get("stockCode") ?? undefined,
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    stockCode?: string;
  };
  return run(request, body.limit, body.stockCode);
}
