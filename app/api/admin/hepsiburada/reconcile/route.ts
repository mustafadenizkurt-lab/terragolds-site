import { getAuthorizedAdmin, unauthorizedAdminResponse } from "../../../../../lib/admin-auth";
import { reconcileHepsiburadaImports } from "../../../../../lib/hepsiburada/reconcile";
import { getD1 } from "../../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    return Response.json(await reconcileHepsiburadaImports(getD1()));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Hepsiburada doğrulaması başarısız." },
      { status: 500 },
    );
  }
}
