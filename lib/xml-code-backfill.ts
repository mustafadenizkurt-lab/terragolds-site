import { fetchSupplierXmlText } from "./supplier-fetch";
import { detectFieldNames, parseSupplierXml, type FlatRecord } from "./supplier-import";

const MAX_XML_BYTES = 15 * 1024 * 1024;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^a-z0-9]/g, "");
}

// Ordered by priority (most specific/intended first) - a product's own SKU
// field should win over a generic barcode/id field when the feed has both,
// since a barcode is a different real-world identifier (EAN/UPC) than the
// supplier's own short alphanumeric product code the admin wants shown.
const codeFieldKeywords = [
  "stokkodu",
  "urunkodu",
  "urunkod",
  "productcode",
  "itemcode",
  "stockcode",
  "sku",
  "kod",
  "code",
  "referans",
  "reference",
  "barkod",
  "barcode",
  "id",
];

const imageFieldKeywords = [
  "resim",
  "gorsel",
  "image",
  "img",
  "foto",
  "photo",
  "picture",
];

/**
 * `keywords` is ordered by priority, most specific/intended first. Exact
 * matches always beat substring matches; within the same match type, the
 * field matching the earlier (more specific) keyword wins - so e.g. a field
 * named "StokKodu" is preferred over one named "Barcode" even though both
 * match, instead of whichever happens to sort first alphabetically.
 */
function guessField(fieldNames: string[], keywords: string[]): string | undefined {
  let best: string | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const field of fieldNames) {
    const lastSegment = normalize(field.split(".").pop() ?? field);
    for (let keywordIndex = 0; keywordIndex < keywords.length; keywordIndex += 1) {
      const keyword = keywords[keywordIndex];
      const isExact = lastSegment === keyword;
      const isSubstring = !isExact && lastSegment.includes(keyword);
      if (!isExact && !isSubstring) continue;
      const rank = (isExact ? 0 : 1000) + keywordIndex;
      if (rank < bestRank) {
        bestRank = rank;
        best = field;
      }
    }
  }
  return best;
}

export function guessCodeField(fieldNames: string[]): string | undefined {
  return guessField(fieldNames, codeFieldKeywords);
}

export function guessImageField(fieldNames: string[]): string | undefined {
  return guessField(fieldNames, imageFieldKeywords);
}

/**
 * Normalizes an image URL down to a stable matching key: host + path, no
 * protocol and no query string, lowercased. The site's own product.image
 * values are the supplier's original feed URLs stored as-is (the bulk
 * import never re-hosts images), so this is a reliable 1:1 key between a
 * DB product and its feed record - unlike name/price, which can legitimately
 * collide or drift between the two sides. The query string is dropped
 * because it's typically a cache-busting/resize param that can differ
 * between when a product was first imported and today's feed without the
 * underlying image actually being different.
 */
