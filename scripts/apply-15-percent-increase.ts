#!/usr/bin/env node
// One-time migration: applies a flat 15% increase directly on top of the
// current price = ROUND(price * 1.15), for every product with price > 0.
// This is INDEPENDENT of the cost*1.5*1.20 markup migration
// (scripts/apply-markup-migration.mjs) - it does not touch `cost`, and it
// multiplies whatever `price` already is today (however it got there),
// rather than recomputing from cost.
//
// Usage: npx tsx scripts/apply-15-percent-increase.ts [--remote] [--apply]
// Defaults to the local D1 instance; pass --remote to target production.
// Defaults to a DRY RUN (shows what would change, touches nothing); pass
// --apply to actually take the backup and run the UPDATE.
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

function runD1(sql: string): { results: Record<string, unknown>[]; meta?: Record<string, unknown> } {
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
  const metaEntry = parsed.find(
    (entry): entry is { meta: Record<string, unknown> } =>
      Boolean((entry as { meta?: unknown })?.meta),
  );
  return { results: resultEntry?.results ?? [], meta: metaEntry?.meta };
}

const NEW_PRICE_SQL = "ROUND(price * 1.15)";

// Dry run: sample of old vs. new prices, how many rows would change, and
// the average absolute price increase across affected rows.
const preview = runD1(
  `SELECT id, name, price AS old_price, ${NEW_PRICE_SQL} AS new_price FROM products ` +
    `WHERE price > 0 ORDER BY id LIMIT 10;`,
).results;
const totalRow = runD1("SELECT COUNT(*) AS total FROM products WHERE price > 0;").results[0];
const totalCount = Number(totalRow?.total ?? 0);
const avgRow = runD1(
  `SELECT AVG(${NEW_PRICE_SQL} - price) AS avg_increase, AVG(price) AS avg_old_price FROM products WHERE price > 0;`,
).results[0];
const avgIncrease = Number(avgRow?.avg_increase ?? 0);
const avgOldPrice = Number(avgRow?.avg_old_price ?? 0);

console.log(`\nprice > 0 olan toplam ürün (hepsi güncellenecek): ${totalCount}`);
console.log(`Ortalama eski fiyat: ${avgOldPrice.toFixed(2)} ₺`);
console.log(`Ortalama fiyat artışı: ${avgIncrease.toFixed(2)} ₺ (~%15)`);
console.log("\nÖrnek ürünler (eski fiyat -> yeni fiyat):");
for (const row of preview) {
  console.log(`  #${row.id} ${row.name}: ${row.old_price} -> ${row.new_price}`);
}

if (!apply) {
  console.log("\nDry-run tamamlandı, hiçbir şey değiştirilmedi. Uygulamak için --apply ekleyin.");
  process.exit(0);
}

if (!totalCount) {
  console.log("\nGüncellenecek ürün yok, yapılacak bir şey kalmadı.");
  process.exit(0);
}

// Backup: snapshot every price this migration is about to touch, so a
// rollback is a straightforward set of UPDATE statements if ever needed.
const before = runD1("SELECT id, price FROM products WHERE price > 0 ORDER BY id;").results;
const backupFile = join(
  mkdtempSync(join(tmpdir(), "price-increase-backup-")),
  `products-price-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
writeFileSync(backupFile, JSON.stringify(before, null, 2), "utf8");
console.log(`\nYedek alındı: ${before.length} ürün. Yedek dosyası: ${backupFile}`);

// A single UPDATE over a WHERE clause is already atomic in SQLite/D1 (all
// matching rows change together or none do) - no explicit BEGIN/COMMIT
// wrapper is needed for one statement. Every price > 0 row this UPDATE's
// WHERE clause matches gets touched, so the pre-update totalCount already
// tells us exactly how many rows were affected - no need to trust
// wrangler's reported meta.changes (which was found to be unreliable for
// D1 --local UPDATEs during testing).
runD1(`UPDATE products SET price = ${NEW_PRICE_SQL} WHERE price > 0;`);
console.log(`${totalCount} ürünün fiyatı güncellendi (price = ROUND(price * 1.15)).`);

// Verify against the pre-update backup: every row's new price should equal
// ROUND(old_price * 1.15) exactly. "expected" is computed by SQLite's own
// ROUND() (one query per sampled row), not recomputed in JS - JS's
// Math.round() and SQLite's ROUND() disagree on exact .5 cases
// (round-half-up vs round-half-to-even), so a JS-side recheck would
// produce false-positive mismatches. Each row is queried separately
// (rather than joined/unioned in one statement) because D1's SQLite build
// rejects even small compound SELECTs ("too many terms in compound
// SELECT") - found via testing, well under the usual default limit of
// 500. Only a sample is checked (not the full backup): the UPDATE is one
// uniform SQL expression applied to every matching row in a single
// statement, so a sample catches a wrong formula just as reliably as
// checking every row would.
const sample = before.slice(0, 10);
console.log("\nDoğrulama örneği (güncelleme sonrası):");
let sampleMismatchCount = 0;
for (const backupRow of sample) {
  const row = runD1(
    `SELECT id, name, price, ROUND(${backupRow.price} * 1.15) AS expected FROM products WHERE id = ${backupRow.id};`,
  ).results[0];
  const ok = row && Number(row.expected) === Number(row.price);
  if (!ok) sampleMismatchCount += 1;
  console.log(`  #${backupRow.id} ${row?.name}: ${backupRow.price} -> ${row?.price} (beklenen: ${row?.expected})${ok ? "" : " UYUŞMUYOR"}`);
}

// Global sanity check: the set of price > 0 rows shouldn't have grown or
// shrunk just from recomputing their own price (catches a WHERE-clause or
// scope mistake, even though it can't re-derive old values post-update).
const totalAfterRow = runD1("SELECT COUNT(*) AS total FROM products WHERE price > 0;").results[0];
const totalAfter = Number(totalAfterRow?.total ?? 0);
console.log(`\nToplam price > 0 ürün sayısı: önce ${totalCount}, sonra ${totalAfter}.`);

if (sampleMismatchCount > 0 || totalAfter !== totalCount) {
  console.error("UYARI: doğrulama başarısız - yukarıdaki uyuşmazlıklara bakın.");
  process.exit(1);
}
console.log(`Doğrulama başarılı: örneklenen ${sample.length} üründe price = ROUND(eski_price * 1.15), toplam satır sayısı değişmedi.`);
