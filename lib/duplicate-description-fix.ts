import { getOptionalEnv } from "./runtime-env";
import { rewriteProductDescription } from "./product-description-rewrite";

export type DuplicateDescriptionFixResult = {
  rewritten: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// Tedarikçi aynı jenerik ad+açıklamayı görsel olarak farklı ürünlere
// veriyor - Google bunları aynı içerik sayıp tek birini standart (canonical)
// seçiyor, diğerlerini dizinden düşürüyor (Search Console > Sayfa
// İndeksleme > "Kopya, Google kullanıcıdan farklı bir standart sayfa
// seçti"). Her duplicate grupta EN KÜÇÜK id'li ürün dokunulmadan kalır
// (Google'ın zaten standart seçmiş olabileceği "orijinal"), geri
// kalanlara rewriteProductDescription (bkz. o dosyadaki SYSTEM_PROMPT -
// tedarikçi metnini KOPYALAMADAN, gerçek ürün bilgilerinden özgün bir
// açıklama yazıyor) ile tek seferlik, gerçek veri temelli bir açıklama
// üretilir. Bu, yeni ürünlerde zaten otomatik çalışan aynı mekanizmanın
// (lib/xml-sync/syncSupplier.ts > uniqueDescriptionForNewProduct) geçmişe
// dönük uygulanmış hali - o fonksiyon sadece YENİ ürünlerde çalışıyor,
// bu 232 ürün özellik eklenmeden/API anahtarı tanımlanmadan önce
// oluşturulmuştu.
//
// Her çağrı en fazla batchSize kadar ürünü işler - her biri gerçek bir
// Claude API çağrısı gerektirdiği için (REST push'lardan çok daha yavaş),
// kasıtlı olarak küçük tutuldu. Bir satır rewrite edilince description'ı
// artık kardeşleriyle eşleşmediği için bir sonraki sorguda "duplicate"
// grubundan doğal olarak çıkar - ayrı bir işaretleme/offset gerekmez,
// tekrar tekrar çağırmak güvenli (idempotent).
export async function fixDuplicateDescriptions(
  db: D1Database,
  batchSize = 8,
): Promise<DuplicateDescriptionFixResult> {
  const apiKey = getOptionalEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { rewritten: 0, failed: 0, remaining: 0, errors: ["ANTHROPIC_API_KEY tanımlı değil."] };
  }

  const duplicateGroups = await db
    .prepare(
      `SELECT name, description, GROUP_CONCAT(id) AS ids
       FROM products
       WHERE status = 'published'
       GROUP BY name, description
       HAVING COUNT(*) > 1`,
    )
    .all<{ name: string; description: string; ids: string }>();

  const allTargets: { id: number; name: string; description: string }[] = [];
  for (const group of duplicateGroups.results) {
    const ids = group.ids
      .split(",")
      .map(Number)
      .sort((a, b) => a - b);
    for (const id of ids.slice(1)) {
      allTargets.push({ id, name: group.name, description: group.description });
    }
  }

  const chunk = allTargets.slice(0, batchSize);
  let rewritten = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const target of chunk) {
    const row = await db
      .prepare("SELECT category, stone FROM products WHERE id = ?")
      .bind(target.id)
      .first<{ category: string; stone: string }>();
    if (!row) continue;
    try {
      const newDescription = await rewriteProductDescription(apiKey, {
        name: target.name,
        stone: row.stone,
        category: row.category,
        description: target.description,
      });
      await db
        .prepare("UPDATE products SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(newDescription, target.id)
        .run();
      rewritten += 1;
    } catch (error) {
      failed += 1;
      errors.push(`#${target.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  return { rewritten, failed, remaining: allTargets.length - chunk.length, errors };
}
