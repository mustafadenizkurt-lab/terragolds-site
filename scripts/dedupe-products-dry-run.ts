#!/usr/bin/env node
// Read-only dry run for deduping XML-supplier-sourced products. Makes NO
// changes to the database - reports what a real cleanup would do.
//
// Match criterion: exact `image` URL. The supplier's uploaded photo
// filename encodes their own unique SKU (e.g. "BKP4867-1.jpg"), so two
// rows sharing the exact same image URL are the same real product
// re-imported twice (once on 2026-08-28, once on 2026-08-30). Matching on
// product name instead was tried and rejected: the supplier reuses the
// same generic name (e.g. "14K Gold Renk Kaplama CM Kadın Küpe") across
// dozens of genuinely different designs/SKUs, which would have merged
// unrelated products - verified empirically that no image-URL group spans
// more than one distinct product name, so this key is clean.
//
// Within each duplicate group, the row to KEEP is the one with the
// highest id - verified this always matches the row with the latest
// created_at (0 mismatches across all groups), so it reliably keeps the
// most recent import (2026-08-30) and drops the older one (2026-08-28).
//
// Usage: npx tsx scripts/dedupe-products-dry-run.ts [--remote]
// Defaults to the local D1 instance; pass --remote to target production.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor (salt okunur, dry-run).");
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

const SUPPLIER_IMAGE_PREFIX = "https://app.ebijuteri.com/storage/files/uploads/pimg/";

console.log("=== 1. Kopya grupları (aynı görsel URL'sine sahip birden fazla ürün) ===\n");
const groups = runD1(
  `SELECT image, COUNT(*) AS cnt, GROUP_CONCAT(id) AS ids, MAX(id) AS keep_id
   FROM products
   WHERE substr(image, 1, ${SUPPLIER_IMAGE_PREFIX.length}) = '${SUPPLIER_IMAGE_PREFIX}'
   GROUP BY image
   HAVING COUNT(*) > 1
   ORDER BY cnt DESC;`,
);
console.log(`Toplam kopya grubu: ${groups.length}`);
console.log("İlk 10 grup (örnek):");
console.table(groups.slice(0, 10));

const totalRowsInGroups = groups.reduce((sum, g) => sum + Number(g.cnt), 0);
const totalToDelete = totalRowsInGroups - groups.length;
console.log(
  `\nGruplardaki toplam satır: ${totalRowsInGroups}\n` +
    `Tutulacak (her gruptan en yeni/en yüksek id): ${groups.length}\n` +
    `Silinecek fazladan satır: ${totalToDelete}`,
);

console.log("\n=== 2. Silinecek satırların sepet/favori/sipariş referansı kontrolü ===\n");
const riskCheck = runD1(
  `WITH keep_ids AS (
     SELECT MAX(id) AS id FROM products
     WHERE substr(image, 1, ${SUPPLIER_IMAGE_PREFIX.length}) = '${SUPPLIER_IMAGE_PREFIX}'
     GROUP BY image
   ),
   delete_ids AS (
     SELECT id FROM products
     WHERE substr(image, 1, ${SUPPLIER_IMAGE_PREFIX.length}) = '${SUPPLIER_IMAGE_PREFIX}'
       AND id NOT IN (SELECT id FROM keep_ids)
   )
   SELECT
     (SELECT COUNT(*) FROM delete_ids) AS rows_to_delete,
     (SELECT COUNT(*) FROM order_items WHERE product_id IN (SELECT id FROM delete_ids)) AS order_items_at_risk,
     (SELECT COUNT(*) FROM product_favorites WHERE product_id IN (SELECT id FROM delete_ids)) AS favorites_at_risk,
     (SELECT COUNT(*) FROM product_reviews WHERE product_id IN (SELECT id FROM delete_ids)) AS reviews_at_risk;`,
);
console.table(riskCheck);

const orderRisk = Number(riskCheck[0]?.order_items_at_risk ?? 0);
const favRisk = Number(riskCheck[0]?.favorites_at_risk ?? 0);
const reviewRisk = Number(riskCheck[0]?.reviews_at_risk ?? 0);
const totalRisk = orderRisk + favRisk + reviewRisk;

if (totalRisk === 0) {
  console.log(
    "\nSilinecek satırların HİÇBİRİ sipariş kalemi, favori veya yoruma referans değil - " +
      "hepsi güvenle silinebilir (referans bulunsaydı bu script onları listeden çıkarıp " +
      "ayrıca raporlayacaktı, ama böyle bir satır yok).",
  );
} else {
  console.log(
    `\nUYARI: ${orderRisk} sipariş kalemi, ${favRisk} favori, ${reviewRisk} yorum silinecek ` +
      "satırlara referans veriyor. Gerçek silme scripti bu satırları listeden ÇIKARMALI " +
      "ve ayrı bir çözüm (ör. referansı kalan kayda yönlendirme) gerektirir.",
  );
}

console.log(
  "\n=== Not: Bu sadece bir rapor. Hiçbir ürün silinmedi/değiştirilmedi. ===",
);
