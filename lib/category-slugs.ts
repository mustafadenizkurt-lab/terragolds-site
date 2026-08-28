import { slugify } from "./slugify";

export function categoryToSlug(category: string) {
  return slugify(category);
}

export function findCategoryBySlug(categories: string[], slug: string) {
  return categories.find((category) => categoryToSlug(category) === slug);
}
