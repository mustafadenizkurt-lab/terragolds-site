#!/usr/bin/env node
// One-time backfill: generates a unique, SEO-oriented `seo_description` for
// every product whose seo_description is still NULL (XML-imported products
// share the exact supplier copy across dozens of other stores, which Google
// Search Console flags as "Crawled - currently not indexed"). Does NOT touch
// the existing `description` column - see lib/product-seo-description.ts for
// the prompt this uses.
//
// Usage: ANTHROPIC_API_KEY=... npx tsx scripts/generate-seo-descriptions.ts [--remote] [--limit N] [--batch-size N] [--delay-ms N]
// Defaults to the local D1 instance; pass --remote to target production.
//
// This script only WRITES a .sql file of batched UPDATE statements - it
// never applies them. Review the file, then apply it yourself with:
//   npx wrangler d1 execute DB --remote --file <path-printed-below>
//
// Resumable across runs: only ever selects rows where seo_description IS
// NULL, so once you've applied a batch's .sql file, those products are
// excluded from the next run automatically. Progress within a single run is
// also flushed to disk after every batch, so Ctrl+C mid-run only loses the
// batch that was in flight, not everything generated so far.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateSeoDescription } from "../lib/product-seo-description";

const target = process.argv.includes("--remote") ? "--remote" : "--local";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const limit = Number(argValue("--limit")) || undefined;
const batchSize = Number(argValue("--batch-size")) || 20;
const delayMs = Number(argValue("--delay-ms")) || 5000;
const CONCURRENCY = 5;

// .env.local'a asla yazılmıyor, sadece varsa ortam değişkeninden okunuyor -
// istek üzerine kasıtlı olarak böyle.
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY ortam değişkeni gerekli.");
  process.exit(1);
}
if (target === "--remote") {
  console.log("UYARI: production (--remote) veritabanına karşı SADECE OKUMA yapılacak - hiçbir şey yazılmayacak, sadece .sql dosyası üretilecek.");
}

// wrangler'ın --remote --json çıktısından önce spinner/ilerleme satırları
// gelebiliyor (bunlar da '[' içerebiliyor) ve sonuç dizisindeki girdilerin
// sırası garanti değil - bu yüzden her '[' konumundan JSON.parse denenip
// `results` alanı olan girdi seçiliyor. lib/backfill-product-seo.mjs ve
// rewrite-product-descriptions.mjs ile aynı, kanıtlanmış desen.
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
  // Windows'ta execFileSync npx.cmd'yi çözebilmek için shell: true istiyor,
  // ama o zaman cmd.exe komut satırını yeniden ayrıştırıp SQL içindeki `<>`
  // gibi karakterleri yönlendirme operatörü sanabiliyor - bu yüzden SQL bir
  // geçici dosyaya yazılıp --file ile veriliyor, --command ile değil.
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

function sqlEscape(value: string): string {
  return value.replaceAll("'", "''");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ProductRow = {
  id: number;
  name: string;
  stone: string;
  category: string;
  description: string;
};

const limitClause = Number.isFinite(limit) ? ` LIMIT ${limit}` : "";
const rows = runD1(
  `SELECT id, name, stone, category, description FROM products WHERE seo_description IS NULL ORDER BY id${limitClause}`,
) as ProductRow[];

console.log(`${rows.length} ürün için SEO açıklaması üretilecek (${target}).`);
if (!rows.length) {
  console.log("Yapılacak bir şey yok - tüm ürünlerin seo_description'ı zaten dolu.");
  process.exit(0);
}

const outputDir = join(process.cwd(), "scripts", "output");
mkdirSync(outputDir, { recursive: true });
const outputFile = join(
  outputDir,
  `seo-descriptions-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
);

const statements: string[] = [];
let succeeded = 0;
let failed = 0;

function flush() {
  const header = [
    `-- generate-seo-descriptions.ts tarafından üretildi`,
    `-- ${new Date().toISOString()} - hedef: ${target}`,
    `-- ${succeeded} ürün başarılı, ${failed} ürün başarısız (atlandı, bir sonraki çalıştırmada tekrar denenecek)`,
    `-- Uygulamak için: npx wrangler d1 execute DB --remote --file ${outputFile}`,
    "",
  ].join("\n");
  writeFileSync(outputFile, header + statements.join("\n") + "\n", "utf8");
}

const batches: ProductRow[][] = [];
for (let i = 0; i < rows.length; i += batchSize) {
  batches.push(rows.slice(i, i + batchSize));
}

for (const [batchIndex, batch] of batches.entries()) {
  console.log(
    `Batch ${batchIndex + 1}/${batches.length} (${batch.length} ürün) işleniyor...`,
  );

  let cursor = 0;
  async function worker() {
    while (cursor < batch.length) {
      const row = batch[cursor++];
      try {
        const seoDescription = await generateSeoDescription(apiKey!, row);
        statements.push(
          `UPDATE products SET seo_description = '${sqlEscape(seoDescription)}' WHERE id = ${row.id};`,
        );
        succeeded += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `  #${row.id} (${row.name}) başarısız, atlanıyor (sonraki çalıştırmada tekrar denenecek):`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  flush();
  console.log(
    `  ${succeeded + failed}/${rows.length} tamamlandı (${succeeded} başarılı, ${failed} başarısız). SQL dosyası güncellendi: ${outputFile}`,
  );

  const isLastBatch = batchIndex === batches.length - 1;
  if (!isLastBatch && delayMs > 0) {
    await sleep(delayMs);
  }
}

console.log("");
console.log(`Bitti. ${succeeded} ürün için açıklama üretildi, ${failed} ürün başarısız oldu.`);
console.log(`SQL dosyası: ${outputFile}`);
console.log("Bu script SQL'i UYGULAMADI. Kontrol ettikten sonra kendiniz çalıştırın:");
console.log(`  npx wrangler d1 execute DB --remote --file ${outputFile}`);
