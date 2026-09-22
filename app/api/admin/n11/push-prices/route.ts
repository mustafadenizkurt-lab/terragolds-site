import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { pushPendingN11Prices } from "../../../../../lib/n11/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
  };
  const batchSize = Math.min(1000, Math.max(1, Number(body.batchSize) || 100));
  try {
    const result = await pushPendingN11Prices(db, batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "N11 fiyat güncellemesi başarısız.",
      },
      { status: 500 },
    );
  }
}
