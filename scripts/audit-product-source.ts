#!/usr/bin/env node
// Read-only diagnostic: how many products came from the XML supplier feed
// vs. were added by hand, per category. Makes NO changes to the database.
//
// Usage: npx tsx scripts/audit-product-source.ts [--remote]
// Defaults to the local D1 instance; pass --remote to target production.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor (salt okunur).");
}

// See scripts/backfill-product-seo.mjs for why this parsing is needed:
// wrangler's --json output can be preceded by progress text that also
// contains '[', and the real results entry isn't reliably first.
function parseWranglerJsonArray(output: string): unknown[] {
  for (let i = output.indexOf("["); i !== -1; i = output.indexOf("[", i + 1)) {
    try {
      const parsed = JSON.parse(output.slice(i));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Not a valid JSON start at this '[' - try the next one.
    }
  }
  throw new Error(`wrangler çıktısından JSON ayrıştırılamadı:\n${output}`);
}

function runD1(sql: string): Record<string, unknown>[] {
  const tmpFile = join(mkdtempSync(join(tmpdir(), "d1-query-")), "query.sql");
  writeFileSync(tmpFile, sql, "utf8");
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", target, "--json", "--file", tmpFile],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, shell: true },
  );
  const parsed = parseWranglerJsonArray(output);
  const resultEntry = parsed.find(
    (entry): entry is { results: Record<string, unknown>[] } =>
      Array.isArray((entry as { results?: unknown })?.results),
  );
  return resultEntry?.results ?? [];
}

// Raw category values that fall under the "Bileklik & Halhal" nav group,
// matched by hand against lib/category-groups.ts's keywords (["bileklik",
// "halhal", "hal hal", "şahmeran"]) - this script talks to D1 directly and
// can't import that module, so the list is kept in sync manually.
const BILEKLIK_HALHAL_CATEGORIES = [
  "Bayan Bileklik",
  "ERKEK BİLEKLİK",
  "Erkek Bileklik",
  "Hal Hal",
  "KADIN BİLEKLİK",
  "KADIN HALHAL & ŞAHMERAN",
  "Şahmeran",
];

console.log("=== 1. xml_external_id sütununun genel doluluk oranı ===\n");
const overall = runD1(
  `SELECT COUNT(*) AS total,
          SUM(CASE WHEN xml_external_id IS NOT NULL AND xml_external_id <> '' THEN 1 ELSE 0 END) AS has_external_id,
          SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS cost_positive,
          SUM(CASE WHEN cost = 0 THEN 1 ELSE 0 END) AS cost_zero
   FROM products;`,
);
console.table(overall);

const hasExternalId = Number(overall[0]?.has_external_id ?? 0);
const total = Number(overall[0]?.total ?? 0);
if (hasExternalId === 0) {
  console.log(
    `\nUYARI: xml_external_id sütunu HİÇBİR üründe dolu değil (0/${total}).\n` +
      "Bu sütun tedarikçi kökenini ayırt etmek için GÜVENİLİR DEĞİL: admin panelindeki\n" +
      "toplu 'Tedarikçi İçe Aktar' importu (mevcut ~4300+ ürünün geldiği yol) bu sütunu\n" +
      "hiç yazmıyor - sadece otomatik arka plan (cron) senkronu yazıyor, o da bu tedarikçi\n" +
      "için (xml.ebijuteri.com, HTTP 521) şu ana kadar hiç başarılı olmadı.\n\n" +
      "Bunun yerine cost sütunu (XML fiyat alanından parse edilen ham maliyet) proxy\n" +
      "olarak kullanılıyor: cost > 0 -> muhtemelen XML kökenli, cost = 0 -> muhtemelen\n" +
      "elle eklenmiş. Bu KESİN bir ayrım değil - elle eklenirken cost girilmiş olabilir,\n" +
      "ya da tam tersi bir XML satırı geçersiz fiyat yüzünden cost=0 kalmış olabilir.",
  );
} else if (hasExternalId < total) {
  console.log(
    `\nNOT: xml_external_id sütunu ${total} üründen sadece ${hasExternalId} tanesinde dolu.\n` +
      "Bazı XML kökenli ürünlerde de boş olabilir - aşağıdaki cost tabanlı ayrım da kesin değil.",
  );
}

console.log("\n=== 2. Kategori ve durum (draft/published) bazında kırılım ===\n");
const byCategory = runD1(
  `SELECT category, status, COUNT(*) AS total,
          SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS cost_positive,
          SUM(CASE WHEN cost = 0 THEN 1 ELSE 0 END) AS cost_zero,
          SUM(CASE WHEN xml_external_id IS NOT NULL AND xml_external_id <> '' THEN 1 ELSE 0 END) AS has_external_id
   FROM products GROUP BY category, status ORDER BY category, status;`,
);
console.table(byCategory);

console.log("\n=== 3. \"Bileklik & Halhal\" grubu (tüm ham kategoriler birlikte) ===\n");
const placeholders = BILEKLIK_HALHAL_CATEGORIES.map((c) => `'${c.replaceAll("'", "''")}'`).join(",");
const group = runD1(
  `SELECT COUNT(*) AS total,
          SUM(CASE WHEN cost > 0 THEN 1 ELSE 0 END) AS cost_positive,
          SUM(CASE WHEN cost = 0 THEN 1 ELSE 0 END) AS cost_zero,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft
   FROM products WHERE category IN (${placeholders});`,
);
console.table(group);

const groupCostPositive = Number(group[0]?.cost_positive ?? 0);
console.log(
  `\nTedarikçi XML feed'inde bildirilen (kullanıcı tarafından, güncel feed): 909 ürün.\n` +
    `DB'de cost > 0 (XML kökenli proxy, tüm durumlar): ${groupCostPositive} ürün.\n` +
    `Fark: ${groupCostPositive - 909 >= 0 ? "+" : ""}${groupCostPositive - 909}.\n` +
    "Bu fark muhtemelen: (a) feed zamanla değişmiş olabilir (içe aktarımdan sonra\n" +
    "tedarikçi ürün ekleyip/çıkarmış olabilir), (b) cost proxy'si kesin değil - bazı\n" +
    "elle eklenen ürünlerde de cost girilmiş olabilir. xml_external_id sütunu boş\n" +
    "olduğu için daha kesin bir karşılaştırma şu an mümkün değil.",
);
