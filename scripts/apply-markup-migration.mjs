#!/usr/bin/env node
// One-time migration: recomputes price = ROUND(cost * 1.5 * 1.20) for every
// product that has a real cost basis (cost > 0), giving every XML-sourced
// product a clean, consistent 50% margin plus 20% VAT (supplier costs are
// VAT-exclusive). Products with cost = 0 (manually entered, not from an XML
// feed) are left untouched.
//
// Recomputing from `cost` rather than multiplying the existing `price` by
// 1.8 is deliberate: the products this targets already carried a variable,
// inconsistent markup (0%-40%, no VAT) from the original bulk XML import, so
// multiplying price directly would have compounded on top of that instead
// of producing a uniform 50% margin + VAT.
//
// This mirrors lib/xml-sync/calculatePrice.ts's calculatePrice(cost, 50)
// (which now also applies the 20% VAT_RATE constant defined there).
//
// Usage: npx tsx scripts/apply-markup-migration.mjs [--remote] [--apply]
// Defaults to the local D1 instance; pass --remote to target production.
// Defaults to a DRY RUN (shows what would change, touches nothing); pass
// --apply to actually take the backup and run the UPDATE.
//
// NOTE: an earlier version of this migration (price = ROUND(cost * 1.5), no
// VAT) was already run directly against production on 2026-08-31 (4325 rows
// updated). This version corrects that: the UPDATE is idempotent (it always
// recomputes from cost, never from the current price), so re-running it
// with --apply against a database that already has the no-VAT price applied
// is safe and will simply add the missing 20% VAT.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const apply = process.argv.includes("--apply");
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor.");
}
console.log(apply ? "MOD: gerçek çalıştırma (--apply)" : "MOD: dry-run (hiçbir şey değiştirilmeyecek)");

// See scripts/backfill-product-seo.mjs for why this parsing is needed:
// wrangler's --json output can be preceded by progress text that also
// contains '[', and the real results entry isn't reliably first.
function parseWranglerJsonArray(output) {
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

function runD1(sql) {
  const tmpFile = join(mkdtempSync(join(tmpdir(), "d1-query-")), "query.sql");
  writeFileSync(tmpFile, sql, "utf8");
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", target, "--json", "--file", tmpFile],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, shell: true },
  );
  const parsed = parseWranglerJsonArray(output);
  const resultEntry = parsed.find((entry) => Array.isArray(entry?.results));
  return { results: resultEntry?.results ?? [], meta: parsed.find((entry) => entry?.meta)?.meta };
}

const NEW_PRICE_SQL = "ROUND(cost * 1.5 * 1.20)";

// Dry run: show a sample of old vs. new prices and how many rows would
// actually change, without touching anything.
const preview = runD1(
  `SELECT id, name, price AS old_price, ${NEW_PRICE_SQL} AS new_price FROM products ` +
    `WHERE cost > 0 AND price != ${NEW_PRICE_SQL} ORDER BY id LIMIT 20;`,
).results;
const changeCount = runD1(
  `SELECT COUNT(*) AS total FROM products WHERE cost > 0 AND price != ${NEW_PRICE_SQL};`,
).results[0]?.total ?? 0;
const unaffectedCount = runD1(
  "SELECT COUNT(*) AS total FROM products WHERE cost > 0;",
).results[0]?.total ?? 0;

console.log(`\ncost > 0 olan toplam ürün: ${unaffectedCount}`);
console.log(`Yeni fiyatla değişecek ürün sayısı: ${changeCount}`);
console.log("\nÖrnek ürünler (eski fiyat -> yeni fiyat):");
for (const row of preview) {
  console.log(`  #${row.id} ${row.name}: ${row.old_price} -> ${row.new_price}`);
}

if (!apply) {
  console.log("\nDry-run tamamlandı, hiçbir şey değiştirilmedi. Uygulamak için --apply ekleyin.");
  process.exit(0);
}

if (!changeCount) {
  console.log("\nDeğişecek ürün yok, yapılacak bir şey kalmadı.");
  process.exit(0);
}

// Backup: snapshot every price this migration is about to touch, so a
// rollback is a straightforward set of UPDATE statements if ever needed.
const before = runD1("SELECT id, price, cost FROM products WHERE cost > 0 ORDER BY id;").results;
const backupFile = join(
  mkdtempSync(join(tmpdir(), "markup-migration-backup-")),
  `products-price-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
writeFileSync(backupFile, JSON.stringify(before, null, 2), "utf8");
console.log(`\nYedek alındı: ${before.length} ürün. Yedek dosyası: ${backupFile}`);

const result = runD1(`UPDATE products SET price = ${NEW_PRICE_SQL} WHERE cost > 0;`);
const changed = result.meta?.changes ?? 0;
console.log(`${changed} ürünün fiyatı güncellendi (price = ROUND(cost * 1.5 * 1.20)).`);

const mismatches = runD1(
  `SELECT COUNT(*) AS total FROM products WHERE cost > 0 AND price != ${NEW_PRICE_SQL};`,
).results;
const mismatchCount = mismatches[0]?.total ?? 0;
if (mismatchCount > 0) {
  console.error(`UYARI: ${mismatchCount} üründe fiyat beklenen değere eşit değil.`);
  process.exit(1);
}
console.log("Doğrulama başarılı: tüm cost > 0 ürünlerde price = ROUND(cost * 1.5 * 1.20).");
