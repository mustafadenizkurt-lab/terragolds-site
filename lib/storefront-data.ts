import type { Product, StoreSettings } from "./store-data";
import { defaultProducts, defaultSettings } from "./store-data";
import type { SiteContent } from "./site-content-types";
import { defaultSiteContent } from "./site-content-types";
import { readProductCategories } from "./product-categories";
import { readPublishedSiteContent } from "./site-content";
import { readProducts, readSettings } from "./store-db";

export type StorefrontData = {
  products: Product[];
  settings: StoreSettings;
  content: SiteContent;
  categories: string[];
  warning?: string;
};

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
    return { products, settings, content, categories };
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
      warning: message,
    };
  }
}
