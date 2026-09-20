import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { syncTrendyolOrders } from "../../../../../lib/trendyol/orders";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  try {
    const result = await syncTrendyolOrders(db);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trendyol siparişleri alınamadı.",
      },
      { status: 500 },
    );
  }
}

// Admin panelinde bu senkronu tetikleyen bir buton yoktu ve cron'a hiç
// bağlanmamıştı - yani Trendyol'dan gelen bir sipariş, biri elle bu
// endpoint'e POST atmadıkça asla D1'e (ve dolayısıyla admin panele)
// düşmüyordu. GET eklendi ki mobil tarayıcıdan da tetiklenebilsin - ayrıca
// artık worker/index.ts'deki cron'a da bağlandı (bkz. orada).
export const GET = handle;
export const POST = handle;
