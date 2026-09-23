import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { reconcileN11Tasks } from "../../../../../lib/n11/reconcile";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    return Response.json(await reconcileN11Tasks(getD1()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "N11 sonuç doğrulaması başarısız." },
      { status: 500 },
    );
  }
}
