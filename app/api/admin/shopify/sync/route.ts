import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { syncProductsToShopify } from "../../../../../lib/shopify/sync";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  const body = (await request.json().catch(() => ({}))) as {
    batchSize?: number;
  };
  const batchSize = Math.min(100, Math.max(1, Number(body.batchSize) || 25));
  try {
    const result = await syncProductsToShopify(db, batchSize);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Shopify senkronu başarısız.",
      },
      { status: 500 },
    );
  }
}
