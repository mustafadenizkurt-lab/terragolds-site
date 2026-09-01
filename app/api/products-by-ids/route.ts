import { readProductsByIds } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

/**
 * Backs favorites/recently-viewed rails (favorites-client.tsx,
 * profile-client.tsx) - they only need a small, specific subset of the
 * catalog by id, not the whole /api/store product list to filter locally.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  const products = ids.length ? await readProductsByIds(ids) : [];
  return Response.json({ products }, { headers: { "cache-control": "no-store" } });
}