export function normalizeImageKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return `${parsed.host}${parsed.pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

/**
 * Fallback key: just the image filename (no host, no directory, no query
 * string), lowercased. Used when the exact host+path key finds nothing -
 * a supplier's image CDN/storage path can be reorganized over the years
 * between when a product was first imported and today's feed, but the
 * filename itself (which usually embeds the product's own code, e.g.
 * "EY231-1.jpg") tends to stay stable.
 */
export function normalizeImageFilenameKey(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  let pathname = trimmed;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    // Not a full URL (e.g. a bare relative path) - use it as-is.
  }
  const withoutQuery = pathname.split(/[?#]/)[0];
  const filename = withoutQuery.split("/").pop() ?? "";
  return filename.toLowerCase();
}

export async function fetchFeedRecords(feedUrl: string): Promise<FlatRecord[]> {
  const xmlText = await fetchSupplierXmlText(feedUrl, { maxBytes: MAX_XML_BYTES });
  return parseSupplierXml(xmlText);
}

export type CandidateProduct = { id: number; name: string; image: string };

export type BackfillReport = {
  feedRecordCount: number;
  detectedFields: string[];
  codeField: string;
  imageField: string;
  candidateCount: number;
  matchedCount: number;
  matchedByFilenameFallbackCount: number;
  unmatchedCount: number;
  ambiguousImageCount: number;
  ambiguousFilenameCount: number;
  sampleMatched: { id: number; name: string; image: string; externalId: string }[];
  sampleUnmatched: { id: number; name: string; image: string }[];
  /** Raw code/image field values straight from the feed, for visually
   * comparing against a DB product's stored image URL when nothing matches
   * (host/path drift vs. wrong field picked are otherwise indistinguishable
   * from the counts alone). */
  sampleFeedRecords: { code: string; image: string }[];
};

export type BackfillMatch = { productId: number; externalId: string };

function buildCodeMap(
  records: FlatRecord[],
  imageField: string,
  codeField: string,
  keyFn: (rawImage: string) => string,
): { map: Map<string, string>; ambiguousCount: number } {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const record of records) {
    const rawImage = (record[imageField] ?? "").trim();
    const rawCode = (record[codeField] ?? "").trim();
    if (!rawImage || !rawCode) continue;
    const key = keyFn(rawImage);
    if (!key) continue;
    const existing = map.get(key);
    if (existing !== undefined && existing !== rawCode) {
      ambiguous.add(key);
      continue;
    }
    map.set(key, rawCode);
  }
  for (const key of ambiguous) map.delete(key);
  return { map, ambiguousCount: ambiguous.size };
}

export function buildImageToCodeMap(
  records: FlatRecord[],
  imageField: string,
  codeField: string,
): { map: Map<string, string>; ambiguousCount: number } {
  return buildCodeMap(records, imageField, codeField, normalizeImageKey);
}

export function matchCandidates(
  candidates: CandidateProduct[],
  imageToCode: Map<string, string>,
  filenameToCode: Map<string, string>,
): {
  matches: (BackfillMatch & { name: string; image: string; viaFilenameFallback: boolean })[];
  unmatched: CandidateProduct[];
} {
  const matches: (BackfillMatch & { name: string; image: string; viaFilenameFallback: boolean })[] = [];
  const unmatched: CandidateProduct[] = [];
  for (const product of candidates) {
    const exactKey = normalizeImageKey(product.image);
    const exactCode = exactKey ? imageToCode.get(exactKey) : undefined;
    if (exactCode) {
      matches.push({
        productId: product.id,
        externalId: exactCode,
        name: product.name,
        image: product.image,
        viaFilenameFallback: false,
      });
      continue;
    }
    const filenameKey = normalizeImageFilenameKey(product.image);
    const filenameCode = filenameKey ? filenameToCode.get(filenameKey) : undefined;
    if (filenameCode) {
      matches.push({
        productId: product.id,
        externalId: filenameCode,
        name: product.name,
        image: product.image,
        viaFilenameFallback: true,
      });
      continue;
    }
    unmatched.push(product);
  }
  return { matches, unmatched };
}

export function buildReport(
  records: FlatRecord[],
  candidates: CandidateProduct[],
  fieldOverrides?: { codeField?: string; imageField?: string },
): { report: BackfillReport; matches: BackfillMatch[] } {
  const detectedFields = detectFieldNames(records);
  const codeField = fieldOverrides?.codeField || guessCodeField(detectedFields);
  const imageField = fieldOverrides?.imageField || guessImageField(detectedFields);
  if (!codeField || !imageField) {
    throw new Error(
      "Feed'de ürün kodu veya görsel alanı otomatik tespit edilemedi. Tespit edilen alanlar: " +
        detectedFields.join(", "),
    );
  }

  const { map: exactMap, ambiguousCount: ambiguousImageCount } = buildCodeMap(
    records,
    imageField,
    codeField,
    normalizeImageKey,
  );
  const { map: filenameMap, ambiguousCount: ambiguousFilenameCount } = buildCodeMap(
    records,
    imageField,
    codeField,
    normalizeImageFilenameKey,
  );
  const { matches, unmatched } = matchCandidates(candidates, exactMap, filenameMap);

  const report: BackfillReport = {
    feedRecordCount: records.length,
    detectedFields,
    codeField,
    imageField,
    candidateCount: candidates.length,
    matchedCount: matches.length,
    matchedByFilenameFallbackCount: matches.filter((match) => match.viaFilenameFallback).length,
    unmatchedCount: unmatched.length,
    ambiguousImageCount,
    ambiguousFilenameCount,
    sampleMatched: matches.slice(0, 15).map((match) => ({
      id: match.productId,
      name: match.name,
      image: match.image,
      externalId: match.externalId,
    })),
    sampleUnmatched: unmatched.slice(0, 15),
    sampleFeedRecords: records.slice(0, 8).map((record) => ({
      code: (record[codeField] ?? "").trim(),
      image: (record[imageField] ?? "").trim(),
    })),
  };

  return {
    report,
    matches: matches.map(({ productId, externalId }) => ({ productId, externalId })),
  };
}
