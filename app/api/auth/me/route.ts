import { getCustomerFromRequest } from "../../../../lib/customer-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCustomerFromRequest(request);
  return Response.json(
    { user },
    { headers: { "cache-control": "no-store" } },
  );
}
