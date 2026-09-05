import { getCustomerFromRequest } from "./customer-auth";
import { calculateCartQuote } from "./cart-pricing";
import type { PaymentProviderId } from "./payment-types";
import { getD1 } from "./store-db";

async function ensureOrdersVatColumn(db: D1Database) {
  const columns = await db.prepare("PRAGMA table_info(orders)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "vat_amount")) {
    await db
      .prepare("ALTER TABLE orders ADD COLUMN vat_amount INTEGER NOT NULL DEFAULT 0")
      .run();
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function stringField(
  body: Record<string, unknown>,
  key: string,
  maximum: number,
) {
  return String(body[key] ?? "").trim().slice(0, maximum);
}

function createOrderId() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString()
    .slice(0, 6)
    .padStart(6, "0");
  return `TG${Date.now().toString(36).toUpperCase()}${random}`;
}

function createRandomNr() {
  return String(
    100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
  );
}

export function getRequestIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

export async function createCheckoutOrder(
  request: Request,
  body: Record<string, unknown>,
  provider: PaymentProviderId,
) {
  const firstName = stringField(body, "firstName", 80);
  const lastName = stringField(body, "lastName", 80);
  const email = stringField(body, "email", 190).toLowerCase();
  const phone = stringField(body, "phone", 30);
  const address = stringField(body, "address", 400);
  const district = stringField(body, "district", 100);
  const city = stringField(body, "city", 100);
  const postcode = stringField(body, "postcode", 20);
  const note = stringField(body, "note", 500);
  const identityNumber = stringField(body, "identityNumber", 11);
  const discountCode = stringField(body, "discountCode", 40);

  if (
    !firstName ||
    !lastName ||
    !emailPattern.test(email) ||
    !phone ||
    !address ||
    !city
  ) {
    throw new Error("Teslimat ve müşteri bilgilerini eksiksiz doldurun.");
  }
  if (provider === "iyzico" && !/^\d{11}$/.test(identityNumber)) {
    throw new Error("iyzico ödemesi için 11 haneli T.C. kimlik numarası gerekli.");
  }

  const customer = await getCustomerFromRequest(request);

  const db = getD1();
  await ensureOrdersVatColumn(db);
  const quote = await calculateCartQuote(body.items, discountCode);
  const orderItems = quote.items;
  const totalAmount = quote.totalAmount;

  const orderId = createOrderId();
  const randomNr = createRandomNr();
  await db.batch([
    db
      .prepare(
        `INSERT INTO orders
          (id, user_id, status, customer_first_name, customer_last_name,
           customer_email, customer_phone, shipping_address,
           shipping_district, shipping_city, shipping_postcode,
           shipping_country, subtotal_amount, discount_amount, vat_amount,
           shipping_amount, discount_code, total_amount, currency,
           payment_provider, shopier_random_nr, customer_note, updated_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 'Turkey',
                 ?, ?, ?, ?, ?, ?, 'TRY', ?, ?, ?, CURRENT_TIMESTAMP)`,
      )
      .bind(
        orderId,
        customer?.id ?? null,
        firstName,
        lastName,
        email,
        phone,
        address,
        district,
        city,
        postcode,
        quote.subtotalAmount,
        quote.discountAmount,
        quote.vatAmount,
        quote.shippingAmount,
        quote.discountCode,
        totalAmount,
        provider,
        randomNr,
        note,
      ),
    ...orderItems.map((item) =>
      db
        .prepare(
          `INSERT INTO order_items
            (order_id, product_id, product_name, unit_price, quantity)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          orderId,
          item.product.id,
          item.product.name,
          item.unitPrice,
          item.quantity,
        ),
    ),
  ]);

  return {
    id: orderId,
    randomNr,
    totalAmount,
    subtotalAmount: quote.subtotalAmount,
    discountAmount: quote.discountAmount,
    vatAmount: quote.vatAmount,
    shippingAmount: quote.shippingAmount,
    discountCode: quote.discountCode,
    currency: "TRY" as const,
    customer,
    customerInput: {
      firstName,
      lastName,
      email,
      phone,
      address,
      district,
      city,
      postcode,
      identityNumber,
    },
    items: orderItems,
  };
}

export async function savePaymentReference(
  orderId: string,
  provider: PaymentProviderId,
  reference: string,
) {
  await getD1()
    .prepare(
      `UPDATE orders
       SET payment_reference = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND payment_provider = ? AND status = 'pending'`,
    )
    .bind(reference, orderId, provider)
    .run();
}
