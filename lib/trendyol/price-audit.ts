import { getProducts, getProductByBarcode } from "./client";

// D1'de trendyol_price_synced = trendyol_override_price ise "gönderildi"
// sayılıyor - ama updateStockAndPrice() sadece batchRequestId dönen bir
// ASENKRON kabul, gerçek başarı/başarısızlık ayrı bir çağrıyla
// (getBatchRequestResult) doğrulanmadan hiçbir yerde kontrol edilmiyor.
// Trendyol bir öğeyi arka planda reddedebilir (ör. fiyat kuralı ihlali) ve
// D1 bundan habersiz "synced" görünmeye devam eder. Bu modül D1'in "doğru
// sandığı" fiyatla Trendyol'un GERÇEKTEN listelediği fiyatı doğrudan
// getProducts() (bulk, barkod bazlı değil - binlerce ürünü tek tek sorgulayıp
// rate limit'e çarpmamak için) üzerinden karşılaştırıp farkları raporluyor.
export type PriceAuditMismatch = {
  productId: number;
  barcode: string;
  name: string;
  dbTargetPrice: number;
  liveSalePrice: number;
  liveListPrice: number;
  diff: number;
  // getProducts() (v1, "brownout"ta) salePrice=0 dönerse bunun gerçekten
  // pasif/onaysız bir ürün mü yoksa v1'in kendi güvenilirlik sorunu mu
  // olduğunu ayırt etmek için v2 (getProductByBarcode) durumu ayrıca
  // sorgulanıyor - sadece salePrice=0 olan eşleşmeler için (rate limit'i
  // gereksiz yere zorlamamak adına).
  approved: boolean | null;
  archived: boolean | null;
  statusCheckError: string | null;
};

export type PriceAuditResult = {
  totalOnTrendyol: number;
  totalScanned: number;
  matchedInDb: number;
  mismatchCount: number;
  mismatches: PriceAuditMismatch[];
  pagesScanned: number;
  stoppedEarly: boolean;
  error: string | null;
};

const PAGE_SIZE = 200;
const MAX_PAGES = 30; // ~6000 ürüne kadar güvenli üst sınır (şu an katalog ~4000)
const MISMATCH_TOLERANCE_TL = 1; // yuvarlama farkını gürültü sayma

type DbPriceRow = {
  id: number;
  name: string;
  barcode: string;
  price: number;
  overridePrice: number | null;
};

