import { ensureN11Columns, getTaskDetails } from "./client";
import { parseTaskDetails } from "./task-parse";

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
