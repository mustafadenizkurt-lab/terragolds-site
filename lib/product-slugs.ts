import { slugify } from "./slugify";

/** Slug for a product name; falls back to a name-collision-safe id suffix. */
export function productNameToSlug(
  name: string,
  id: number,
  existingSlugs: ReadonlySet<string>,
): string {
  const base = slugify(name) || `urun-${id}`;
  if (!existingSlugs.has(base)) return base;
  return `${base}-${id}`;
}

/** Returns providedSlug as-is if set, otherwise generates a unique slug from name. */
export async function resolveProductSlug(
  db: D1Database,
  name: string,
  id: number,
  providedSlug?: string,
): Promise<string> {
  if (providedSlug) return providedSlug;
  const existing = await db
    .prepare("SELECT slug FROM products WHERE slug <> '' AND id <> ?")
    .bind(id)
    .all<{ slug: string }>();
  const existingSlugs = new Set(existing.results.map((row) => row.slug));
  return productNameToSlug(name, id, existingSlugs);
}
