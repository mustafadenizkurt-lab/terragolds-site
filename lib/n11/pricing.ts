import { computeRequiredPrice } from "./pricing-formula";
export { n11ListPriceFor } from "./pricing-formula";

// --- Dinamik fiyatlama: maliyet + kargo + komisyon(+KDV+hizmet bedeli+
// stopaj) sonrası en az maliyetin %50'si net kâr kalacak şekilde N11 satış
// fiyatını hesaplar (formülün kendisi pricing-formula.ts'te) ---
//
// products.price (site fiyatı) DEĞİŞMİYOR - bu tamamen ayrı, sadece N11'e
// giden bir "override" fiyat (Trendyol'daki trendyol_override_price ile
// birebir aynı desen - bkz. lib/trendyol/pricing.ts).

async function ensureN11PricingColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("n11_override_price")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_override_price INTEGER").run();
  }
}

type DynamicPricingCandidate = {
  id: number;
  name: string;
  cost: number;
  price: number;
  n11OverridePrice: number | null;
};

async function loadCandidates(db: D1Database): Promise<DynamicPricingCandidate[]> {
  await ensureN11PricingColumns(db);
  const result = await db
    .prepare(
      `SELECT id, name, cost, price,
              n11_override_price AS n11OverridePrice
       FROM products
       WHERE status = 'published' AND n11_stock_code IS NOT NULL AND cost > 0
       ORDER BY id`,
    )
    .all<DynamicPricingCandidate>();
  return result.results;
}

async function countMissingCost(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM products
       WHERE status = 'published' AND n11_stock_code IS NOT NULL AND cost = 0`,
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
  const requiredPrice = Math.round(computeRequiredPrice(product.cost));
  // İlk çalıştırmada n11_override_price henüz yok - products.price referans
  // alınır. Sonraki çalıştırmalarda kendi önceki override'ımızla kıyaslanır
  // ki fiyat sürekli aynı seviyeye "geri" gönderilmesin.
  const currentPrice = product.n11OverridePrice ?? product.price;
  return {
    product,
    currentPrice,
    requiredPrice,
    needsUpdate: requiredPrice > currentPrice,
  };
}

export type N11DynamicPricingPreview = {
  candidateCount: number;
  needsUpdateCount: number;
  missingCostCount: number;
  sample: {
    id: number;
    name: string;
    cost: number;
    currentPrice: number;
    requiredPrice: number;
  }[];
};

// Hiçbir şeyi değiştirmeden - kaç ürünün fiyatının yükseltileceğini ve örnek
// hesaplamaları göstermek için.
export async function previewN11DynamicPricing(db: D1Database): Promise<N11DynamicPricingPreview> {
  const candidates = await loadCandidates(db);
  const priced = candidates.map(priceCandidate);
  const needsUpdate = priced.filter((entry) => entry.needsUpdate);

  return {
    candidateCount: candidates.length,
    needsUpdateCount: needsUpdate.length,
    missingCostCount: await countMissingCost(db),
    sample: needsUpdate.slice(0, 20).map(({ product, currentPrice, requiredPrice }) => ({
      id: product.id,
      name: product.name,
      cost: product.cost,
      currentPrice,
      requiredPrice,
    })),
  };
}

export type N11DynamicPricingResult = {
  totalCandidates: number;
  updated: number;
  missingCostCount: number;
};

// Gerçek uygulama: sadece requiredPrice > mevcut override olan ürünlerin
// n11_override_price'ını D1'de günceller. Ürünün gerçek N11'e gönderimi
// (pushStockAndPriceToN11/pushPendingN11Prices) bu override'ı otomatik
// kullanır (bkz. lib/n11/sync.ts) - burada N11'e ayrı bir istek atılmıyor,
// sadece D1 güncelleniyor, mevcut fiyat senkron akışı gerisini hallediyor.
export async function applyN11DynamicPricing(db: D1Database): Promise<N11DynamicPricingResult> {
  const candidates = await loadCandidates(db);
  const priced = candidates.map(priceCandidate).filter((entry) => entry.needsUpdate);
  const missingCostCount = await countMissingCost(db);

  if (priced.length > 0) {
    const updateStmt = db.prepare(`UPDATE products SET n11_override_price = ? WHERE id = ?`);
    await db.batch(priced.map(({ product, requiredPrice }) => updateStmt.bind(requiredPrice, product.id)));
  }

  return {
    totalCandidates: candidates.length,
    updated: priced.length,
    missingCostCount,
  };
}
