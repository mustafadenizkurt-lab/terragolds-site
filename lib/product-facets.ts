import { getDiscountedPrice, type Product } from "./store-data";

/**
 * Material/color facets for product filtering.
 *
 * The catalog has no structured material/color columns - XML-imported
 * products only carry a free-text `name` (and a `stone` field used by the
 * original hand-curated natural-stone catalog). But the supplier's own
 * naming convention is extremely consistent (see product names like "316L
 * Çelik Altın Renk ... Kolye" or "Zirkon Taşlı Altın Kaplama ... Yüzük"), so
 * a keyword match against `name` gives a reliable-enough facet without a
 * schema migration or a re-import. Same technique already used by
 * app/products/[id]/size-guide.tsx for category detection.
 */

export type ProductFacet = {
  key: string;
  label: string;
  keywords: string[];
};

export const MATERIAL_FACETS: ProductFacet[] = [
  { key: "celik", label: "Çelik", keywords: ["çelik"] },
  { key: "pirinc", label: "Pirinç", keywords: ["pirinç"] },
  { key: "gumus-kaplama", label: "Gümüş Kaplama", keywords: ["gümüş kaplama"] },
  { key: "altin-kaplama", label: "Altın Kaplama", keywords: ["altın kaplama"] },
  { key: "deri", label: "Deri", keywords: ["deri"] },
  { key: "dogal-tas", label: "Doğal Taş", keywords: ["doğal taş"] },
];

export const COLOR_FACETS: ProductFacet[] = [
  { key: "altin", label: "Altın / Gold", keywords: ["altın renk", "gold renk", "gold "] },
  { key: "gumus", label: "Gümüş / Silver", keywords: ["gümüş renk", "silver renk", "silver "] },
  { key: "rose", label: "Rose Gold", keywords: ["rose renk", "rose "] },
  { key: "siyah", label: "Siyah", keywords: ["siyah renk", "siyah "] },
  { key: "kahverengi", label: "Kahverengi", keywords: ["kahverengi"] },
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

function findFacet(facets: ProductFacet[], key: string): ProductFacet | undefined {
  return facets.find((facet) => facet.key === key);
}

/** JS-side check, for surfaces (like category pages) that filter an already-loaded product array. */
export function productMatchesFacet(
  name: string,
  facetKey: string,
  facets: ProductFacet[],
): boolean {
  const facet = findFacet(facets, facetKey);
  if (!facet) return true;
  const normalized = normalize(name);
  return facet.keywords.some((keyword) => normalized.includes(normalize(keyword)));
}

/** SQL-side keyword list, for surfaces (like /api/products) that filter in D1. */
export function facetKeywords(facetKey: string, facets: ProductFacet[]): string[] {
  return findFacet(facets, facetKey)?.keywords ?? [];
}

// Sort options shared between the D1-backed catalog (/api/products, see
// store-db.ts's own ORDER BY mapping for these same keys) and the
// category pages, which still sort an already-loaded JS array (see
// resolveCategoryOrGroup in app/kategori/[slug]/page.tsx).
export const SORT_OPTIONS = [
  "varsayilan",
  "fiyat-artan",
  "fiyat-azalan",
  "yeni",
  "isim-az",
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** JS-side sort, for surfaces (like category pages) that sort an already-loaded product array. */
export function sortProducts(products: Product[], sort?: string): Product[] {
  switch (sort as SortOption | undefined) {
    case "fiyat-artan":
      return [...products].sort((a, b) => getDiscountedPrice(a) - getDiscountedPrice(b));
    case "fiyat-azalan":
      return [...products].sort((a, b) => getDiscountedPrice(b) - getDiscountedPrice(a));
    case "yeni":
      return [...products].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    case "isim-az":
      return [...products].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
    default:
      return products;
  }
}
