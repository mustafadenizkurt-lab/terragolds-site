import { env } from "cloudflare:workers";
import {
  defaultProducts,
  defaultSettings,
  getDiscountedPrice,
  settingsKeys,
  type Product,
  type StoreSettings,
} from "./store-data";
import { pickRotatingShowcase } from "./rotating-showcase";

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
  xml_external_id: string | null;
  created_at: string;
  updated_at: string;
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

  // The category-from-products backfill below scans every row (GROUP BY
  // category) to catch any category name that doesn't have a
  // product_categories row yet. That's real one-time setup work, not
  // something every page load needs to redo - once at least one category
  // row exists, this cheap existence check short-circuits it. It re-runs
  // automatically if product_categories is ever emptied out, or (via the
  // !count?.total check) while the products table itself is still empty.
  const hasCategoryRow = await db
    .prepare("SELECT 1 FROM product_categories LIMIT 1")
    .first<{ 1: number }>();
  if (!count?.total || !hasCategoryRow) {
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
  }

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
    xmlExternalId: row.xml_external_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

/**
 * Fetches a single product by numeric id or slug, instead of pulling the
 * whole catalog (with its review JOIN/GROUP BY) just to find one row.
 */
export async function readProductByIdOrSlug(idOrSlug: string, includeDrafts = false) {
  await ensureSeedData();
  const db = getD1();
  const isNumericId = /^\d+$/.test(idOrSlug);
  const statement = `SELECT products.*,
            COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
            COUNT(product_reviews.id) AS review_count
     FROM products
     LEFT JOIN product_reviews ON product_reviews.product_id = products.id
     WHERE ${isNumericId ? "products.id = ?1" : "products.slug = ?1"}${includeDrafts ? "" : " AND products.status = 'published'"}
     GROUP BY products.id
     LIMIT 1`;
  const row = await db
    .prepare(statement)
    .bind(isNumericId ? Number(idOrSlug) : idOrSlug)
    .first<ProductRow>();
  return row ? mapProduct(row) : null;
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

// --- Below: query-level building blocks for the storefront-catalog
// performance work (see PROJECT NOTES: "en büyük performans sorunu" plan).
// Not wired into any route or component yet - that's later, per-consumer
// migration phases, once each one is ready to move off the full-catalog
// /api/store payload.

export type ReadProductsPageOptions = {
  page?: number;
  pageSize?: number;
  /** Exact match against products.category. "Tümü" (or omitted) means no filter. */
  category?: string;
  /** Case-insensitive substring match against name/stone/category/description. */
  q?: string;
  /** Inclusive bounds, compared against the discounted price (see below). */
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  discountOnly?: boolean;
};

export type ProductsPage = {
  products: Product[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// Mirrors getDiscountedPrice() in lib/store-data.ts: discount clamped to
// 0-90, then price * (100 - discount) / 100, rounded. SQLite's min()/max()
// are scalar (not aggregate) when called with 2+ arguments, so this reads
// the same as the JS version.
const DISCOUNTED_PRICE_SQL =
  "ROUND(products.price * (100 - MIN(90, MAX(0, products.discount_percent))) / 100.0)";

// SQLite's LOWER() only case-folds ASCII A-Z, so it leaves Turkish letters
// (İ, I, Ç, Ğ, Ö, Ş, Ü) untouched - "İnci" would stay "İnci" instead of
// becoming "inci", breaking LIKE matches against a query already lowered
// with JS's tr-TR locale (which folds I -> ı and İ -> i, not the ASCII
// I -> i mapping). Replacing the Turkish letters explicitly before LOWER()
// reproduces the same casefolding SQL-side.
function trLowerSql(column: string): string {
  return `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column},'İ','i'),'I','ı'),'Ç','ç'),'Ğ','ğ'),'Ö','ö'),'Ş','ş'),'Ü','ü'))`;
}

/**
 * Paginated + filtered product listing, computed in D1 (WHERE/LIMIT/OFFSET)
 * instead of fetching the whole catalog and filtering it in the browser.
 * Intended to back the public catalog grid (currently home-client.tsx's
 * filteredProducts/catalogProducts/pagination chain).
 */
export async function readProductsPage(
  options: ReadProductsPageOptions = {},
): Promise<ProductsPage> {
  await ensureSeedData();
  const db = getD1();

  const pageSize = Math.min(100, Math.max(1, Math.round(options.pageSize ?? 15)));
  const requestedPage = Math.max(1, Math.round(options.page ?? 1));

  const conditions: string[] = ["products.status = 'published'"];
  const params: (string | number)[] = [];

  if (options.category && options.category !== "Tümü") {
    conditions.push("products.category = ?");
    params.push(options.category);
  }
  if (options.q?.trim()) {
    const like = `%${options.q.trim().toLocaleLowerCase("tr-TR")}%`;
    conditions.push(
      `(${trLowerSql("products.name")} LIKE ? OR ${trLowerSql("products.stone")} LIKE ?
        OR ${trLowerSql("products.category")} LIKE ? OR ${trLowerSql("products.description")} LIKE ?)`,
    );
    params.push(like, like, like, like);
  }
  if (options.inStock) {
    conditions.push("products.stock > 0");
  }
  if (options.discountOnly) {
    conditions.push("products.discount_percent > 0");
  }
  if (options.minPrice !== undefined) {
    conditions.push(`${DISCOUNTED_PRICE_SQL} >= ?`);
    params.push(options.minPrice);
  }
  if (options.maxPrice !== undefined) {
    conditions.push(`${DISCOUNTED_PRICE_SQL} <= ?`);
    params.push(options.maxPrice);
  }

  const whereClause = conditions.join(" AND ");

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM products WHERE ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();
  const totalCount = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const rows = await db
    .prepare(
      `SELECT products.*,
              COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
              COUNT(product_reviews.id) AS review_count
       FROM products
       LEFT JOIN product_reviews ON product_reviews.product_id = products.id
       WHERE ${whereClause}
       GROUP BY products.id
       ORDER BY products.sort_order, products.id
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, pageSize, offset)
    .all<ProductRow>();

  return {
    products: rows.results.map(mapProduct),
    page,
    pageSize,
    totalCount,
    totalPages,
  };
}

/**
 * Fetches published products by id, for consumers that only need a small,
 * specific subset (favorites, recently-viewed) instead of the whole
 * catalog. Order is NOT guaranteed to match `ids` - callers that care about
 * a specific order (e.g. a shuffled showcase) should re-sort by id
 * themselves, the way readShowcaseProducts() below does.
 */
export async function readProductsByIds(ids: number[]): Promise<Product[]> {
  const uniqueIds = [...new Set(ids)].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (uniqueIds.length === 0) return [];

  await ensureSeedData();
  const db = getD1();
  const placeholders = uniqueIds.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT products.*,
              COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
              COUNT(product_reviews.id) AS review_count
       FROM products
       LEFT JOIN product_reviews ON product_reviews.product_id = products.id
       WHERE products.id IN (${placeholders}) AND products.status = 'published'
       GROUP BY products.id
       ORDER BY products.sort_order, products.id`,
    )
    .bind(...uniqueIds)
    .all<ProductRow>();
  return rows.results.map(mapProduct);
}

export type ShowcaseCounts = {
  featuredCount?: number;
  newestCount?: number;
  discountCount?: number;
  lowStockCount?: number;
};

export type ShowcaseProducts = {
  featured: Product[];
  newest: Product[];
  discount: Product[];
  lowStock: Product[];
};

/**
 * Backs the homepage's "Öne Çıkanlar" / "Yeni Gelenler" / "İndirimde" rows
 * and the profile page's low-stock alert rail, without fetching the full
 * catalog to compute them in the browser.
 *
 * "newest" and "discount" reproduce today's client-side behavior exactly:
 * pickRotatingShowcase() does a seeded shuffle (same seed/salt as
 * home-client.tsx uses) over the *entire* eligible pool, re-picking every 6
 * hours. Shuffling full Product rows in memory would defeat the point of
 * this function, so instead we shuffle just the id list (cheap to fetch)
 * and then look up full rows only for the ids that were actually picked -
 * same selection, far less data moved. The id pool is fetched in the same
 * sort_order/id ordering readProducts() used to return it in, so the
 * shuffle lands on the identical picks for a given seed.
 */
export async function readShowcaseProducts(
  counts: ShowcaseCounts = {},
): Promise<ShowcaseProducts> {
  await ensureSeedData();
  const db = getD1();

  const featuredCount = counts.featuredCount ?? 8;
  const newestCount = counts.newestCount ?? 8;
  const discountCount = counts.discountCount ?? 8;
  const lowStockCount = counts.lowStockCount ?? 4;

  const [featuredRows, newestPoolIds, discountPoolIds, lowStockRows] =
    await Promise.all([
      db
        .prepare(
          `SELECT products.*,
                  COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
                  COUNT(product_reviews.id) AS review_count
           FROM products
           LEFT JOIN product_reviews ON product_reviews.product_id = products.id
           WHERE products.status = 'published' AND products.featured = 1
           GROUP BY products.id
           ORDER BY products.sort_order, products.id
           LIMIT ?`,
        )
        .bind(featuredCount)
        .all<ProductRow>(),
      db
        .prepare(
          `SELECT id FROM products
           WHERE status = 'published' AND stock > 0
           ORDER BY sort_order, id`,
        )
        .all<{ id: number }>(),
      db
        .prepare(
          `SELECT id FROM products
           WHERE status = 'published' AND stock > 0 AND discount_percent > 0
           ORDER BY sort_order, id`,
        )
        .all<{ id: number }>(),
      db
        .prepare(
          `SELECT products.*,
                  COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
                  COUNT(product_reviews.id) AS review_count
           FROM products
           LEFT JOIN product_reviews ON product_reviews.product_id = products.id
           WHERE products.status = 'published' AND products.stock > 0 AND products.stock <= 3
           GROUP BY products.id
           ORDER BY products.sort_order, products.id
           LIMIT ?`,
        )
        .bind(lowStockCount)
        .all<ProductRow>(),
    ]);

  // Same seed/salt as home-client.tsx's newestProducts/discountShowcase.
  const newestIds = pickRotatingShowcase(
    newestPoolIds.results.map((row) => row.id),
    newestCount,
    1,
  );
  const discountIds = pickRotatingShowcase(
    discountPoolIds.results.map((row) => row.id),
    discountCount,
    2,
  );

  const [newestFetched, discountFetched] = await Promise.all([
    readProductsByIds(newestIds),
    readProductsByIds(discountIds),
  ]);

  // readProductsByIds() orders by sort_order/id, not shuffle order - put
  // the picked items back in the order pickRotatingShowcase() chose them.
  const inShuffleOrder = (ids: number[], products: Product[]) => {
    const byId = new Map(products.map((product) => [product.id, product]));
    return ids
      .map((id) => byId.get(id))
      .filter((product): product is Product => Boolean(product));
  };

  return {
    featured: featuredRows.results.map(mapProduct),
    newest: inShuffleOrder(newestIds, newestFetched),
    discount: inShuffleOrder(discountIds, discountFetched),
    lowStock: lowStockRows.results.map(mapProduct),
  };
}

/**
 * Backs the header search box in home-client.tsx. Reproduces its exact
 * weighted-scoring behavior (name match > stone > category > description,
 * with a small featured bump), but candidates are pre-filtered in D1 via
 * LIKE instead of scoring the entire catalog in the browser - only the
 * matched rows (usually a small fraction of the catalog) are fetched, and
 * only the top `limit` of those are returned.
 */
export async function searchProducts(
  query: string,
  limit = 8,
): Promise<Product[]> {
  await ensureSeedData();
  const db = getD1();
  const trimmed = query.trim();

  if (!trimmed) {
    const rows = await db
      .prepare(
        `SELECT products.*,
                COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
                COUNT(product_reviews.id) AS review_count
         FROM products
         LEFT JOIN product_reviews ON product_reviews.product_id = products.id
         WHERE products.status = 'published' AND products.stock > 0
         GROUP BY products.id
         ORDER BY products.sort_order, products.id
         LIMIT 5`,
      )
      .all<ProductRow>();
    return rows.results.map(mapProduct);
  }

  const needle = `%${trimmed.toLocaleLowerCase("tr-TR")}%`;
  // `featured = 1` has to be part of the candidate WHERE, not just the score
  // below: featured products get a flat +2 in the scoring formula, which
  // alone clears the score > 0 cutoff even with zero text match - so any
  // featured product is a valid "match" for every query.
  const rows = await db
    .prepare(
      `SELECT products.*,
              COALESCE(ROUND(AVG(product_reviews.rating), 1), 0) AS review_average,
              COUNT(product_reviews.id) AS review_count
       FROM products
       LEFT JOIN product_reviews ON product_reviews.product_id = products.id
       WHERE products.status = 'published' AND (
         ${trLowerSql("products.name")} LIKE ? OR
         ${trLowerSql("products.stone")} LIKE ? OR
         ${trLowerSql("products.category")} LIKE ? OR
         ${trLowerSql("products.description")} LIKE ? OR
         products.featured = 1
       )
       GROUP BY products.id`,
    )
    .bind(needle, needle, needle, needle)
    .all<ProductRow>();

  const q = trimmed.toLocaleLowerCase("tr-TR");
  return rows.results
    .map(mapProduct)
    .map((product) => {
      const name = product.name.toLocaleLowerCase("tr-TR");
      const stone = product.stone.toLocaleLowerCase("tr-TR");
      const categoryName = product.category.toLocaleLowerCase("tr-TR");
      const description = product.description.toLocaleLowerCase("tr-TR");
      const score =
        (name.startsWith(q) ? 40 : 0) +
        (name.includes(q) ? 24 : 0) +
        (stone.includes(q) ? 18 : 0) +
        (categoryName.includes(q) ? 14 : 0) +
        (description.includes(q) ? 4 : 0) +
        (product.featured ? 2 : 0);
      return { product, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        getDiscountedPrice(first.product) - getDiscountedPrice(second.product),
    )
    .map((entry) => entry.product)
    .slice(0, limit);
}
