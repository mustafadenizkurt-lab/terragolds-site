#!/usr/bin/env node
// Removes duplicate XML-supplier-sourced products. See
// scripts/dedupe-products-dry-run.ts for why the matching criterion is the
// exact `image` URL (not product name - the supplier reuses generic names
// across distinct SKUs) and why "keep the highest id" reliably keeps the
// most recent import (verified: 0 mismatches against created_at).
//
// TWO MODES:
//   npx tsx scripts/dedupe-products.ts [--remote]            dry-run (default) - reports only, deletes nothing
//   npx tsx scripts/dedupe-products.ts [--remote] --confirm  actually deletes
//
// Without --confirm this script NEVER deletes anything, no matter what
// else is passed. Only run --confirm after a human has reviewed the
// dry-run report and explicitly approved it.
//
// What --confirm does, in order:
//   1. Aborts if any row slated for deletion is referenced by an order
//      item, favorite, or review (this script doesn't handle reassignment).
//   2. Writes a log file (which ids, with full row detail) before touching
//      anything.
//   3. Takes a full D1 backup via `wrangler d1 export`.
//   4. Deletes the duplicate rows inside a single transaction
//      (BEGIN/COMMIT) - if anything fails, nothing is removed.
//   5. Re-counts products before vs. after and fails loudly if the
//      difference doesn't exactly match the number of rows deleted.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const confirm = process.argv.includes("--confirm");
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor.");
}
console.log(confirm ? "MOD: GERÇEK SİLME (--confirm)" : "MOD: dry-run (hiçbir şey silinmeyecek)");

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

function runD1(sql: string): { results: Record<string, unknown>[]; changes?: number } {
  const tmpFile = join(mkdtempSync(join(tmpdir(), "d1-query-")), "query.sql");
  writeFileSync(tmpFile, sql, "utf8");
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", target, "--json", "--file", tmpFile],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, shell: true },
  );
  const parsed = parseWranglerJsonArray(output);
  const resultEntry = parsed.find(
    (entry): entry is { results: Record<string, unknown>[]; meta?: { changes?: number } } =>
      Array.isArray((entry as { results?: unknown })?.results),
  );
  return {
    results: resultEntry?.results ?? [],
    changes: (resultEntry as { meta?: { changes?: number } } | undefined)?.meta?.changes,
  };
}

const SUPPLIER_IMAGE_PREFIX = "https://app.ebijuteri.com/storage/files/uploads/pimg/";
const runDir = mkdtempSync(join(tmpdir(), "dedupe-products-"));
mkdirSync(runDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

// 1. Work out exactly which rows would be deleted.
const groups = runD1(
  `SELECT image, COUNT(*) AS cnt, GROUP_CONCAT(id) AS ids, MAX(id) AS keep_id
   FROM products
   WHERE substr(image, 1, ${SUPPLIER_IMAGE_PREFIX.length}) = '${SUPPLIER_IMAGE_PREFIX}'
   GROUP BY image
   HAVING COUNT(*) > 1;`,
).results;

const deleteIds: number[] = [];
for (const g of groups) {
  const ids = String(g.ids).split(",").map(Number);
  const keepId = Number(g.keep_id);
  for (const id of ids) if (id !== keepId) deleteIds.push(id);
}
deleteIds.sort((a, b) => a - b);

console.log(`Kopya grubu: ${groups.length}`);
console.log(`Silinecek satır: ${deleteIds.length}`);

if (!deleteIds.length) {
  console.log("Silinecek kopya yok, yapılacak bir şey kalmadı.");
  process.exit(0);
}

// 2. Safety check: refuse if any deletion target is referenced elsewhere.
const idList = deleteIds.join(",");
const risk = runD1(
  `SELECT
     (SELECT COUNT(*) FROM order_items WHERE product_id IN (${idList})) AS order_items_at_risk,
     (SELECT COUNT(*) FROM product_favorites WHERE product_id IN (${idList})) AS favorites_at_risk,
     (SELECT COUNT(*) FROM product_reviews WHERE product_id IN (${idList})) AS reviews_at_risk;`,
).results[0];
const orderRisk = Number(risk?.order_items_at_risk ?? 0);
const favRisk = Number(risk?.favorites_at_risk ?? 0);
const reviewRisk = Number(risk?.reviews_at_risk ?? 0);
console.log(
  `Referans kontrolü - sipariş: ${orderRisk}, favori: ${favRisk}, yorum: ${reviewRisk}`,
);
if (orderRisk + favRisk + reviewRisk > 0) {
  console.error(
    "\nDURDURULDU: silinecek satırlardan bazıları sipariş/favori/yoruma referans veriyor. " +
      "Bu script referans yeniden atama yapmıyor - önce o satırları elle ele almak gerekir.",
  );
  process.exit(1);
}

// 3. Log the full detail of what's about to be touched, before touching it.
const detailRows = runD1(
  `SELECT id, name, category, image, cost, price, created_at FROM products WHERE id IN (${idList}) ORDER BY id;`,
).results;
const logFile = join(runDir, `dedupe-log-${stamp}.json`);
writeFileSync(
  logFile,
  JSON.stringify({ target, mode: confirm ? "confirm" : "dry-run", groupCount: groups.length, deleteIds, rows: detailRows }, null, 2),
  "utf8",
);
console.log(`Log dosyası: ${logFile}`);

if (!confirm) {
  console.log("\nDry-run tamamlandı. Hiçbir şey silinmedi. Gerçek silme için --confirm ekleyin.");
  process.exit(0);
}

// 4. Full D1 backup BEFORE deleting anything.
const backupFile = join(runDir, `d1-backup-before-dedupe-${stamp}.sql`);
console.log(`\nYedek alınıyor: ${backupFile}`);
execFileSync(
  "npx",
  ["wrangler", "d1", "export", "DB", target, "--output", backupFile],
  { stdio: "inherit", shell: true },
);
console.log("Yedek tamamlandı.");

// 5. Delete inside an explicit transaction - all or nothing.
const beforeCount = Number(runD1("SELECT COUNT(*) AS c FROM products;").results[0]?.c ?? 0);
const deleteSql = `BEGIN TRANSACTION;\nDELETE FROM products WHERE id IN (${idList});\nCOMMIT;`;
const deleteFile = join(runDir, `delete-${stamp}.sql`);
writeFileSync(deleteFile, deleteSql, "utf8");
console.log(`\n${deleteIds.length} satır siliniyor (tek transaction içinde)...`);
execFileSync(
  "npx",
  ["wrangler", "d1", "execute", "DB", target, "--file", deleteFile],
  { stdio: "inherit", shell: true },
);

// 6. Verify: exact row-count difference must match what we intended to delete.
const afterCount = Number(runD1("SELECT COUNT(*) AS c FROM products;").results[0]?.c ?? 0);
const actualDeleted = beforeCount - afterCount;
console.log(
  `\nSilme öncesi ürün sayısı: ${beforeCount}\n` +
    `Silme sonrası ürün sayısı: ${afterCount}\n` +
    `Fiilen silinen: ${actualDeleted} (beklenen: ${deleteIds.length})`,
);
if (actualDeleted !== deleteIds.length) {
  console.error(
    "\nUYARI: silinen satır sayısı beklenenle eşleşmiyor! Yedek dosyasından " +
      `(${backupFile}) durumu kontrol edin.`,
  );
  process.exit(1);
}
console.log("\nDoğrulama başarılı: beklenen tüm kopya satırlar silindi, başka hiçbir satıra dokunulmadı.");
