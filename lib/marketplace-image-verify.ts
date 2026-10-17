import { getBatchRequestResult } from "./trendyol/client";
import { getImportStatus } from "./hepsiburada/client";
import { parseImportStatus } from "./hepsiburada/import-parse";
import { getTaskDetails } from "./n11/client";
import { parseTaskDetails } from "./n11/task-parse";
import { ensureMarketplaceImageColumns } from "./marketplace-images";

// Görsel gönderimi pazaryerlerinde asenkron işleniyor - gönderim anında
// sadece bir işlem numarası dönüyor (bkz. images_push_refs). Bu modül o
// numaraların GERÇEK sonucunu (başarılı / başarısız + sebep / hâlâ
// işleniyor) her pazaryerinin kendi durum servisinden sorgulayıp ürün
// bazında raporlar. Hiçbir şeyi değiştirmez, salt-okunur.

type Outcome = { status: "success" | "failed" | "processing" | "unknown"; detail: string };

export type ProductImageVerification = {
  id: number;
  code: string | null;
  name: string;
  imagesChangedAt: string;
  trendyol?: Outcome;
  hepsiburada?: Outcome;
  n11?: Outcome;
};

export type ImageVerificationResult = {
  checked: number;
  summary: Record<"trendyol" | "hepsiburada" | "n11", Record<Outcome["status"], number>>;
  problems: ProductImageVerification[];
  products: ProductImageVerification[];
  errors: string[];
};

type Row = {
  id: number;
  name: string;
  code: string | null;
  contentId: number | null;
  barcode: string | null;
  hbSku: string | null;
  n11StockCode: string | null;
  imagesChangedAt: string;
  refs: string | null;
};

function emptySummary(): Record<Outcome["status"], number> {
  return { success: 0, failed: 0, processing: 0, unknown: 0 };
}

export async function verifyMarketplaceImages(
  db: D1Database,
  options: { since: string; limit?: number },
): Promise<ImageVerificationResult> {
  await ensureMarketplaceImageColumns(db);
  const limit = Math.max(1, Math.min(options.limit ?? 200, 300));
  const rows = await db
    .prepare(
      `SELECT id, name, xml_external_id AS code, trendyol_content_id AS contentId,
              trendyol_barcode AS barcode, hepsiburada_sku AS hbSku,
              n11_stock_code AS n11StockCode, images_changed_at AS imagesChangedAt,
              images_push_refs AS refs
       FROM products
       WHERE images_changed_at >= ? AND status != 'deleted'
       ORDER BY images_changed_at DESC LIMIT ?`,
    )
    .bind(options.since, limit)
    .all<Row>();

  const errors: string[] = [];
  const parsedRefs = new Map<number, { trendyol?: string; hepsiburada?: string; n11?: string }>();
  for (const row of rows.results) {
    try {
      parsedRefs.set(row.id, row.refs ? JSON.parse(row.refs) : {});
    } catch {
      parsedRefs.set(row.id, {});
    }
  }
  const unique = (key: "trendyol" | "hepsiburada" | "n11") =>
    [...new Set([...parsedRefs.values()].map((refs) => refs[key]).filter((ref): ref is string => Boolean(ref)))];

  // Trendyol: batch sonucu - öğe başına status + failureReasons. Öğeyi ürüne
  // eşlemek için requestItem içindeki contentId/barkod kullanılıyor.
  const trendyolByRef = new Map<string, { items: { text: string; outcome: Outcome }[]; batchStatus: string }>();
  for (const ref of unique("trendyol")) {
    try {
      const raw = (await getBatchRequestResult(ref)) as unknown as {
        status?: string;
        items?: { status?: string; failureReasons?: unknown; requestItem?: unknown }[];
      };
      const items = (raw.items ?? []).map((item) => {
        const status = String(item.status ?? "").toUpperCase();
        const reasons = Array.isArray(item.failureReasons) ? item.failureReasons.map(String).join(" | ") : "";
        const outcome: Outcome =
          status === "SUCCESS"
            ? { status: "success", detail: "" }
            : status === "FAILED"
              ? { status: "failed", detail: reasons || "Trendyol başarısız dedi" }
              : { status: "processing", detail: status || "işleniyor" };
        return { text: JSON.stringify(item.requestItem ?? item), outcome };
      });
      trendyolByRef.set(ref, { items, batchStatus: String(raw.status ?? "") });
    } catch (error) {
      errors.push(`Trendyol ${ref}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  const hepsiburadaByRef = new Map<string, ReturnType<typeof parseImportStatus>>();
  for (const ref of unique("hepsiburada")) {
    try {
      hepsiburadaByRef.set(ref, parseImportStatus(await getImportStatus(ref)));
    } catch (error) {
      errors.push(`Hepsiburada ${ref}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  const n11ByRef = new Map<string, ReturnType<typeof parseTaskDetails>>();
  for (const ref of unique("n11")) {
    try {
      n11ByRef.set(ref, parseTaskDetails(await getTaskDetails(ref.replace(/\.0$/, ""), 0, 100)));
    } catch (error) {
      errors.push(`N11 ${ref}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`);
    }
  }

  const summary = { trendyol: emptySummary(), hepsiburada: emptySummary(), n11: emptySummary() };
  const products: ProductImageVerification[] = rows.results.map((row) => {
    const refs = parsedRefs.get(row.id) ?? {};
    const result: ProductImageVerification = {
      id: row.id,
      code: row.code,
      name: row.name,
      imagesChangedAt: row.imagesChangedAt,
    };
    if (refs.trendyol) {
      const batch = trendyolByRef.get(refs.trendyol);
      const keys = [row.contentId ? String(row.contentId) : null, row.barcode].filter(Boolean) as string[];
      const match = batch?.items.find((item) => keys.some((key) => item.text.includes(key)));
      result.trendyol = match?.outcome ??
        (batch
          ? { status: batch.batchStatus.toUpperCase() === "COMPLETED" ? "unknown" : "processing", detail: batch.batchStatus || "sonuç listesinde yok" }
          : { status: "unknown", detail: "sorgulanamadı" });
    }
    if (refs.hepsiburada) {
      const items = hepsiburadaByRef.get(refs.hepsiburada);
      const sku = row.hbSku || row.code || `TG-${row.id}`;
      const match = items?.find((item) => item.merchantSku === sku);
      result.hepsiburada = match
        ? {
            status:
              match.outcome === "success" ? "success" : match.outcome === "pending" ? "processing" : "failed",
            detail: [match.productStatus, match.reason].filter(Boolean).join(" - "),
          }
        : { status: items ? "processing" : "unknown", detail: items ? "sonuç listesinde henüz yok" : "sorgulanamadı" };
    }
    if (refs.n11) {
      const task = n11ByRef.get(refs.n11);
      const match = task?.skus.find((sku) => sku.stockCode === row.n11StockCode);
      result.n11 = match
        ? { status: match.ok ? "success" : "failed", detail: match.reason }
        : { status: task ? (task.done ? "unknown" : "processing") : "unknown", detail: task ? (task.done ? "sonuç listesinde yok" : "işleniyor") : "sorgulanamadı" };
    }
    for (const key of ["trendyol", "hepsiburada", "n11"] as const) {
      const outcome = result[key];
      if (outcome) summary[key][outcome.status] += 1;
    }
    return result;
  });

  const problems = products.filter((product) =>
    [product.trendyol, product.hepsiburada, product.n11].some((outcome) => outcome?.status === "failed"),
  );
  return { checked: products.length, summary, problems, products, errors };
}
