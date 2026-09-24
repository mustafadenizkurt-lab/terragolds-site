import { computeRequiredPrice } from "./pricing-formula";

// --- Dinamik fiyatlama: maliyet + kargo + komisyon sonrası en az maliyetin
// %50'si net kâr kalacak şekilde Hepsiburada satış fiyatını hesaplar
// (formülün kendisi pricing-formula.ts'te - Trendyol/N11'deki pricing.ts
// ile birebir aynı desen) ---
//
// products.price (site fiyatı) DEĞİŞMİYOR - bu tamamen ayrı, sadece
// Hepsiburada'ya giden bir "override" fiyat.

async function ensureHepsiburadaPricingColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("hepsiburada_override_price")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hepsiburada_override_price INTEGER").run();
  }
}

type DynamicPricingCandidate = {
  id: number;
  name: string;
  cost: number;
  price: number;
  hepsiburadaOverridePrice: number | null;
};

async function loadCandidates(db: D1Database): Promise<DynamicPricingCandidate[]> {
  await ensureHepsiburadaPricingColumns(db);
  const result = await db
    .prepare(
      `SELECT id, name, cost, price,
              hepsiburada_override_price AS hepsiburadaOverridePrice
       FROM products
       WHERE status = 'published' AND hepsiburada_sku IS NOT NULL AND cost > 0
       ORDER BY id`,
    )
    .all<DynamicPricingCandidate>();
  return result.results;
}

async function countMissingCost(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS c FROM products
       WHERE status = 'published' AND hepsiburada_sku IS NOT NULL AND cost = 0`,
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
  // İlk çalıştırmada hepsiburada_override_price henüz yok - products.price
  // referans alınır. Sonraki çalıştırmalarda kendi önceki override'ımızla
  // kıyaslanır ki fiyat sürekli aynı seviyeye "geri" gönderilmesin.
  const currentPrice = product.hepsiburadaOverridePrice ?? product.price;
  return {
    product,
    currentPrice,
    requiredPrice,
    needsUpdate: requiredPrice > currentPrice,
  };
}

export type HepsiburadaDynamicPricingPreview = {
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
export async function previewHepsiburadaDynamicPricing(
  db: D1Database,
): Promise<HepsiburadaDynamicPricingPreview> {
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

export type HepsiburadaDynamicPricingResult = {
  totalCandidates: number;
  updated: number;
  missingCostCount: number;
};

// Gerçek uygulama: sadece requiredPrice > mevcut override olan ürünlerin
// hepsiburada_override_price'ını D1'de günceller. Ürünün gerçek
// Hepsiburada'ya gönderimi (pushStockAndPriceToHepsiburada/
// pushPendingHepsiburadaPrices) bu override'ı otomatik kullanır (bkz.
// lib/hepsiburada/sync.ts).
export async function applyHepsiburadaDynamicPricing(
  db: D1Database,
): Promise<HepsiburadaDynamicPricingResult> {
  const candidates = await loadCandidates(db);
  const priced = candidates.map(priceCandidate).filter((entry) => entry.needsUpdate);
  const missingCostCount = await countMissingCost(db);

  if (priced.length > 0) {
    const updateStmt = db.prepare(
      `UPDATE products SET hepsiburada_override_price = ? WHERE id = ?`,
    );
    await db.batch(priced.map(({ product, requiredPrice }) => updateStmt.bind(requiredPrice, product.id)));
  }

  return {
    totalCandidates: candidates.length,
    updated: priced.length,
    missingCostCount,
  };
}
