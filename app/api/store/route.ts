import { readStorefrontData } from "../../../lib/storefront-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readStorefrontData();
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
