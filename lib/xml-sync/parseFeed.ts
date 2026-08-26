import { XMLParser } from "fast-xml-parser";

export type XmlRecord = Record<string, unknown>;

export function parseFeed(xml: string): XmlRecord[] {
  const parsed = new XMLParser({ ignoreAttributes: false, isArray: () => false }).parse(xml) as Record<string, unknown>;
  const records = findProductCollection(parsed);
  return records.map((record) => (typeof record === "object" && record !== null ? record as XmlRecord : {}));
}

function findProductCollection(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, child] of entries) {
    if (Array.isArray(child)) return child;
    if (/products?|items?|offers?|urunler/i.test(key)) {
      const nested = findProductCollection(child);
      if (nested.length) return nested;
    }
  }
  for (const [, child] of entries) {
    const nested = findProductCollection(child);
    if (nested.length) return nested;
  }
  return [value];
}

export function readMappedValue(record: XmlRecord, path: string | undefined): string {
  if (!path) return "";
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
