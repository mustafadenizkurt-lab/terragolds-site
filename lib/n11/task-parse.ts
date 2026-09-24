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

export type ParsedProductPage = {
  last: boolean;
  items: { stockCode: string; status: string; saleStatus: string }[];
};

// GET /ms/product-query yanıtı (gerçek yanıttan doğrulandı): Spring sayfa
// zarfı { content: [{ stockCode, status, saleStatus, ... }], last, ... }.
// status: "Active" | "InApproval" | "CatalogRejected" | ... - ürün ilk
// task-details kontrolünden SONRA bile katalog incelemesinde
// reddedilebiliyor (task SUCCESS derken), bunu sadece bu alan gösteriyor.
export function parseProductQueryPage(raw: unknown): ParsedProductPage {
  const page = (raw ?? {}) as { content?: unknown; last?: boolean };
  const content = Array.isArray(page.content) ? page.content : [];
  const items = (content as { stockCode?: string; status?: string; saleStatus?: string }[]).map(
    (entry) => ({
      stockCode: String(entry.stockCode ?? ""),
      status: String(entry.status ?? ""),
      saleStatus: String(entry.saleStatus ?? ""),
    }),
  );
  return { last: page.last === true || items.length === 0, items };
}
