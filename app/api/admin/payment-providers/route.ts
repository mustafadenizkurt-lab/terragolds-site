import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { listPaymentProvidersForAdmin } from "../../../../lib/payment-providers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  return Response.json(
    { providers: await listPaymentProvidersForAdmin() },
    { headers: { "cache-control": "no-store" } },
  );
}
