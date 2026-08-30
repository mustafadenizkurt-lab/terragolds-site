#!/usr/bin/env node
// One-time backfill: generates slug + meta_title + meta_description for every
// product that doesn't have a slug yet (i.e. products.slug = '').
// Usage: npx tsx scripts/backfill-product-seo.mjs [--remote]
// Defaults to the local D1 instance; pass --remote to target production.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productNameToSlug } from "../lib/product-slugs.ts";
import { productDescriptorPhrase } from "../lib/store-data.ts";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor.");
}

function runD1(sql) {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", target, "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, shell: true },
  );
  const parsed = JSON.parse(output);
  return parsed[0]?.results ?? [];
}

function sqlEscape(value) {
  return value.replaceAll("'", "''");
}

const rows = runD1(
  "SELECT id, name, stone, category, description FROM products WHERE slug = ''",
);
console.log(`${rows.length} ürün için slug/meta üretilecek.`);
if (!rows.length) {
  console.log("Yapılacak bir şey yok.");
  process.exit(0);
}

const existingRows = runD1("SELECT slug FROM products WHERE slug <> ''");
const existingSlugs = new Set(existingRows.map((row) => row.slug));

const statements = rows.map((row) => {
  const slug = productNameToSlug(row.name, row.id, existingSlugs);
  existingSlugs.add(slug);
  const metaTitle = `${row.name} – ${row.stone || row.category}`;
  const metaDescription =
    `${row.name}, ${productDescriptorPhrase(row)}. ${row.description}`.slice(
      0,
      155,
    );
  return (
    `UPDATE products SET slug = '${sqlEscape(slug)}', ` +
    `meta_title = '${sqlEscape(metaTitle)}', ` +
    `meta_description = '${sqlEscape(metaDescription)}' ` +
    `WHERE id = ${row.id};`
  );
});

const tmpFile = join(
  mkdtempSync(join(tmpdir(), "seo-backfill-")),
  "backfill.sql",
);
writeFileSync(tmpFile, statements.join("\n"), "utf8");
console.log(`SQL dosyası: ${tmpFile}`);

execFileSync("npx", ["wrangler", "d1", "execute", "DB", target, "--file", tmpFile], {
  stdio: "inherit",
  shell: true,
});
console.log(`${rows.length} ürün güncellendi.`);
