import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { scanTrendyolArchivedProducts } from "../../../../../lib/trendyol/archived-scan";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Cron'da her 6 saatte bir otomatik çalışıyor (worker/index.ts) - bu route
// beklemeden hemen tetiklemek isteyenler için.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const result = await scanTrendyolArchivedProducts(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Tarama başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
