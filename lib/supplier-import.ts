import { XMLParser } from "fast-xml-parser";
import { parseProductInput, type ProductInput } from "./product-input";
import { fetchSupplierXmlText } from "./supplier-fetch";

export const MAX_IMPORT_ROWS = 500;
export const PREVIEW_ROW_COUNT = 8;

export type TargetField =
  | "name"
  | "price"
  | "stock"
  | "category"
  | "image"
  | "description";

export const targetFields: { key: TargetField; label: string; required: boolean }[] = [
  { key: "name", label: "Ürün Adı", required: true },
  { key: "price", label: "Fiyat", required: true },
  { key: "stock", label: "Stok", required: false },
  { key: "category", label: "Kategori", required: false },
  { key: "image", label: "Görsel", required: false },
  { key: "description", label: "Açıklama", required: false },
];

export type FieldMapping = Partial<Record<TargetField, string>>;

export type FlatRecord = Record<string, string>;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

/** Recursively flattens one parsed XML record into "path.to.field" -> string. */
function flattenRecord(
  value: unknown,
  prefix: string,
  out: FlatRecord,
): FlatRecord {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== "object")) {
      out[prefix] = value.map((item) => String(item)).join(", ");
    }
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("#text" in obj) out[prefix] = String(obj["#text"]);
    for (const key of Object.keys(obj)) {
      if (key === "#text") continue;
      flattenRecord(obj[key], prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out[prefix] = String(value);
  return out;
}

/** Finds the array of sibling elements that repeats most often — that's the product list. */
function findRecordArray(
  node: unknown,
  depth = 0,
): Record<string, unknown>[] | null {
  if (depth > 6 || node === null || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    const objects = node.filter(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    ) as Record<string, unknown>[];
    return objects.length ? objects : null;
  }

  const obj = node as Record<string, unknown>;
  const keys = contentKeys(obj);
  let best: Record<string, unknown>[] | null = null;
  for (const key of keys) {
    const value = obj[key];
    if (!Array.isArray(value)) continue;
    const objects = value.filter(
      (item) => item && typeof item === "object" && !Array.isArray(item),
    ) as Record<string, unknown>[];
    if (objects.length > (best?.length ?? 0)) best = objects;
  }
  if (best) return best;

  for (const key of keys) {
    const found = findRecordArray(obj[key], depth + 1);
    if (found?.length) return found;
  }
  return null;
}

/** Skips XML declaration (`?xml`), doctype/comment (`!...`) pseudo-nodes fast-xml-parser emits. */
function contentKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((key) => !key.startsWith("?") && !key.startsWith("!"));
}

/** Fallback: a feed with exactly one product won't produce a repeated array. */
function findSingleRecord(
  node: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 6 || node === null || typeof node !== "object" || Array.isArray(node)) {
    return null;
  }
  const obj = node as Record<string, unknown>;
  const keys = contentKeys(obj);
  const values = keys.map((key) => obj[key]);
  const leafCount = values.filter(
    (value) => typeof value !== "object" || value === null,
  ).length;
  if (values.length > 0 && leafCount / values.length >= 0.5) return obj;

  for (const key of keys) {
    const found = findSingleRecord(obj[key], depth + 1);
    if (found) return found;
  }
  return null;
}

export class SupplierXmlError extends Error {}

const MAX_XML_BYTES = 15 * 1024 * 1024;

/** Resolves the raw XML text from a submitted form: either a supplier URL or an uploaded file. */
export async function resolveSupplierXml(form: FormData): Promise<string> {
  const sourceType = String(form.get("sourceType") ?? "");

  if (sourceType === "url") {
    const rawUrl = String(form.get("url") ?? "").trim();
    if (!rawUrl) throw new SupplierXmlError("XML linki boş olamaz.");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new SupplierXmlError("Geçersiz link.");
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new SupplierXmlError("Sadece http(s) linkleri desteklenir.");
    }
    try {
      return await fetchSupplierXmlText(parsedUrl.toString(), {
        maxBytes: MAX_XML_BYTES,
      });
    } catch (error) {
      throw new SupplierXmlError(
        error instanceof Error ? error.message : "Link'ten XML alınamadı.",
      );
    }
  }

  if (sourceType === "file") {
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new SupplierXmlError("XML dosyası yüklenmedi.");
    }
    if (file.size > MAX_XML_BYTES) {
      throw new SupplierXmlError("XML dosyası çok büyük (15MB sınırı).");
    }
    return await file.text();
  }

  throw new SupplierXmlError("Kaynak türü belirtilmedi (link veya dosya).");
}

