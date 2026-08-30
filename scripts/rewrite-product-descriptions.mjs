#!/usr/bin/env node
// One-time backfill: rewrites every product's description with Claude so
// it's no longer a byte-for-byte copy of the supplier XML feed (duplicate
// content across every other store using the same feed). Covers products
// from both import paths (the xml_suppliers cron sync and the admin bulk
// "supplier-import" panel) since neither reliably marks provenance.
// Usage: ANTHROPIC_API_KEY=... npx tsx scripts/rewrite-product-descriptions.mjs [--remote] [--limit N]
// Defaults to the local D1 instance; pass --remote to target production.
// Re-running reprocesses every product again (no "already rewritten" flag),
// so avoid running it twice against --remote without a reason to.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rewriteProductDescription } from "../lib/product-description-rewrite.ts";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const limitIndex = process.argv.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : undefined;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY ortam değişkeni gerekli.");
  process.exit(1);
}
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı çalışıyor.");
}

function runD1(sql) {
  // Written to a temp .sql file and run with --file rather than --command:
  // on Windows, execFileSync needs shell: true to resolve npx.cmd, and
  // cmd.exe then reparses the whole command line, misreading SQL characters
  // like `<>` as redirection operators.
  const tmpFile = join(mkdtempSync(join(tmpdir(), "d1-query-")), "query.sql");
  writeFileSync(tmpFile, sql, "utf8");
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "DB", target, "--json", "--file", tmpFile],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, shell: true },
  );
  // --remote can print progress lines (e.g. "Checking if file needs
  // uploading", spinner frames, "[1/2]" counters) to stdout ahead of the
  // JSON even with --json, and those can themselves contain '[' characters
  // - so anchor on wrangler's actual response shape ('[{"results":') rather
  // than the first/last bracket in the output.
  const match = output.match(/\[\s*\{\s*"results"\s*:/);
  const parsed = JSON.parse(match ? output.slice(match.index) : output);
  return parsed[0]?.results ?? [];
}

function sqlEscape(value) {
  return value.replaceAll("'", "''");
}

const limitClause = Number.isFinite(limit) ? ` LIMIT ${limit}` : "";
const rows = runD1(
  `SELECT id, name, stone, category, description FROM products WHERE description <> '' ORDER BY id${limitClause}`,
);
if (rows.some((row) => !row || typeof row.id !== "number" || typeof row.description !== "string")) {
  console.error("D1 sorgusunun sonucu beklenen şekilde değil, satır:", JSON.stringify(rows[0]));
  process.exit(1);
}
console.log(`${rows.length} ürün için açıklama yeniden yazılacak.`);
if (!rows.length) {
  console.log("Yapılacak bir şey yok.");
  process.exit(0);
}

const CONCURRENCY = 5;
const results = new Array(rows.length);
let cursor = 0;
let done = 0;

async function worker() {
  while (cursor < rows.length) {
    const index = cursor++;
    const row = rows[index];
    try {
      results[index] = await rewriteProductDescription(apiKey, row);
    } catch (error) {
      console.error(`  #${row.id} (${row.name}) başarısız, ham açıklama korunuyor:`, error.message);
      results[index] = row.description;
    }
    done += 1;
    if (done % 25 === 0 || done === rows.length) {
      console.log(`  ${done}/${rows.length}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const statements = rows.map(
  (row, i) => `UPDATE products SET description = '${sqlEscape(results[i])}' WHERE id = ${row.id};`,
);

const tmpFile = join(
  mkdtempSync(join(tmpdir(), "description-rewrite-")),
  "rewrite.sql",
);
writeFileSync(tmpFile, statements.join("\n"), "utf8");
console.log(`SQL dosyası: ${tmpFile}`);

execFileSync("npx", ["wrangler", "d1", "execute", "DB", target, "--file", tmpFile], {
  stdio: "inherit",
  shell: true,
});
console.log(`${rows.length} ürün güncellendi.`);
