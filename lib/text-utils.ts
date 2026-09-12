const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

/**
 * Supplier-imported product text (name/description) sometimes carries raw
 * HTML entities left over from the source catalog's markup (e.g. "&nbsp;"
 * between words). These fields are rendered as plain text (never
 * dangerouslySetInnerHTML, to avoid trusting unsanitized supplier HTML), so
 * the browser never decodes them - decode the common ones here instead.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    const lower = entity.toLowerCase();
    return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : match;
  });
}
