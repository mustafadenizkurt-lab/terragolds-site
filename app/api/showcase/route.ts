import { readShowcaseProducts } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

/**
 * Homepage "Öne Çıkanlar" / "Yeni Gelenler" / "Günün Fırsatları" rows (counts
 * match FEATURED_PRODUCTS_COUNT/NEW_ARRIVALS_COUNT/DISCOUNT_SHOWCASE_COUNT in
 * app/home-client.tsx) plus the profile page's low-stock alert rail
 * (lowStockCount default of 4 matches profile-client.tsx's .slice(0, 4)).
 * discountCount caps "Günün Fırsatları" at 10 regardless of how many
 * products an admin marks is_daily_deal - see readShowcaseProducts().
 */
export async function GET() {
  const data = await readShowcaseProducts({
    featuredCount: 10,
    newestCount: 12,
    discountCount: 10,
  });
  return Response.json(
    {
      featured: data.featured,
      newest: data.newest,
      discount: data.discount,
      lowStock: data.lowStock,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
