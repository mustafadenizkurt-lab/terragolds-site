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
// Belirsiz durumlar "pending" kalır (yanlışlıkla başarı saymamak için).
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

    // Resmi durum değerleri (developers.hepsiburada.com): importStatus =
    // PROCESSING | SUCCESS | FAILED; productStatus = WAITING (incelenecek) |
    // MISSING_INFO | MATCHED (satışa hazır) | PRE_MATCHED (eşleşen) | REJECTED |
    // MATCHED_WITH_STAGED | CREATED.
    const blockedProductStatus = ["MISSING_INFO", "REJECTED"].includes(String(productStatus));
    let outcome: ParsedImportItem["outcome"];
    if (errorMessages.some((message) => /access denied/i.test(message))) outcome = "accessDenied";
    else if (
      importStatus === "FAILED" ||
      errorMessages.length > 0 ||
      rejects.length > 0 ||
      blockedProductStatus
    )
      outcome = "failed";
    else if (importStatus === "PROCESSING") outcome = "pending";
    else if (importStatus === "SUCCESS" || productStatus !== null) outcome = "success";
    else outcome = "pending";
    return { merchantSku: String(entry.merchantSku ?? ""), outcome, reason, productStatus };
  });
}