export async function ensurePriceAuditTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_price_mismatches (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         product_id INTEGER NOT NULL,
         barcode TEXT NOT NULL,
         name TEXT NOT NULL,
         db_target_price INTEGER NOT NULL,
         live_sale_price INTEGER NOT NULL,
         live_list_price INTEGER NOT NULL,
         diff INTEGER NOT NULL,
         scanned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`,
    )
    .run();
  const columns = await db.prepare("PRAGMA table_info(trendyol_price_mismatches)").all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("approved")) {
    await db.prepare("ALTER TABLE trendyol_price_mismatches ADD COLUMN approved INTEGER").run();
  }
  if (!names.has("archived")) {
    await db.prepare("ALTER TABLE trendyol_price_mismatches ADD COLUMN archived INTEGER").run();
  }
}

// Tüm kataloğu Trendyol'un kendi sayfalama sırasıyla tarar (barkod başına
// ayrı istek değil - getProducts() sayfa başına ~200 ürün döndürüyor, bu
// yüzden 4000 ürün ~20 istekte taranıyor, rate limit'e hiç yaklaşmadan).
export async function auditTrendyolPrices(db: D1Database): Promise<PriceAuditResult> {
  await ensurePriceAuditTable(db);

  const dbRows = await db
    .prepare(
      `SELECT id, name, trendyol_barcode AS barcode, price,
              trendyol_override_price AS overridePrice
       FROM products
       WHERE trendyol_barcode IS NOT NULL`,
    )
    .all<DbPriceRow>();
  const byBarcode = new Map(dbRows.results.map((row) => [row.barcode, row]));

  const mismatches: PriceAuditMismatch[] = [];
  let totalScanned = 0;
  let matchedInDb = 0;
  let totalOnTrendyol = 0;
  let pagesScanned = 0;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await getProducts({ page, size: PAGE_SIZE });
      pagesScanned++;
      if (page === 0) totalOnTrendyol = result.totalElements;

      for (const item of result.content) {
        totalScanned++;
        const dbRow = byBarcode.get(item.barcode);
        if (!dbRow) continue;
        matchedInDb++;
        const target = dbRow.overridePrice ?? dbRow.price;
        const diff = item.salePrice - target;
        if (Math.abs(diff) > MISMATCH_TOLERANCE_TL) {
          mismatches.push({
            productId: dbRow.id,
            barcode: item.barcode,
            name: dbRow.name,
            dbTargetPrice: target,
            liveSalePrice: item.salePrice,
            liveListPrice: item.listPrice,
            diff,
            approved: null,
            archived: null,
            statusCheckError: null,
          });
        }
      }

      if (page + 1 >= result.totalPages) break;
    }

    await attachApprovalStatus(mismatches);
  } catch (error) {
    // O ana kadar bulunanları yine de kaydet - kısmi sonuç, hiç sonuç
    // yoktan iyidir.
    await persistMismatches(db, mismatches);
    return {
      totalOnTrendyol,
      totalScanned,
      matchedInDb,
      mismatchCount: mismatches.length,
      mismatches: mismatches.slice(0, 200),
      pagesScanned,
      stoppedEarly: true,
      error: error instanceof Error ? error.message : "bilinmeyen hata",
    };
  }

  await persistMismatches(db, mismatches);

  return {
    totalOnTrendyol,
    totalScanned,
    matchedInDb,
    mismatchCount: mismatches.length,
    mismatches: mismatches.slice(0, 200),
    pagesScanned,
    stoppedEarly: false,
    error: null,
  };
}

// Sadece salePrice=0 dönen (yani "gerçekten satılamıyor mu, yoksa v1 API mi
// güvenilmez" sorusu olan) eşleşmeler için v2 (getProductByBarcode) ile
// gerçek onay/arşiv durumunu sorguluyor - diğerlerinde (fiyat farklı ama
// >0) zaten aktif olduğu belli, ekstra sorguya gerek yok.
async function attachApprovalStatus(mismatches: PriceAuditMismatch[]): Promise<void> {
  const needsCheck = mismatches.filter((mismatch) => mismatch.liveSalePrice === 0);
  for (const mismatch of needsCheck) {
    try {
      const info = await getProductByBarcode(mismatch.barcode);
      mismatch.approved = info.approved;
      mismatch.archived = info.archived;
    } catch (error) {
      mismatch.statusCheckError = error instanceof Error ? error.message : "bilinmeyen hata";
    }
  }
}

async function persistMismatches(db: D1Database, mismatches: PriceAuditMismatch[]): Promise<void> {
  await db.prepare("DELETE FROM trendyol_price_mismatches").run();
  if (!mismatches.length) return;
  const insertStmt = db.prepare(
    `INSERT INTO trendyol_price_mismatches
       (product_id, barcode, name, db_target_price, live_sale_price, live_list_price, diff, approved, archived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const BATCH_SIZE = 100;
  for (let offset = 0; offset < mismatches.length; offset += BATCH_SIZE) {
    const chunk = mismatches.slice(offset, offset + BATCH_SIZE);
    await db.batch(
      chunk.map((mismatch) =>
        insertStmt.bind(
          mismatch.productId,
          mismatch.barcode,
          mismatch.name,
          mismatch.dbTargetPrice,
          mismatch.liveSalePrice,
          mismatch.liveListPrice,
          mismatch.diff,
          mismatch.approved === null ? null : mismatch.approved ? 1 : 0,
          mismatch.archived === null ? null : mismatch.archived ? 1 : 0,
        ),
      ),
    );
  }
}
