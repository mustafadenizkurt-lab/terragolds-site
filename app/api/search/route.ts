import { searchProducts } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const products = await searchProducts(params.get("q") ?? "");
  return Response.json({ products }, { headers: { "cache-control": "no-store" } });
}
