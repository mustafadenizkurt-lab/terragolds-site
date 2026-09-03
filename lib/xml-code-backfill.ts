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

const codeFieldKeywords = [
  "stokkodu",
  "urunkodu",
  "urunkod",
  "productcode",
  "itemcode",
  "stockcode",
  "kod",
  "code",
  "sku",
  "barkod",
  "barcode",
  "referans",
  "reference",
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

function guessField(fieldNames: string[], keywords: string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const field of fieldNames) {
    const lastSegment = normalize(field.split(".").pop() ?? field);
    for (const keyword of keywords) {
      if (lastSegment === keyword && bestScore < 3) {
        best = field;
        bestScore = 3;
      } else if (lastSegment.includes(keyword) && bestScore < 2) {
        best = field;
        bestScore = 2;
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
  unmatchedCount: number;
  ambiguousImageCount: number;
  sampleMatched: { id: number; name: string; image: string; externalId: string }[];
  sampleUnmatched: { id: number; name: string; image: string }[];
};

export type BackfillMatch = { productId: number; externalId: string };

export function buildImageToCodeMap(
  records: FlatRecord[],
  imageField: string,
  codeField: string,
): { map: Map<string, string>; ambiguousCount: number } {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const record of records) {
    const rawImage = (record[imageField] ?? "").trim();
    const rawCode = (record[codeField] ?? "").trim();
    if (!rawImage || !rawCode) continue;
    const key = normalizeImageKey(rawImage);
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

export function matchCandidates(
  candidates: CandidateProduct[],
  imageToCode: Map<string, string>,
): { matches: (BackfillMatch & { name: string; image: string })[]; unmatched: CandidateProduct[] } {
  const matches: (BackfillMatch & { name: string; image: string })[] = [];
  const unmatched: CandidateProduct[] = [];
  for (const product of candidates) {
    const key = normalizeImageKey(product.image);
    const code = key ? imageToCode.get(key) : undefined;
    if (code) {
      matches.push({ productId: product.id, externalId: code, name: product.name, image: product.image });
    } else {
      unmatched.push(product);
    }
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

  const { map, ambiguousCount } = buildImageToCodeMap(records, imageField, codeField);
  const { matches, unmatched } = matchCandidates(candidates, map);

  const report: BackfillReport = {
    feedRecordCount: records.length,
    detectedFields,
    codeField,
    imageField,
    candidateCount: candidates.length,
    matchedCount: matches.length,
    unmatchedCount: unmatched.length,
    ambiguousImageCount: ambiguousCount,
    sampleMatched: matches.slice(0, 15).map((match) => ({
      id: match.productId,
      name: match.name,
      image: match.image,
      externalId: match.externalId,
    })),
    sampleUnmatched: unmatched.slice(0, 15),
  };

  return {
    report,
    matches: matches.map(({ productId, externalId }) => ({ productId, externalId })),
  };
}
