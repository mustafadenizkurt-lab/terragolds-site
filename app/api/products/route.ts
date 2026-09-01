import { readProductsPage } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

function parseNumber(value: string | null): number | undefined {
  if (value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Paginated + filtered catalog listing for the storefront grid - the D1
 * counterpart to what used to be client-side filtering/pagination over the
 * full product list from /api/store.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const data = await readProductsPage({
    page: parseNumber(params.get("page")),
    pageSize: parseNumber(params.get("pageSize")),
    category: params.get("category") ?? undefined,
    q: params.get("q") ?? undefined,
    minPrice: parseNumber(params.get("minPrice")),
    maxPrice: parseNumber(params.get("maxPrice")),
    inStock: params.get("inStock") === "true",
    discountOnly: params.get("discountOnly") === "true",
  });

  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
