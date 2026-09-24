import { ensureN11Columns, getMyProductsRaw, getTaskDetails } from "./client";
import { parseProductQueryPage, parseTaskDetails } from "./task-parse";

export type N11ReconcileResult = {
  checkedTasks: number;
  stillProcessing: number;
  verified: number;
  failed: number;
  failures: { stockCode: string; reason: string }[];
  errors: string[];
};

// N11 ürün gönderimi asenkron: syncProductsToN11 taskId alınca ürünü
// "gönderildi" işaretliyor ama N11 sonra reddedebiliyor (gerçek örnek: 50
// üründen 6'sı "ürün grubuyla uyumlu değil"). Bu fonksiyon henüz
// doğrulanmamış görevleri sorgular; SUCCESS olanları doğrulanmış işaretler,
// FAIL olanların task/stok kodunu boşaltıp nedenini n11_last_error'a yazar
// (sync bunları otomatik yeniden göndermez - tekrar denemek için
// n11_last_error'ı elle temizlemek gerekir).
export async function reconcileN11Tasks(
  db: D1Database,
  maxTasks = 20,
): Promise<N11ReconcileResult> {
  await ensureN11Columns(db);

  const tasks = await db
    .prepare(
      `SELECT DISTINCT n11_task_id AS taskId FROM products
       WHERE n11_task_id IS NOT NULL AND n11_task_id NOT LIKE 'skip-%'
         AND n11_verified_at IS NULL
       ORDER BY n11_task_id LIMIT ?`,
    )
    .bind(maxTasks)
    .all<{ taskId: string }>();

  const result: N11ReconcileResult = {
    checkedTasks: 0,
    stillProcessing: 0,
    verified: 0,
    failed: 0,
    failures: [],
    errors: [],
  };

  for (const { taskId } of tasks.results) {
    // Eski kayıtlar "3344070382.0" biçiminde saklanmış olabilir.
    const cleanId = taskId.replace(/\.0$/, "");
    try {
      const parsed = parseTaskDetails(await getTaskDetails(cleanId, 0, 100));
      result.checkedTasks += 1;
      if (!parsed.done) {
        result.stillProcessing += 1;
        continue;
      }
      // Görev başına tek db.batch: yüzlerce sıralı UPDATE, Worker isteğini
      // zaman aşımına uğratıyordu.
      const okStmt = db.prepare(
        `UPDATE products SET n11_verified_at = CURRENT_TIMESTAMP, n11_last_error = NULL
         WHERE n11_stock_code = ? AND n11_task_id = ?`,
      );
      const failStmt = db.prepare(
        `UPDATE products SET n11_task_id = NULL, n11_stock_code = NULL,
           n11_synced_at = NULL, n11_price_synced = NULL, n11_last_error = ?
         WHERE n11_stock_code = ? AND n11_task_id = ?`,
      );
      const statements: D1PreparedStatement[] = [];
      for (const sku of parsed.skus) {
        if (sku.ok || sku.alreadyExists) {
          statements.push(okStmt.bind(sku.stockCode, taskId));
          result.verified += 1;
        } else {
          statements.push(failStmt.bind(sku.reason.slice(0, 500), sku.stockCode, taskId));
          result.failed += 1;
          result.failures.push({ stockCode: sku.stockCode, reason: sku.reason });
        }
      }
      // Görevde hiç sonucu listelenmeyen ürünler (nadir) sonsuza kadar
      // "doğrulanmamış" kalmasın diye görev PROCESSED ise kalanları da işaretle.
      statements.push(
        db
          .prepare(
            `UPDATE products SET n11_verified_at = CURRENT_TIMESTAMP
             WHERE n11_task_id = ? AND n11_verified_at IS NULL`,
          )
          .bind(taskId),
      );
      await db.batch(statements);
    } catch (error) {
      result.errors.push(
        `Görev ${cleanId}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  return result;
}

export const CATALOG_REJECTED_MESSAGE =
  "N11 katalog incelemesinde reddedildi (CatalogRejected) - gerçek neden N11 satıcı panelindeki 'Katalogdan Reddedilen' > Hata Etiketi'nde.";

export type N11CatalogStatusResult = {
  scanned: number;
  newlyRejected: number;
  recovered: number;
  byStatus: Record<string, number>;
  errors: string[];
};

// task-details SUCCESS dönen ürünler N11'de sonradan katalog incelemesinde
// reddedilebiliyor (panelde "Katalogdan Reddedilen", ~1250 ürün) - bunu sadece
// GET /ms/product-query'nin status alanı gösteriyor. Bu adım tüm ürünlerin
// güncel durumunu okuyup D1'deki "doğrulandı" durumunu gerçekle eşitler.
export async function reconcileN11CatalogStatus(
  db: D1Database,
  maxPages = 80,
): Promise<N11CatalogStatusResult> {
  await ensureN11Columns(db);
  const result: N11CatalogStatusResult = {
    scanned: 0,
    newlyRejected: 0,
    recovered: 0,
    byStatus: {},
    errors: [],
  };

  const statusByCode = new Map<string, string>();
  try {
    for (let page = 0; page < maxPages; page += 1) {
      const parsed = parseProductQueryPage(await getMyProductsRaw({ page, size: 100 }));
      for (const item of parsed.items) {
        statusByCode.set(item.stockCode, item.status);
        result.byStatus[item.status] = (result.byStatus[item.status] ?? 0) + 1;
      }
      result.scanned += parsed.items.length;
      if (parsed.last) break;
    }
  } catch (error) {
    // Kısmi tarama durumları yanlış "kurtarıldı" saymasın diye hiçbir şey yazma.
    result.errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
    return result;
  }

  const rows = await db
    .prepare(
      `SELECT n11_stock_code AS code, n11_last_error AS err FROM products
       WHERE n11_stock_code IS NOT NULL`,
    )
    .all<{ code: string; err: string | null }>();

  const reject = db.prepare(
    `UPDATE products SET n11_last_error = ?, n11_verified_at = NULL WHERE n11_stock_code = ?`,
  );
  const recover = db.prepare(
    `UPDATE products SET n11_last_error = NULL, n11_verified_at = CURRENT_TIMESTAMP
     WHERE n11_stock_code = ?`,
  );
  const statements: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const status = statusByCode.get(row.code);
    if (status === undefined) continue;
    if (status === "CatalogRejected" && !row.err) {
      statements.push(reject.bind(CATALOG_REJECTED_MESSAGE, row.code));
      result.newlyRejected += 1;
    } else if (status !== "CatalogRejected" && row.err === CATALOG_REJECTED_MESSAGE) {
      statements.push(recover.bind(row.code));
      result.recovered += 1;
    }
  }
  for (let i = 0; i < statements.length; i += 90) {
    await db.batch(statements.slice(i, i + 90));
  }
  return result;
}
