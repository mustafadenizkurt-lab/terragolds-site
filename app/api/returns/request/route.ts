import { isSameOriginRequest } from "../../../../lib/customer-auth";
import { parseReturnRequestInput } from "../../../../lib/return-request-input";
import { getD1, readSettings } from "../../../../lib/store-db";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} from "../../../../lib/transactional-email";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  let input;
  try {
    input = parseReturnRequestInput(
      (await request.json()) as Record<string, unknown>,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Form bilgileri geçersiz.",
      },
      { status: 400 },
    );
  }

  let requestId: number;
  try {
    const inserted = await getD1()
      .prepare(
        `INSERT INTO return_requests
          (full_name, email, phone, order_number, product_description,
           tracking_number, reason, iban)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.fullName,
        input.email,
        input.phone,
        input.orderNumber,
        input.productDescription,
        input.trackingNumber,
        input.reason,
        input.iban,
      )
      .run();
    requestId = inserted.meta.last_row_id;
  } catch (error) {
    console.error("return-request insert failed", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Talep kaydedilemedi.",
      },
      { status: 500 },
    );
  }

  if (getTransactionalEmailConfiguration().configured) {
    const settings = await readSettings();
    const storeEmail = settings.email;

    const summaryRows = [
      ["Ad Soyad", input.fullName],
      ["E-posta", input.email],
      ["Telefon", input.phone],
      ["Sipariş Numarası", input.orderNumber],
      ["İade Edilen Ürün(ler)", input.productDescription],
      ["Kargo Takip Numarası", input.trackingNumber || "—"],
      ["İade Nedeni", input.reason || "—"],
      ["IBAN", input.iban || "—"],
    ];
    const summaryHtml = summaryRows
      .map(
        ([label, value]) =>
          `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
      )
      .join("");
    const summaryText = summaryRows
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");

    if (storeEmail) {
      await sendTransactionalEmail({
        to: storeEmail,
        subject: `Yeni iade talebi — Sipariş ${input.orderNumber}`,
        html: `<p>Yeni bir iade talebi alındı.</p><table>${summaryHtml}</table>`,
        text: `Yeni bir iade talebi alındı.\n\n${summaryText}`,
        idempotencyKey: `return-request-store-${requestId}`,
      }).catch(() => {});
    }

    await sendTransactionalEmail({
      to: input.email,
      subject: "İade talebiniz alındı — Terragolds",
      html: `<p>Merhaba ${escapeHtml(input.fullName)},</p><p>İade talebiniz alınmıştır, en kısa sürede incelenip size dönüş yapılacaktır.</p><table>${summaryHtml}</table>`,
      text: `Merhaba ${input.fullName},\n\nİade talebiniz alınmıştır, en kısa sürede incelenip size dönüş yapılacaktır.\n\n${summaryText}`,
      idempotencyKey: `return-request-customer-${requestId}`,
    }).catch(() => {});
  }

  return Response.json({ ok: true }, { status: 201 });
}
