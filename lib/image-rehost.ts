import { getMediaBucket } from "./store-db";

export type ImageRehostResult = {
  migrated: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// Tedarikçinin sunucusu daha önce defalarca düştüğü için (HTTP 521) ana
// sitedeki görsellerin çoğu doğrudan oraya hotlink veriyordu - o sunucu
// düştüğünde ürün görsellerinin büyük kısmı aynı anda kırılıyor. Bu fonksiyon
// her çağrıda batchSize kadar ürünü bulup görsellerini kendi R2'mize taşıyor.
// syncSupplier() hover_image'ı kilit kontrolü olmadan her zaman tedarikçinin
// URL'siyle eziyor - bu yüzden bu iş tek seferlik değil, worker/index.ts'teki
// 6 saatlik cron'a da eklenip sürekli (idempotent) çalışıyor; yeniden
// hotlink'e dönen bir görsel bir sonraki turda tekrar yakalanır.
const HOTLINK_DOMAIN = "ebijuteri.com";

type FieldName = "image" | "hover_image";

const contentTypeToExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function rehostOne(imageUrl: string): Promise<string | null> {
  const response = await fetch(imageUrl);
  if (!response.ok || !response.body) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const extension = contentTypeToExtension[contentType];
  if (!extension) return null;
  const key = `products/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await getMediaBucket().put(key, response.body, {
    httpMetadata: { contentType },
  });
  return `/api/media/${key}`;
}

export async function rehostHotlinkedImages(
  db: D1Database,
  batchSize = 10,
): Promise<ImageRehostResult> {
  const rows = await db
    .prepare(
      `SELECT id, image, hover_image AS hoverImage FROM products
       WHERE image LIKE ? OR hover_image LIKE ?
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .bind(`%${HOTLINK_DOMAIN}%`, `%${HOTLINK_DOMAIN}%`, batchSize)
    .all<{ id: number; image: string; hoverImage: string | null }>();

  let migrated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of rows.results) {
    const updates: { field: FieldName; url: string }[] = [];
    try {
      if (product.image?.includes(HOTLINK_DOMAIN)) {
        const newUrl = await rehostOne(product.image);
        if (newUrl) updates.push({ field: "image", url: newUrl });
        else {
          failed += 1;
          errors.push(`#${product.id} image: indirilemedi veya desteklenmeyen tür`);
        }
      }
      if (product.hoverImage?.includes(HOTLINK_DOMAIN)) {
        const newUrl = await rehostOne(product.hoverImage);
        if (newUrl) updates.push({ field: "hover_image", url: newUrl });
        else {
          failed += 1;
          errors.push(`#${product.id} hover_image: indirilemedi veya desteklenmeyen tür`);
        }
      }
      if (updates.length) {
        await db.batch(
          updates.map((update) =>
            db
              .prepare(`UPDATE products SET ${update.field} = ? WHERE id = ?`)
              .bind(update.url, product.id),
          ),
        );
        migrated += 1;
      }
    } catch (error) {
      failed += 1;
      errors.push(`#${product.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  const remainingRow = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM products WHERE image LIKE ? OR hover_image LIKE ?`,
    )
    .bind(`%${HOTLINK_DOMAIN}%`, `%${HOTLINK_DOMAIN}%`)
    .first<{ n: number }>();

  return { migrated, failed, remaining: remainingRow?.n ?? 0, errors };
}
