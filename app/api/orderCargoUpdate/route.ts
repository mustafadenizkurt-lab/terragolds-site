import { getD1 } from "../../../lib/store-db";
import {
  fromBirfaturaDate,
  statusForOrderStatusId,
  verifyBirfaturaRequest,
} from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümanındaki gerçek örnek istekle
// birebir doğrulandı - camelCase, POST + JSON body:
// { orderId, orderStatusId, cargoTrackingCode, updateDateTime,
//   cargoTrackingCodeUrl, cargoCompany }
// orderId, /api/orders yanıtındaki OrderId'dir (yani orders.rowid).
// cargoTrackingCodeUrl saklanmıyor - site zaten lib/shipping-tracking-link.ts
// ile kargo firması + takip numarasından kendi linkini üretiyor.
type OrderCargoUpdateBody = {
  orderId?: number;
  orderStatusId?: number;
  cargoTrackingCode?: string;
  updateDateTime?: string;
  cargoCompany?: string;
};

export async function POST(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json(
      { Success: false, Message: "Yetkisiz istek." },
      { status: 401 },
    );
  }

  let body: OrderCargoUpdateBody = {};
  try {
    body = (await request.json()) as OrderCargoUpdateBody;
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

  const status =
    typeof body.orderStatusId === "number"
      ? statusForOrderStatusId(body.orderStatusId)
      : null;
  const shippedAt = body.updateDateTime
    ? fromBirfaturaDate(body.updateDateTime)
    : null;

  const db = getD1();
  const result = await db
    .prepare(
      `UPDATE orders SET
         status = COALESCE(?, status),
         shipping_carrier = COALESCE(?, shipping_carrier),
         tracking_number = COALESCE(?, tracking_number),
         shipped_at = COALESCE(?, shipped_at),
         updated_at = CURRENT_TIMESTAMP
       WHERE rowid = ?`,
    )
    .bind(
      status,
      body.cargoCompany ?? null,
      body.cargoTrackingCode ?? null,
      shippedAt,
      body.orderId,
    )
    .run();

  if (result.meta.changes === 0) {
    return Response.json(
      { Success: false, Message: "Sipariş bulunamadı." },
      { status: 404 },
    );
  }

  return Response.json({ Success: true, Message: "Kargo bilgisi güncellendi." });
}
