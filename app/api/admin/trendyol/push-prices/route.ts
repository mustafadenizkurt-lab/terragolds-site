import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { pushPendingTrendyolPrices } from "../../../../../lib/trendyol/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

async function handle(batchSize: number) {
  const db = getD1();
  try {
    const result = await pushPendingTrendyolPrices(db, batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Trendyol fiyat güncellemesi başarısız.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
  };
  const batchSize = Math.min(1000, Math.max(1, Number(body.batchSize) || 1000));
  return handle(batchSize);
}

// GET de kabul ediyor - tarayıcı adres çubuğundan doğrudan tetiklenebilsin
// diye (bu oturumdaki diğer tek seferlik araçlarla aynı desen).
export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(1000, Math.max(1, Number(searchParams.get("batchSize")) || 1000));
  return handle(batchSize);
}
