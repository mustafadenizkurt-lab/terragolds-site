import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { syncHepsiburadaOrders } from "../../../../../lib/hepsiburada/orders";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  const db = getD1();
  try {
    const result = await syncHepsiburadaOrders(db);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Hepsiburada siparişleri alınamadı.",
      },
      { status: 500 },
    );
  }
}
