import { categoryToSlug } from "./category-slugs";
import { groupForCategory, type CategoryGroup } from "./category-groups";

// Product `category` values are raw, admin/supplier-entered strings, not a
// managed taxonomy - the same real-world subcategory often exists under
// several casing variants from different import batches (e.g. "Erkek
// Bileklik" and "ERKEK BİLEKLİK"). This module derives a nav group's
// subcategories straight from whatever categories its products currently
// carry, merging only exact case/whitespace variants of the same string -
// it never guesses at synonyms (e.g. "Bayan" vs "Kadın" stay separate).
export type CategorySubgroup = {
  slug: string;
  label: string;
  /** All raw category values this subgroup merges (for product filtering). */
  categories: string[];
  count: number;
};

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

/**
 * Subcategories for one nav group, derived from a category -> product-count
 * map. Only categories that actually belong to `group` are included, sorted
 * by product count (most common first) so the dropdown leads with the
 * subcategories customers are most likely to want.
 */
export function subgroupsForGroup(
  group: CategoryGroup,
  categoryCounts: Record<string, number>,
): CategorySubgroup[] {
  const buckets = new Map<
    string,
    { label: string; labelCount: number; categories: string[]; count: number }
  >();

  for (const [category, count] of Object.entries(categoryCounts)) {
    if (!category || count <= 0) continue;
    if (groupForCategory(category)?.slug !== group.slug) continue;
    const key = normalizeKey(category);
    const bucket = buckets.get(key);
    if (!bucket) {
      buckets.set(key, { label: category, labelCount: count, categories: [category], count });
    } else {
      bucket.categories.push(category);
      bucket.count += count;
      if (count > bucket.labelCount) {
        bucket.label = category;
        bucket.labelCount = count;
      }
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      slug: categoryToSlug(bucket.label),
      label: bucket.label,
      categories: bucket.categories,
      count: bucket.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Tally raw category values (e.g. from a product list) into counts. */
export function tallyCategoryCounts(categories: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const category of categories) {
    if (!category) continue;
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}
