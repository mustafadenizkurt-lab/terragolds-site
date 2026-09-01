import type { Product, StoreSettings } from "./store-data";
import { defaultProducts, defaultSettings } from "./store-data";
import type { SiteContent } from "./site-content-types";
import { defaultSiteContent } from "./site-content-types";
import { readProductCategories } from "./product-categories";
import { readPublishedSiteContent } from "./site-content";
import { readProducts, readSettings } from "./store-db";

export type CategorySummaryEntry = {
  name: string;
  count: number;
};

export type StorefrontData = {
  products: Product[];
  settings: StoreSettings;
  content: SiteContent;
  categories: string[];
  /**
   * {name, count} per category - for consumers that only need category
   * names and product counts (nav dropdowns, filter chips), not the full
   * product list. Added so those consumers can stop fetching `products`
   * just to read its `.category` field off every row.
   */
  categorySummary: CategorySummaryEntry[];
  warning?: string;
};

function tallyCategorySummary(products: Product[]): CategorySummaryEntry[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/**
 * Shared by the public homepage (server-rendered, so first paint already
 * has real data instead of the curated defaults) and /api/store (used for
 * client-side refreshes after mount). Keeping this in one place avoids the
 * two call sites drifting apart.
 */
export async function readStorefrontData(): Promise<StorefrontData> {
  try {
    const [products, settings] = await Promise.all([
      readProducts(false),
      readSettings(),
    ]);
    const [content, categoryRows] = await Promise.all([
      readPublishedSiteContent(),
      readProductCategories(false),
    ]);
    const categories = categoryRows.length
      ? categoryRows.map((category) => category.name)
      : [...new Set(products.map((product) => product.category))];
    const categorySummary = categoryRows.length
      ? categoryRows.map((category) => ({
          name: category.name,
          count: category.productCount,
        }))
      : tallyCategorySummary(products);
    return { products, settings, content, categories, categorySummary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mağaza verileri alınamadı.";
    return {
      products: defaultProducts,
      settings: defaultSettings,
      content: defaultSiteContent,
      categories: [
        ...new Set(defaultProducts.map((product) => product.category)),
      ],
      categorySummary: tallyCategorySummary(defaultProducts),
      warning: message,
    };
  }
}
