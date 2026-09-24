// Kasıtlı olarak hiçbir şey import etmiyor (testler doğrudan import edebilsin).

export type ParsedImportItem = {
  merchantSku: string;
  outcome: "success" | "failed" | "pending" | "accessDenied";
  reason: string;
  productStatus: string | null;
};

// GET /product/api/products/status/{trackingId} yanıtı (gerçek yanıttan):
// { data: [{ merchantSku, importStatus: "FAILED"|..., productStatus,
//   importMessages: [{severity, message}], validationResults, rejectReasonsMessages }] }
// importStatus'un başarı değerleri henüz canlıda görülmedi (yetki reddi
// yüzünden hep FAILED geldi) - bu yüzden başarı, "FAILED değil ve ERROR mesajı
// yok ve (productStatus dolu ya da importStatus tamamlanmış görünüyor)" diye
// temkinli tanımlanıyor; belirsiz durumlar "pending" kalır.
export function parseImportStatus(raw: unknown): ParsedImportItem[] {
  const data = ((raw ?? {}) as { data?: unknown }).data;
  const list = Array.isArray(data) ? data : [];
  return (list as Record<string, unknown>[]).map((entry) => {
    const messages = Array.isArray(entry.importMessages)
      ? (entry.importMessages as { severity?: string; message?: string }[])
      : [];
    const errorMessages = messages
      .filter((message) => message.severity === "ERROR")
      .map((message) => String(message.message ?? ""));
    const validation = Array.isArray(entry.validationResults)
      ? (entry.validationResults as unknown[]).map((value) =>
          typeof value === "string" ? value : JSON.stringify(value),
        )
      : [];
    const rejects = Array.isArray(entry.rejectReasonsMessages)
      ? (entry.rejectReasonsMessages as unknown[]).map(String)
      : [];
    const reason = [...errorMessages, ...validation, ...rejects].filter(Boolean).join(" | ");
    const importStatus = String(entry.importStatus ?? "").toUpperCase();
    const productStatus = entry.productStatus == null ? null : String(entry.productStatus);

    let outcome: ParsedImportItem["outcome"];
    if (errorMessages.some((message) => /access denied/i.test(message))) outcome = "accessDenied";
    else if (importStatus === "FAILED" || errorMessages.length > 0 || rejects.length > 0)
      outcome = "failed";
    else if (
      productStatus !== null ||
      ["SUCCESS", "DONE", "COMPLETED", "FINISHED"].includes(importStatus)
    )
      outcome = "success";
    else outcome = "pending";
    return { merchantSku: String(entry.merchantSku ?? ""), outcome, reason, productStatus };
  });
}
