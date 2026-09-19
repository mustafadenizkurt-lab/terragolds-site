import { updateStockAndPrice } from "./client";
import { categoryIdFor } from "./sync";
import { commissionRateFor, computeRequiredPrice, LIST_PRICE_MARKUP_RATE } from "./pricing-formula";

// --- Dinamik fiyatlama: maliyet + kargo + komisyon sonrası en az maliyetin
// %50'si net kâr kalacak şekilde Trendyol satış fiyatını hesaplar ---
// (formülün kendisi pricing-formula.ts'te - saf/testable tutmak için)
//
// products.price (site fiyatı) DEĞİŞMİYOR - bu tamamen ayrı, sadece
// Trendyol'a giden bir "override" fiyat. Site fiyatı ile Trendyol fiyatı
// kasıtlı olarak ayrıştırılıyor çünkü Trendyol'un komisyon+sipariş
// ücretleri site üzerinden yapılan bir satıştaki maliyetlerden farklı.

async function ensureTrendyolPricingColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("trendyol_override_price")) {
    await db.prepare("ALTER TABLE products ADD COLUMN trendyol_override_price INTEGER").run();
  }
}

type DynamicPricingCandidate = {
  id: number;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  trendyolBarcode: string;
  trendyolOverridePrice: number | null;
};

async function loadCandidates(db: D1Database): Promise<DynamicPricingCandidate[]> {
  await ensureTrendyolPricingColumns(db);
  const result = await db
    .prepare(
      `SELECT id, name, category, cost, price, stock,
              trendyol_barcode AS trendyolBarcode,
              trendyol_override_price AS trendyolOverridePrice
       FROM products
       WHERE status = 'published' AND trendyol_barcode IS NOT NULL AND cost > 0
       ORDER BY id`,
    )
    .all<DynamicPricingCandidate>();
  return result.results;
}

async function countMissingCost(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM products
       WHERE status = 'published' AND trendyol_barcode IS NOT NULL AND cost = 0`,
    )
    .first<{ c: number }>();
  return row?.c ?? 0;
}

type PricedCandidate = {
  product: DynamicPricingCandidate;
  currentPrice: number;
  requiredPrice: number;
  needsUpdate: boolean;
};

function priceCandidate(product: DynamicPricingCandidate): PricedCandidate {
  const categoryId = categoryIdFor(product);
  const requiredPrice = Math.round(computeRequiredPrice(product.cost, categoryId));
  // İlk çalıştırmada trendyol_override_price henüz yok - products.price
  // referans alınır. Sonraki çalıştırmalarda kendi önceki override'ımızla
  // kıyaslanır ki fiyat sürekli aynı seviyeye "geri" gönderilmesin.
  const currentPrice = product.trendyolOverridePrice ?? product.price;
  return {
    product,
    currentPrice,
    requiredPrice,
    needsUpdate: requiredPrice > currentPrice,
  };
}

export type DynamicPricingPreview = {
  candidateCount: number;
  needsUpdateCount: number;
  missingCostCount: number;
  sample: {
    id: number;
    name: string;
    categoryId: number;
    commissionRate: number;
    cost: number;
    currentPrice: number;
    requiredPrice: number;
  }[];
};

// Hiçbir şeyi değiştirmeden - kaç ürünün fiyatının yükseltileceğini ve örnek
// hesaplamaları göstermek için.
export async function previewTrendyolDynamicPricing(db: D1Database): Promise<DynamicPricingPreview> {
  const candidates = await loadCandidates(db);
  const priced = candidates.map(priceCandidate);
  const needsUpdate = priced.filter((entry) => entry.needsUpdate);

  return {
    candidateCount: candidates.length,
    needsUpdateCount: needsUpdate.length,
    missingCostCount: await countMissingCost(db),
    sample: needsUpdate.slice(0, 20).map(({ product, currentPrice, requiredPrice }) => {
      const categoryId = categoryIdFor(product);
      return {
        id: product.id,
        name: product.name,
        categoryId,
        commissionRate: commissionRateFor(categoryId),
        cost: product.cost,
        currentPrice,
        requiredPrice,
      };
    }),
  };
}

export type DynamicPricingBatchLog = {
  batchRequestId: string;
  itemCount: number;
};

export type DynamicPricingResult = {
  totalCandidates: number;
  updated: number;
  missingCostCount: number;
  batches: DynamicPricingBatchLog[];
  stoppedEarly: boolean;
  error: string | null;
};

const PRICE_UPDATE_BATCH_SIZE = 1000; // Trendyol updatePriceAndInventory limiti

// Gerçek uygulama: sadece requiredPrice > mevcut override olan ürünleri
// Trendyol'a gönderir, trendyol_override_price'ı günceller. Cron ile tekrar
// tekrar çağrılabilir - maliyet/kategori değişmediği sürece bir ürün ikinci
// kez gönderilmez (aynı isteği 15 dk içinde tekrarlama kısıtına da bu
// sayede doğal olarak uyuluyor).
export async function applyTrendyolDynamicPricing(db: D1Database): Promise<DynamicPricingResult> {
  const candidates = await loadCandidates(db);
  const priced = candidates.map(priceCandidate).filter((entry) => entry.needsUpdate);
  const missingCostCount = await countMissingCost(db);

  const batches: DynamicPricingBatchLog[] = [];
  let updated = 0;

  for (let offset = 0; offset < priced.length; offset += PRICE_UPDATE_BATCH_SIZE) {
    const chunk = priced.slice(offset, offset + PRICE_UPDATE_BATCH_SIZE);

    let batchRequestId: string;
    try {
      const result = await updateStockAndPrice(
        chunk.map(({ product, requiredPrice }) => ({
          barcode: product.trendyolBarcode,
          quantity: product.stock,
          salePrice: requiredPrice,
          listPrice: Math.round(requiredPrice * (1 + LIST_PRICE_MARKUP_RATE)),
        })),
      );
      batchRequestId = result.batchRequestId;
    } catch (error) {
      return {
        totalCandidates: candidates.length,
        updated,
        missingCostCount,
        batches,
        stoppedEarly: true,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      };
    }

    // db.batch() ile tek round-trip - bkz. lib/trendyol/sync.ts
    // applyTrendyolPriceIncrease'teki aynı gerekçe (sıralı tekil sorgular
    // 1000 ürünlük bir partide isteği zaman aşımına uğratıyordu).
    const updateStmt = db.prepare(
      `UPDATE products SET trendyol_override_price = ? WHERE id = ?`,
    );
    await db.batch(
      chunk.map(({ product, requiredPrice }) => updateStmt.bind(requiredPrice, product.id)),
    );

    batches.push({ batchRequestId, itemCount: chunk.length });
    updated += chunk.length;
  }

  return {
    totalCandidates: candidates.length,
    updated,
    missingCostCount,
    batches,
    stoppedEarly: false,
    error: null,
  };
}
