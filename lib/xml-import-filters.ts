// Shared by both the manual "Tedarikçi İçe Aktarma" admin import and the
// scheduled XML sync — lets an admin restrict which supplier records get
// imported by category/brand/price/stock, without duplicating the matching
// logic in each place.
export type ImportFilters = {
  /** Allow-list of raw category values (case-insensitive). Empty/undefined = no filter. */
  categories?: string[];
  /** Allow-list of raw brand values (case-insensitive). Empty/undefined = no filter. */
  brands?: string[];
  /** Exclude records whose computed (markup-applied) price is below this. */
  minPrice?: number;
  /** Exclude records with stock <= 0. */
  excludeZeroStock?: boolean;
};

function normalizeForMatch(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function matchesFilters(
  value: { category: string; brand: string; price: number; stock: number },
  filters: ImportFilters,
): boolean {
  if (filters.categories?.length) {
    const allowed = new Set(filters.categories.map(normalizeForMatch));
    if (!allowed.has(normalizeForMatch(value.category))) return false;
  }
  if (filters.brands?.length) {
    const allowed = new Set(filters.brands.map(normalizeForMatch));
    if (!allowed.has(normalizeForMatch(value.brand))) return false;
  }
  if (
    typeof filters.minPrice === "number" &&
    filters.minPrice > 0 &&
    value.price < filters.minPrice
  ) {
    return false;
  }
  if (filters.excludeZeroStock && value.stock <= 0) return false;
  return true;
}
