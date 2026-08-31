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

console.log("\n=== 4. created_at zaman dağılımı (saat bazında, en yoğun 15 dilim) ===\n");
const hourly = runD1(
  `SELECT substr(created_at, 1, 13) AS hour_bucket, COUNT(*) AS total
   FROM products GROUP BY hour_bucket ORDER BY total DESC LIMIT 15;`,
);
console.table(hourly);
console.log(
  "\nİki keskin kümelenme bekleniyor (bulk import anları); geri kalanı dağınık,\n" +
    "tek tek ekleme/organik zaman damgaları olmalı.",
);

console.log("\n=== 5. Görsel URL domain/path deseni (genel) ===\n");
const imageDomains = runD1(
  `SELECT
     CASE
       WHEN image LIKE 'http%' THEN substr(image, 1, instr(substr(image,9), '/') + 8)
       ELSE substr(image, 1, 20)
     END AS url_prefix,
     COUNT(*) AS total
   FROM products GROUP BY url_prefix ORDER BY total DESC LIMIT 10;`,
);
console.table(imageDomains);
console.log(
  "\nBeklenen: tedarikçinin kendi CDN'i (hotlink edilmiş görseller) vs. sitenin\n" +
    "kendi medya yükleme sistemi (/api/media/...) - ikincisi sadece admin panelinden\n" +
    "elle görsel yükleyen biri tarafından oluşturulabilir, bu yüzden bu sinyal\n" +
    "cost/xml_external_id'den daha güvenilir olmalı.",
);

console.log(
  '\n=== 6. "Bileklik & Halhal" - created_at + görsel domain birleşik analiz ===\n',
);
const combined = runD1(
  `SELECT
     CASE WHEN image LIKE 'https://app.ebijuteri.com/%' THEN 'tedarikci_cdn' ELSE 'yerel_yukleme_veya_diger' END AS image_source,
     COUNT(*) AS total
   FROM products
   WHERE category IN (${placeholders})
   GROUP BY image_source;`,
);
console.table(combined);

const dupeStats = runD1(
  `SELECT SUM(cnt) AS total_rows_in_dupe_groups, SUM(cnt - 1) AS extra_duplicate_rows FROM (
     SELECT name, COUNT(*) AS cnt FROM products
     WHERE category IN (${placeholders}) AND image LIKE 'https://app.ebijuteri.com/%'
     GROUP BY name HAVING COUNT(*) > 1
   );`,
);
console.table(dupeStats);

const cdnRow = combined.find((r) => r.image_source === "tedarikci_cdn");
const localRow = combined.find((r) => r.image_source === "yerel_yukleme_veya_diger");
const cdnTotal = Number(cdnRow?.total ?? 0);
const localTotal = Number(localRow?.total ?? 0);
const extraDupes = Number(dupeStats[0]?.extra_duplicate_rows ?? 0);
const distinctCdn = cdnTotal - extraDupes;

console.log(
  `\nTedarikçi CDN'inden görsel kullanan (tekrarlar dahil): ${cdnTotal}\n` +
    `Bunların içinde aynı isimle birden fazla kez geçen "fazladan" satır: ${extraDupes}\n` +
    `  (muhtemelen 28 Ağustos ve 30 Ağustos'ta feed'in iki kez içe aktarılmasından -\n` +
    `  aynı ürün adı, aynı fiyat, farklı id ve created_at ile örnekleri var)\n` +
    `Tekil (duplicate'siz) tahmini: ${cdnTotal} - ${extraDupes} = ${distinctCdn}\n` +
    `Tedarikçi feed'inin bildirdiği: 909\n` +
    `Fark: ${distinctCdn - 909 >= 0 ? "+" : ""}${distinctCdn - 909} (cost tabanlı tahminin farkından çok daha küçük)\n\n` +
    `Yerel yükleme / diğer (muhtemelen gerçekten elle eklenmiş): ${localTotal}`,
);

