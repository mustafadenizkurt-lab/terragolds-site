import { pushTrendyolImagesFor } from "./trendyol/sync";
import { pushHepsiburadaImagesFor } from "./hepsiburada/sync";
import { pushN11ImagesFor } from "./n11/sync";

// Admin panelinden bir ürünün görselleri (image, hover_image, image3,
// image4) değiştirildiğinde bu değişiklik önceden SADECE D1'e (yani sitemize)
// yazılıyordu - Trendyol/Hepsiburada/N11'e hiçbir kod yolu yeni görseli
// göndermiyordu (pazaryerine görsel yalnızca ürün ilk oluşturulurken
// gidiyordu). images_changed_at ürünün görselinin değiştiğini, images_pushed_at
// pazaryerlerine en son ne zaman başarıyla gönderildiğini tutar; ikisi
// arasında fark olan ürünler bu kuyrukta bekler (PUT anında + 6 saatlik cron).
export async function ensureMarketplaceImageColumns(db: D1Database): Promise<void> {
  const columns = await db.prepare("PRAGMA table_info(products)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("images_changed_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN images_changed_at TEXT").run();
  }
  if (!names.has("images_pushed_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN images_pushed_at TEXT").run();
  }
  if (!names.has("images_push_error")) {
    await db.prepare("ALTER TABLE products ADD COLUMN images_push_error TEXT").run();
  }
}

export type MarketplaceImagePushResult = {
  attempted: number;
  trendyol: number;
  hepsiburada: number;
  n11: number;
  remaining: number;
  errors: string[];
};

// Sadece bir pazaryerinde listelenmiş ürünler gerçekten gönderilir (her
// push*ImagesFor kendi "listelenmiş mi" filtresini uyguluyor). Üç pazaryerinden
// biri hata verirse o gruptaki ürünler kuyrukta kalır ve bir sonraki
// çalıştırmada tekrar denenir - başarılı olanlara yeniden göndermek zararsız.
export async function pushMarketplaceImages(
  db: D1Database,
  options: { productIds?: number[]; limit?: number } = {},
): Promise<MarketplaceImagePushResult> {
  await ensureMarketplaceImageColumns(db);
  const limit = Math.max(1, Math.min(options.limit ?? 200, 500));
  const pendingWhere =
    "images_changed_at IS NOT NULL AND (images_pushed_at IS NULL OR images_pushed_at < images_changed_at) AND status != 'deleted'";
  let ids: number[];
  if (options.productIds) {
    ids = options.productIds;
  } else {
    const rows = await db
      .prepare(`SELECT id FROM products WHERE ${pendingWhere} ORDER BY images_changed_at LIMIT ?`)
      .bind(limit)
      .all<{ id: number }>();
    ids = rows.results.map((row) => row.id);
  }
  const result: MarketplaceImagePushResult = {
    attempted: ids.length,
    trendyol: 0,
    hepsiburada: 0,
    n11: 0,
    remaining: 0,
    errors: [],
  };
  if (ids.length > 0) {
    const steps: [string, () => Promise<void>][] = [
      ["Trendyol", async () => { result.trendyol = (await pushTrendyolImagesFor(db, ids)).sent; }],
      ["Hepsiburada", async () => { result.hepsiburada = (await pushHepsiburadaImagesFor(db, ids)).sent; }],
      ["N11", async () => { result.n11 = (await pushN11ImagesFor(db, ids)).sent; }],
    ];
    for (const [name, step] of steps) {
      try {
        await step();
      } catch (error) {
        result.errors.push(`${name}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
      }
    }
    const placeholders = ids.map(() => "?").join(",");
    if (result.errors.length === 0) {
      await db
        .prepare(
          `UPDATE products SET images_pushed_at = CURRENT_TIMESTAMP, images_push_error = NULL WHERE id IN (${placeholders})`,
        )
        .bind(...ids)
        .run();
    } else {
      await db
        .prepare(`UPDATE products SET images_push_error = ? WHERE id IN (${placeholders})`)
        .bind(result.errors.join(" | ").slice(0, 500), ...ids)
        .run();
    }
  }
  const remaining = await db
    .prepare(`SELECT COUNT(*) AS n FROM products WHERE ${pendingWhere}`)
    .first<{ n: number }>();
  result.remaining = Number(remaining?.n ?? 0);
  return result;
}
