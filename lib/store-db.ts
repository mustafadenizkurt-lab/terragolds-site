import { env } from "cloudflare:workers";
import {
  defaultProducts,
  defaultSettings,
  settingsKeys,
  type Product,
  type StoreSettings,
} from "./store-data";

type ProductRow = {
  id: number;
  name: string;
  stone: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  image: string;
  hover_image: string | null;
  badge: string | null;
  campaign_label: string | null;
  discount_percent: number;
  review_average: number;
  review_count: number;
  description: string;
  status: string;
  shopier_url: string | null;
  shopier_product_id: string | null;
  shopier_sync_status: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  featured: number;
  sort_order: number;
  created_at: string;
};

function bindings() {
  return env as unknown as {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    ADMIN_EMAILS?: string;
  };
}

export function getD1() {
  const database = bindings().DB;
  if (!database) throw new Error("Veritabanı bağlantısı hazır değil.");
  return database;
}

export function getMediaBucket() {
  const bucket = bindings().MEDIA;
  if (!bucket) throw new Error("Görsel depolama bağlantısı hazır değil.");
  return bucket;
}

export function getAdminEmailAllowlist() {
  return (bindings().ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLocaleLowerCase("tr-TR"))
    .filter(Boolean);
}

export async function ensureSeedData() {
  const db = getD1();
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "hover_image")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hover_image TEXT").run();
  }

  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM products")
    .first<{ total: number }>();
  const seedVersion = await db
    .prepare("SELECT value FROM store_settings WHERE key = ? LIMIT 1")
    .bind("demo_catalog_seed_version")
    .first<{ value: string }>();

  if (
    !count?.total ||
    count.total < defaultProducts.length ||
    seedVersion?.value !== "2026-07-30-hover-gallery"
  ) {
    await db.batch(
      defaultProducts.map((product) =>
        db
          .prepare(
            `INSERT INTO products
              (id, name, stone, category, price, stock, image, hover_image, badge,
               campaign_label, discount_percent, description,
               status, shopier_url, shopier_product_id, shopier_sync_status,
               slug, featured, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               stone = excluded.stone,
               category = excluded.category,
               price = excluded.price,
               stock = excluded.stock,
               image = excluded.image,
               hover_image = COALESCE(products.hover_image, excluded.hover_image),
               badge = excluded.badge,
               campaign_label = excluded.campaign_label,
               discount_percent = excluded.discount_percent,
               description = excluded.description,
               status = excluded.status,
               shopier_sync_status = excluded.shopier_sync_status,
               slug = CASE WHEN products.slug = '' THEN excluded.slug ELSE products.slug END,
               featured = excluded.featured,
               sort_order = excluded.sort_order,
               updated_at = CURRENT_TIMESTAMP`,
          )
          .bind(
            product.id,
            product.name,
            product.stone,
            product.category,
            product.price,
            product.stock,
            product.image,
            product.hoverImage ?? null,
            product.badge ?? null,
            product.campaignLabel ?? null,
            product.discountPercent,
            product.description,
            product.status,
            product.shopierUrl ?? null,
            product.shopierProductId ?? null,
            product.shopierSyncStatus,
            product.slug,
            product.featured ? 1 : 0,
            product.sortOrder,
          ),
      ),
    );

    await db
      .prepare(
        `INSERT INTO store_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind("demo_catalog_seed_version", "2026-07-30-hover-gallery")
      .run();
  }

  await db
    .prepare(
      `INSERT OR IGNORE INTO product_categories
        (name, description, active, sort_order)
       SELECT category, '', 1, MIN(sort_order)
       FROM products
       WHERE TRIM(category) <> ''
       GROUP BY category`,
    )
    .run();

  await db.batch(
    settingsKeys.map((key) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO store_settings (key, value) VALUES (?, ?)",
        )
        .bind(key, defaultSettings[key]),
    ),
  );
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    stone: row.stone,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    image: row.image,
    hoverImage: row.hover_image ?? undefined,
    badge: row.badge ?? undefined,
    campaignLabel: row.campaign_label ?? undefined,
    discountPercent: row.discount_percent,
    reviewAverage: Number(row.review_average) || 0,
    reviewCount: Number(row.review_count) || 0,
    description: row.description,
    status: row.status === "draft" ? "draft" : "published",
    shopierUrl: row.shopier_url ?? undefined,
    shopierProductId: row.shopier_product_id ?? undefined,
    shopierSyncStatus:
      row.shopier_sync_status === "connected" ||
      row.shopier_sync_status === "pending" ||
      row.shopier_sync_status === "error"
        ? row.shopier_sync_status
        : "manual",
    slug: row.slug,
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    featured: Boolean(row.featured),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function readProducts(includeDrafts = false) {
  await ensureSeedData();
  const db = getD1();
  const statement = includeDrafts
    ? `SELECT products.*,
              COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
              COUNT(product_reviews.id) AS review_count
       FROM products
       LEFT JOIN product_reviews ON product_reviews.product_id = products.id
       GROUP BY products.id
       ORDER BY products.sort_order, products.id`
    : `SELECT products.*,
              COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
              COUNT(product_reviews.id) AS review_count
       FROM products
       LEFT JOIN product_reviews ON product_reviews.product_id = products.id
       WHERE products.status = 'published'
       GROUP BY products.id
       ORDER BY products.sort_order, products.id`;
  const result = await db.prepare(statement).all<ProductRow>();
  return result.results.map(mapProduct);
}

export async function readSettings() {
  await ensureSeedData();
  const result = await getD1()
    .prepare("SELECT key, value FROM store_settings")
    .all<{ key: string; value: string }>();

  const settings = { ...defaultSettings };
  for (const row of result.results) {
    if (settingsKeys.includes(row.key as keyof StoreSettings)) {
      settings[row.key as keyof StoreSettings] = row.value;
    }
  }
  return settings;
}
