import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { listMarketplaceCredentialsForAdmin } from "../../../../lib/marketplace-credentials";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json(
    { providers: await listMarketplaceCredentialsForAdmin() },
    { headers: { "cache-control": "no-store" } },
  );
}
