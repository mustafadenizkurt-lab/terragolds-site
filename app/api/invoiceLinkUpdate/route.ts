import { getD1 } from "../../../lib/store-db";
import {
  ensureInvoiceColumns,
  fromBirfaturaDate,
  verifyBirfaturaRequest,
} from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümanındaki gerçek örnek istekle
// birebir doğrulandı - POST + JSON body, ama orderCargoUpdate'in aksine
// alan adları Türkçe camelCase: { faturaUrl, orderId, faturaTarihi,
// faturaNo }. orderId, /api/orders yanıtındaki OrderId'dir (orders.rowid).
type InvoiceLinkUpdateBody = {
  faturaUrl?: string;
  orderId?: number;
  faturaTarihi?: string;
  faturaNo?: string;
};

export async function POST(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json(
      { Success: false, Message: "Yetkisiz istek." },
      { status: 401 },
    );
  }

  let body: InvoiceLinkUpdateBody = {};
  try {
    body = (await request.json()) as InvoiceLinkUpdateBody;
  } catch {
    return Response.json(
      { Success: false, Message: "Geçersiz JSON." },
      { status: 400 },
    );
  }

  if (typeof body.orderId !== "number") {
    return Response.json(
      { Success: false, Message: "orderId zorunludur." },
      { status: 400 },
    );
  }

  const invoiceDate = body.faturaTarihi
    ? fromBirfaturaDate(body.faturaTarihi)
    : null;

  const db = getD1();
  await ensureInvoiceColumns(db);
  const result = await db
    .prepare(
      `UPDATE orders SET
         invoice_url = COALESCE(?, invoice_url),
         invoice_no = COALESCE(?, invoice_no),
         invoice_date = COALESCE(?, invoice_date),
         updated_at = CURRENT_TIMESTAMP
       WHERE rowid = ?`,
    )
    .bind(body.faturaUrl ?? null, body.faturaNo ?? null, invoiceDate, body.orderId)
    .run();

  if (result.meta.changes === 0) {
    return Response.json(
      { Success: false, Message: "Sipariş bulunamadı." },
      { status: 404 },
    );
  }

  return Response.json({
    Success: true,
    Message: "Fatura bağlantısı güncellendi.",
  });
}
