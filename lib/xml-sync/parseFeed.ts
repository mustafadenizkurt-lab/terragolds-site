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
  // Skip the "?xml" declaration/comment pseudo-nodes fast-xml-parser emits,
  // otherwise the length-1 fallback below can return them as the "record".
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key]) => !key.startsWith("?") && !key.startsWith("!"),
  );
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
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  // Elements with attributes (e.g. <Fiyat KDVDahil="true">150</Fiyat>) parse to
  // an object holding the attributes plus a "#text" key for the element's text.
  if (value && typeof value === "object" && "#text" in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>)["#text"];
    return typeof text === "string" || typeof text === "number" ? String(text).trim() : "";
  }
  return "";
}
