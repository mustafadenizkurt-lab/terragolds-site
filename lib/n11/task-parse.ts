// Kasıtlı olarak hiçbir şey import etmiyor (test edilebilir saf fonksiyon).

export type ParsedTaskSku = {
  stockCode: string;
  ok: boolean;
  // N11'in "bu stok kodu zaten kullanılıyor" cevabı: ürün N11'de zaten
  // var demek - başarısız sayılmaz, doğrulanmış kabul edilir.
  alreadyExists: boolean;
  reason: string;
};

export type ParsedTask = {
  done: boolean;
  skus: ParsedTaskSku[];
};

// POST /ms/product/task-details/page-query yanıtı (gerçek yanıttan doğrulandı):
// { taskId, status: "IN_QUEUE" | "PROCESSED" | ..., skus: [{ itemCode,
//   status: "SUCCESS" | "FAIL", reasons: string[] }] }
export function parseTaskDetails(raw: unknown): ParsedTask {
  const task = (raw ?? {}) as {
    status?: string;
    skus?: unknown;
  };
  const list = Array.isArray(task.skus)
    ? task.skus
    : ((task.skus as { content?: unknown[] } | undefined)?.content ?? []);
  const skus = (list as { itemCode?: string; status?: string; reasons?: unknown }[]).map(
    (entry) => {
      const reasons = Array.isArray(entry.reasons)
        ? entry.reasons.map(String).join(" | ")
        : String(entry.reasons ?? "");
      return {
        stockCode: String(entry.itemCode ?? ""),
        ok: entry.status === "SUCCESS",
        alreadyExists: reasons.includes("kullanılmaktadır"),
        reason: reasons,
      };
    },
  );
  return { done: task.status === "PROCESSED", skus };
}
