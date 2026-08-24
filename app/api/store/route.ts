import { defaultProducts, defaultSettings } from "../../../lib/store-data";
import { defaultSiteContent } from "../../../lib/site-content-types";
import { readProductCategories } from "../../../lib/product-categories";
import { readPublishedSiteContent } from "../../../lib/site-content";
import { readProducts, readSettings } from "../../../lib/store-db";

export const dynamic = "force-dynamic";

export async function GET() {
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
    return Response.json({
      products,
      settings,
      content,
      categories,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mağaza verileri alınamadı.";
    return Response.json(
      {
        products: defaultProducts,
        settings: defaultSettings,
        content: defaultSiteContent,
        categories: [
          ...new Set(defaultProducts.map((product) => product.category)),
        ],
        warning: message,
      },
      { status: 200 },
    );
  }
}
