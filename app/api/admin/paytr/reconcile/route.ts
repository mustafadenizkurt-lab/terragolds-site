import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../../lib/admin-auth";
import { reconcilePendingPaytrOrders } from "../../../../../lib/paytr-reconcile";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

// Artık cron'da (worker/index.ts) her 6 saatte bir otomatik çalışıyor -
// bu route, beklemeden hemen tetiklemek isteyenler için.
async function handle(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const result = await reconcilePendingPaytrOrders(getD1());
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "PayTR uzlaştırması başarısız." },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
