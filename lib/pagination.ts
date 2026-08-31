// A catalog with thousands of rows means hundreds of pages - rendering one
// button per page overflows the pagination bar's container. This caps the
// buttons shown at a handful around the current page plus the first/last,
// with an ellipsis for gaps. Shared by the admin product list and the
// public storefront catalog.
export type PageWindowItem = number | "start-ellipsis" | "end-ellipsis";

export function buildPageWindow(
  current: number,
  total: number,
): PageWindowItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const pages: PageWindowItem[] = [1];
  if (left > 2) pages.push("start-ellipsis");
  for (let page = left; page <= right; page++) pages.push(page);
  if (right < total - 1) pages.push("end-ellipsis");
  pages.push(total);
  return pages;
}