export function parseSupplierXml(xmlText: string): FlatRecord[] {
  let parsed: unknown;
  try {
    parsed = xmlParser.parse(xmlText, true);
  } catch {
    throw new SupplierXmlError("XML ayrıştırılamadı, dosya/link geçerli bir XML değil.");
  }

  const records =
    findRecordArray(parsed) ??
    (findSingleRecord(parsed) ? [findSingleRecord(parsed) as Record<string, unknown>] : null);

  if (!records || !records.length) {
    throw new SupplierXmlError(
      "XML içinde tekrar eden bir ürün kaydı bulunamadı.",
    );
  }

  return records.map((record) => flattenRecord(record, "", {}));
}

export function detectFieldNames(records: FlatRecord[]): string[] {
  const names = new Set<string>();
  for (const record of records.slice(0, 25)) {
    for (const key of Object.keys(record)) names.add(key);
  }
  return [...names].sort();
}

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

const keywordsByTarget: Record<TargetField, string[]> = {
  name: ["urunadi", "productname", "ad", "isim", "name", "title", "baslik"],
  price: ["fiyat", "price", "satisfiyati", "tutar", "birimfiyat"],
  stock: ["stok", "stock", "miktar", "adet", "qty", "quantity"],
  category: ["kategori", "category", "grup", "group", "kategoriadi"],
  image: ["resim", "gorsel", "image", "img", "foto", "photo", "picture"],
  description: ["aciklama", "description", "detay", "desc", "aciklamasi"],
};

export function guessFieldMapping(fieldNames: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  const priority: TargetField[] = [
    "name",
    "price",
    "category",
    "stock",
    "image",
    "description",
  ];

  for (const target of priority) {
    const keywords = keywordsByTarget[target];
    let bestField: string | null = null;
    let bestScore = 0;
    for (const field of fieldNames) {
      if (used.has(field)) continue;
      const lastSegment = normalize(field.split(".").pop() ?? field);
      for (const keyword of keywords) {
        if (lastSegment === keyword && 3 > bestScore) {
          bestField = field;
          bestScore = 3;
        } else if (lastSegment.includes(keyword) && bestScore < 2) {
          bestField = field;
          bestScore = 2;
        }
      }
    }
    if (bestField) {
      mapping[target] = bestField;
      used.add(bestField);
    }
  }
  return mapping;
}

export type ImportRow = { index: number; product: ProductInput; warnings: string[] };
export type ImportRowError = { index: number; reason: string };

export function applyMapping(
  records: FlatRecord[],
  mapping: FieldMapping,
  markupPercent: number,
): { rows: ImportRow[]; errors: ImportRowError[] } {
  if (!mapping.name || !mapping.price) {
    throw new Error("Ürün adı ve fiyat alanları eşleştirilmeden aktarım yapılamaz.");
  }

  const markup = Number.isFinite(markupPercent)
    ? Math.min(1000, Math.max(0, markupPercent))
    : 0;
  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  records.forEach((record, index) => {
    const name = (record[mapping.name as string] ?? "").trim();
    if (!name) {
      errors.push({ index, reason: "Ürün adı boş." });
      return;
    }

    const rawPriceText = (record[mapping.price as string] ?? "").trim();
    const parsedPrice = Number(rawPriceText.replace(",", "."));
    if (!rawPriceText || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      errors.push({
        index,
        reason: `Fiyat geçersiz: "${rawPriceText || "(boş)"}".`,
      });
      return;
    }
    const markedUpPrice = Math.round(parsedPrice * (1 + markup / 100));

    const rawStock = mapping.stock ? (record[mapping.stock] ?? "").trim() : "";
    const rawCategory = mapping.category ? (record[mapping.category] ?? "").trim() : "";
    const rawImage = mapping.image ? (record[mapping.image] ?? "").trim() : "";
    const rawDescription = mapping.description
      ? (record[mapping.description] ?? "").trim()
      : "";

    const warnings: string[] = [];
    if (!rawStock || !Number.isFinite(Number(rawStock))) {
      warnings.push("Stok bulunamadı, 0 kabul edildi.");
    }
    if (!rawCategory) {
      warnings.push("Kategori bulunamadı, varsayılan kategori kullanıldı.");
    }
    if (!rawImage) {
      warnings.push("Görsel bulunamadı, varsayılan görsel kullanıldı.");
    }

    try {
      const product = parseProductInput({
        name,
        price: markedUpPrice,
        stock: rawStock,
        category: rawCategory || undefined,
        image: rawImage,
        description: rawDescription,
        status: "draft",
      });
      rows.push({ index, product, warnings });
    } catch (error) {
      errors.push({
        index,
        reason: error instanceof Error ? error.message : "Doğrulama hatası.",
      });
    }
  });

  return { rows, errors };
}
