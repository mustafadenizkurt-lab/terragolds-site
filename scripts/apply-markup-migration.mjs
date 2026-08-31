#!/usr/bin/env node
// One-time migration: recomputes price = ROUND(cost * 1.5) for every product
// that has a real cost basis (cost > 0), giving every XML-sourced product a
// clean, consistent 50% margin. Products with cost = 0 (manually entered,
// not from an XML feed) are left untouched.
//
// Recomputing from `cost` rather than multiplying the existing `price` by
// 1.5 is deliberate: the products this targets already carried a variable,
// inconsistent markup (0%-40%) from the original bulk XML import, so
// multiplying price directly would have compounded on top of that instead
// of producing a uniform 50% margin.
//
// This mirrors lib/xml-sync/calculatePrice.ts's calculatePrice(cost, 50).
//
// Usage: npx tsx scripts/apply-markup-migration.mjs [--remote]
// Defaults to the local D1 instance; pass --remote to target production.
//
// NOTE: this migration was already run directly against production on
// 2026-08-31 (4325 rows updated). The UPDATE is idempotent (it always
// recomputes from cost, never from the current price), so re-running this
// script is safe but a no-op against a database that already has it applied.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor.");
}

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

// Backup: snapshot every price this migration is about to touch, so a
// rollback is a straightforward set of UPDATE statements if ever needed.
const before = runD1("SELECT id, price, cost FROM products WHERE cost > 0 ORDER BY id;").results;
console.log(`Yedek alındı: ${before.length} ürünün mevcut fiyatı kaydedildi.`);
if (!before.length) {
  console.log("cost > 0 olan ürün yok, yapılacak bir şey yok.");
  process.exit(0);
}

const backupFile = join(
  mkdtempSync(join(tmpdir(), "markup-migration-backup-")),
  `products-price-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
writeFileSync(backupFile, JSON.stringify(before, null, 2), "utf8");
console.log(`Yedek dosyası: ${backupFile}`);

const result = runD1("UPDATE products SET price = ROUND(cost * 1.5) WHERE cost > 0;");
const changed = result.meta?.changes ?? 0;
console.log(`${changed} ürünün fiyatı güncellendi (price = ROUND(cost * 1.5)).`);

const mismatches = runD1(
  "SELECT COUNT(*) AS total FROM products WHERE cost > 0 AND price != ROUND(cost * 1.5);",
).results;
const mismatchCount = mismatches[0]?.total ?? 0;
if (mismatchCount > 0) {
  console.error(`UYARI: ${mismatchCount} üründe fiyat beklenen değere eşit değil.`);
  process.exit(1);
}
console.log("Doğrulama başarılı: tüm cost > 0 ürünlerde price = ROUND(cost * 1.5).");
