import { getCustomerFromRequest } from "../../../../lib/customer-auth";
import { getLoyaltyBalance } from "../../../../lib/loyalty";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCustomerFromRequest(request);
  if (!user) {
    return Response.json(
      { user: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const loyaltyPoints = await getLoyaltyBalance(getD1(), user.id);
  return Response.json(
    { user: { ...user, loyaltyPoints } },
    { headers: { "cache-control": "no-store" } },
  );
}
