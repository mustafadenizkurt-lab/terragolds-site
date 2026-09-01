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
  settings: StoreSettings;
  content: SiteContent;
  categories: string[];
  /**
   * {name, count} per category - for consumers that only need category
   * names and product counts (nav dropdowns, filter chips), not the full
   * product list.
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
 * Backs /api/store. Every client component that used to read `products`
 * off this (search, catalog grid, showcases, favorites, recently-viewed)
 * has been migrated to its own dedicated, D1-backed endpoint
 * (/api/products, /api/search, /api/showcase, /api/products-by-ids) - so
 * this no longer fetches the full catalog (readProducts(), thousands of
 * rows) on the common path, only settings/content/category summary.
 */
export async function readStorefrontData(): Promise<StorefrontData> {
  try {
    const [settings, content, categoryRows] = await Promise.all([
      readSettings(),
      readPublishedSiteContent(),
      readProductCategories(false),
    ]);
    let categories: string[];
    let categorySummary: CategorySummaryEntry[];
    if (categoryRows.length) {
      categories = categoryRows.map((category) => category.name);
      categorySummary = categoryRows.map((category) => ({
        name: category.name,
        count: category.productCount,
      }));
    } else {
      // Rare fallback (product_categories should already be seeded by
      // ensureSeedData() at this point) - derive from the full catalog
      // rather than returning an empty nav.
      const products = await readProducts(false);
      categories = [...new Set(products.map((product) => product.category))];
      categorySummary = tallyCategorySummary(products);
    }
    return { settings, content, categories, categorySummary };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mağaza verileri alınamadı.";
    return {
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
