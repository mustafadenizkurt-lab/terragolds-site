import { readShowcaseProducts } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

/**
 * Homepage "Öne Çıkanlar" / "Yeni Gelenler" / "İndirimde" rows. Counts match
 * FEATURED_PRODUCTS_COUNT/NEW_ARRIVALS_COUNT/DISCOUNT_SHOWCASE_COUNT in
 * app/home-client.tsx.
 */
export async function GET() {
  const data = await readShowcaseProducts({
    featuredCount: 10,
    newestCount: 12,
    discountCount: 12,
  });
  return Response.json(
    { featured: data.featured, newest: data.newest, discount: data.discount },
    { headers: { "cache-control": "no-store" } },
  );
}
