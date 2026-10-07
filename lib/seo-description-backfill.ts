import { getOptionalEnv } from "./runtime-env";
import { generateSeoDescription } from "./product-seo-description";

export type SeoDescriptionBackfillResult = {
  filled: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// lib/duplicate-description-fix.ts'teki fixDuplicateDescriptions ile aynı
// desen: her çağrı en fazla batchSize ürün işler (her biri gerçek bir Claude
// API çağrısı), bir satır doldurulunca bir sonraki sorgunun WHERE koşulundan
// doğal olarak çıkar - tekrar tekrar çağırmak güvenli (idempotent).
export async function backfillSeoDescriptions(
  db: D1Database,
  batchSize = 8,
): Promise<SeoDescriptionBackfillResult> {
  const apiKey = getOptionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { filled: 0, failed: 0, remaining: 0, errors: ["ANTHROPIC_API_KEY tanımlı değil."] };
  }

  const targets = await db
    .prepare(
      `SELECT id, name, stone, category, description
       FROM products
       WHERE status = 'published'
         AND (seo_description IS NULL OR seo_description = '')
       ORDER BY id
       LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number; name: string; stone: string; category: string; description: string }>();

  let filled = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of targets.results) {
    try {
      const seoDescription = await generateSeoDescription(apiKey, {
        name: product.name,
        stone: product.stone,
        category: product.category,
        description: product.description,
      });
      await db
        .prepare(
          "UPDATE products SET seo_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(seoDescription, product.id)
        .run();
      filled += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `#${product.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  const remainingRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM products
       WHERE status = 'published' AND (seo_description IS NULL OR seo_description = '')`,
    )
    .first<{ n: number }>();

  return { filled, failed, remaining: remainingRow?.n ?? 0, errors };
}
