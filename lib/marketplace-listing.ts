import { syncProductsToTrendyol } from "./trendyol/sync";
import { syncProductsToHepsiburada } from "./hepsiburada/sync";
import { syncProductsToN11 } from "./n11/sync";

// Admin panelinden yayına alınan (status = 'published') ama henüz bir
// pazaryerinde hiç listelenmemiş ürünler önceden SADECE admin elle
// Trendyol/Hepsiburada/N11 senkron ekranlarındaki gönderim adımını
// çalıştırınca listeleniyordu - yeni yayına alınan ürünler fark edilmeden
// sadece sitede kalabiliyordu. 6 saatlik cron artık aynı (admin'in elle
// kullandığı) sync fonksiyonlarını çağırıyor. Her biri kendi "listelenmemiş"
// kuyruğunu tutuyor (trendyol_listing_id / hepsiburada_listing_id /
// n11_task_id), kategori eşlemesi olmayanları *_last_error ile ayıklıyor;
// sonuçlar her pazaryerinin kendi reconcile adımlarıyla doğrulanıyor.
const BATCH_SIZE = 50;
const MAX_BATCHES_PER_MARKETPLACE = 4;

export type MarketplaceListingResult = Record<
  "trendyol" | "hepsiburada" | "n11",
  { created: number; failed: number; remaining: number; errors: string[] }
>;

async function drain(
  run: () => Promise<{ created: number; failed: number; remaining: number; errors: string[] }>,
) {
  const total = { created: 0, failed: 0, remaining: 0, errors: [] as string[] };
  for (let round = 0; round < MAX_BATCHES_PER_MARKETPLACE; round++) {
    try {
      const result = await run();
      total.created += result.created;
      total.failed += result.failed;
      total.remaining = result.remaining;
      total.errors.push(...result.errors);
      // Hata veren ya da hiçbir şey göndermeyen turda dur - aynı partiyi
      // aynı çalıştırmada tekrar tekrar denemenin anlamı yok.
      if (result.errors.length > 0 || result.created === 0 || result.remaining === 0) break;
    } catch (error) {
      total.errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
      break;
    }
  }
  return total;
}

export async function listNewProductsOnMarketplaces(
  db: D1Database,
): Promise<MarketplaceListingResult> {
  return {
    trendyol: await drain(() => syncProductsToTrendyol(db, BATCH_SIZE)),
    hepsiburada: await drain(() => syncProductsToHepsiburada(db, BATCH_SIZE)),
    n11: await drain(() => syncProductsToN11(db, BATCH_SIZE)),
  };
}
