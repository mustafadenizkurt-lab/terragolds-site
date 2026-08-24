import type { ProductCategory } from "./category-types";
import { getD1 } from "./store-db";

type CategoryRow = {
  id: number;
  name: string;
  description: string;
  active: number;
  sort_order: number;
  product_count: number;
};

export async function readProductCategories(
  includeInactive = true,
): Promise<ProductCategory[]> {
  const result = await getD1()
    .prepare(
      `SELECT product_categories.id, product_categories.name,
              product_categories.description, product_categories.active,
              product_categories.sort_order,
              COUNT(products.id) AS product_count
       FROM product_categories
       LEFT JOIN products ON products.category = product_categories.name
       ${includeInactive ? "" : "WHERE product_categories.active = 1"}
       GROUP BY product_categories.id
       ORDER BY product_categories.sort_order, product_categories.name`,
    )
    .all<CategoryRow>();
  return result.results.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order) || 0,
    productCount: Number(row.product_count) || 0,
  }));
}

export function parseCategoryInput(payload: unknown) {
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Kategori adı zorunludur.");
  return {
    name,
    description: String(body.description ?? "").trim().slice(0, 500),
    active: body.active !== false,
    sortOrder: Math.max(0, Math.round(Number(body.sortOrder) || 0)),
  };
}
