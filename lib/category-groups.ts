// Top-level navigation groups the site's raw product categories collapse
// into — modeled on ebijuteri.com's nav (Kolyeler, Küpeler, Bileklik &
// Halhal, Yüzük, Saat & Kombin, Aksesuar), plus "Kristaller" preserved for
// the site's original natural-stone catalog. The underlying `products`
// table keeps its granular category names (KADIN YÜZÜK, Erkek Bileklik,
// etc., including duplicates from different import batches) — this module
// only groups them for navigation, it never renames stored data.
export type CategoryGroup = {
  slug: string;
  label: string;
  keywords: string[];
};

export const categoryGroups: CategoryGroup[] = [
  { slug: "yuzuk", label: "Yüzük", keywords: ["yüzük"] },
  { slug: "kolyeler", label: "Kolyeler", keywords: ["kolye"] },
  { slug: "kupeler", label: "Küpeler", keywords: ["küpe"] },
  { slug: "bileklik", label: "Bileklik", keywords: ["bileklik"] },
  {
    slug: "sahmeran-halhal",
    label: "Şahmeran ve Halhal",
    keywords: ["şahmeran", "halhal", "hal hal"],
  },
  { slug: "saat-kombin", label: "Saat & Kombin", keywords: ["saat", "kombin"] },
  { slug: "aksesuar", label: "Aksesuar", keywords: ["aksesuar"] },
  { slug: "kristaller", label: "Kristaller", keywords: ["kristal"] },
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

/** Which top-level nav group a raw product category belongs to, if any. */
export function groupForCategory(categoryName: string): CategoryGroup | undefined {
  const haystack = normalize(categoryName);
  return categoryGroups.find((group) =>
    group.keywords.some((keyword) => haystack.includes(keyword)),
  );
}

/** Nav group lookup by its own slug — for the /kategori/[slug] route. */
export function findCategoryGroupBySlug(slug: string): CategoryGroup | undefined {
  return categoryGroups.find((group) => group.slug === slug);
}

/**
 * Groups that have at least one product among the given raw category names,
 * in nav display order — this is what makes the nav "automatic": a group
 * only appears once a matching category actually has products.
 */
export function activeCategoryGroups(productCategories: string[]): CategoryGroup[] {
  const present = new Set(
    productCategories
      .map((category) => groupForCategory(category)?.slug)
      .filter((slug): slug is string => Boolean(slug)),
  );
  return categoryGroups.filter((group) => present.has(group.slug));
}
