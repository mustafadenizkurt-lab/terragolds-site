import { getD1 } from "../../../lib/store-db";
import {
  BIRFATURA_ORDER_STATUS_MAP,
  BIRFATURA_PAYMENT_METHOD_MAP,
  fromBirfaturaDate,
  statusForOrderStatusId,
  toBirfaturaDate,
  verifyBirfaturaRequest,
} from "../../../lib/birfatura";

export const dynamic = "force-dynamic";

// BirFatura'nın "Özel Entegrasyon API" dokümanındaki (developers.birfatura.com/
// dokuman/ozel-entegrasyon-api) gerçek örnek response'uyla birebir
// doğrulandı: { "Orders": [{ OrderId, OrderCode, OrderDate, Billing*/
// Shipping*, PaymentTypeId, Currency, TotalPaid.../ProductsTotal.../
// DiscountTotal... (TaxExcluding/TaxIncluding çiftleri), OrderDetails: [
// { ProductId, ProductCode, ProductName, ProductQuantityType,
// ProductQuantity, VatRate, ProductUnitPriceTaxExcluding/Including }] }] }
//
// Sitede tek bir adres alanı var (ayrı fatura/teslimat adresi yok), o yüzden
// Billing*/Shipping* aynı bilgiyi taşıyor. Tüm fiyatlar D1'de kuruş cinsinden
// (integer, KDV dahil) saklanıyor - dokümandaki "ondalıklı tutarlar
// yuvarlanmamalı" kuralına uyarak Math.round kullanılmadan TL'ye çevriliyor.
const VAT_RATE = 0.2;

function kurusToTl(kurus: number): number {
  return kurus / 100;
}

function excludingTax(includingTl: number): number {
  return includingTl / (1 + VAT_RATE);
}

// D1'de ödendiği anda hesaplanıp saklanan vat_amount, discountedSubtotal'ın
// (kupon/sadakat indirimi düşülmüş, KDV dahil) içindeki KDV payını zaten
// yuvarlayarak taşıyor (bkz. lib/cart-pricing.ts). BirFatura dokümanı
// "ondalıklı tutarlar yuvarlanmamalı, sisteminizdeki hassasiyet korunarak
// gönderilmeli" dediği için, ana tutarlarda excludingTax() ile tekrar bölüp
// yeniden yuvarlamak yerine bu saklanan değeri kullanıyoruz. Kargo tutarı
// vergisiz olduğundan totalAmount - vatAmount, hem ürün toplamı hem de
// kargo dahil ödenen tutar için doğru "TaxExcluding" değerini verir.

type OrdersRequestBody = {
  orderStatusId?: number;
  startDateTime?: string;
  endDateTime?: string;
};

type OrderRow = {
  rowid: number;
  id: string;
  status: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  shippingAddress: string;
  shippingDistrict: string;
  shippingCity: string;
  isCod: number;
  subtotalAmount: number;
  discountAmount: number;
  vatAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

type OrderItemRow = {
  orderId: string;
  productId: number | null;
  productName: string;
  unitPrice: number;
  quantity: number;
};

// Dokümandaki cURL/C#/PHP örneklerinin üçü de aynı: POST + JSON body
// { "orderStatusId": number, "startDateTime": "dd.MM.yyyy HH:mm:ss",
// "endDateTime": "dd.MM.yyyy HH:mm:ss" } - camelCase, orderStatus/
// paymentMethods'un aksine burada GET örneği yok.
export async function POST(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  let body: OrdersRequestBody = {};
  try {
    body = (await request.json()) as OrdersRequestBody;
  } catch {
    body = {};
  }

  const status =
    typeof body.orderStatusId === "number"
      ? statusForOrderStatusId(body.orderStatusId)
      : null;
  const startDate = body.startDateTime
    ? fromBirfaturaDate(body.startDateTime)
    : null;
  const endDate = body.endDateTime ? fromBirfaturaDate(body.endDateTime) : null;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    conditions.push("status = ?");
    params.push(status);
  } else {
    conditions.push("status != 'pending'");
  }
  if (startDate) {
    conditions.push("created_at >= ?");
    params.push(startDate);
  }
  if (endDate) {
    conditions.push("created_at <= ?");
    params.push(endDate);
  }

  const db = getD1();
  const orders = await db
    .prepare(
      `SELECT rowid, id, status, customer_first_name AS customerFirstName,
              customer_last_name AS customerLastName, customer_phone AS customerPhone,
              shipping_address AS shippingAddress, shipping_district AS shippingDistrict,
              shipping_city AS shippingCity, is_cod AS isCod,
              subtotal_amount AS subtotalAmount, discount_amount AS discountAmount,
              vat_amount AS vatAmount, shipping_amount AS shippingAmount,
              total_amount AS totalAmount, currency,
              created_at AS createdAt
       FROM orders
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    .bind(...params)
    .all<OrderRow>();

  if (orders.results.length === 0) {
    return Response.json({ Orders: [] });
  }

  const orderIds = orders.results.map((order) => order.id);
  const placeholders = orderIds.map(() => "?").join(",");
  const items = await db
    .prepare(
      `SELECT order_id AS orderId, product_id AS productId,
              product_name AS productName, unit_price AS unitPrice, quantity
       FROM order_items WHERE order_id IN (${placeholders})`,
    )
    .bind(...orderIds)
    .all<OrderItemRow>();

  const itemsByOrder = new Map<string, OrderItemRow[]>();
  for (const item of items.results) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return Response.json({
    Orders: orders.results.map((order) => {
      const billingName = `${order.customerFirstName} ${order.customerLastName}`.trim();
      const vatIncluding = kurusToTl(order.vatAmount);
      const productsTotalIncluding = kurusToTl(order.totalAmount - order.shippingAmount);
      const totalPaidIncluding = kurusToTl(order.totalAmount);
      const discountTotalIncluding = kurusToTl(order.discountAmount);
      const paymentType = order.isCod
        ? BIRFATURA_PAYMENT_METHOD_MAP.cod
        : BIRFATURA_PAYMENT_METHOD_MAP.card;

      return {
        OrderId: order.rowid,
        OrderCode: order.id,
        OrderDate: toBirfaturaDate(order.createdAt),
        BillingName: billingName,
        BillingAddress: order.shippingAddress,
        BillingTown: order.shippingDistrict,
        BillingCity: order.shippingCity,
        BillingMobilePhone: order.customerPhone,
        ShippingName: billingName,
        ShippingAddress: order.shippingAddress,
        ShippingTown: order.shippingDistrict,
        ShippingCity: order.shippingCity,
        PaymentTypeId: paymentType.id,
        OrderStatusId: BIRFATURA_ORDER_STATUS_MAP[order.status]?.id ?? null,
        Currency: order.currency,
        TotalPaidTaxExcluding: totalPaidIncluding - vatIncluding,
        TotalPaidTaxIncluding: totalPaidIncluding,
        ProductsTotalTaxExcluding: productsTotalIncluding - vatIncluding,
        ProductsTotalTaxIncluding: productsTotalIncluding,
        DiscountTotalTaxExcluding: excludingTax(discountTotalIncluding),
        DiscountTotalTaxIncluding: discountTotalIncluding,
        OrderDetails: (itemsByOrder.get(order.id) ?? []).map((item) => {
          const unitPriceIncluding = kurusToTl(item.unitPrice);
          return {
            ProductId: item.productId ?? 0,
            ProductCode: `TG-${item.productId ?? 0}`,
            ProductName: item.productName,
            ProductQuantityType: "Adet",
            ProductQuantity: item.quantity,
            VatRate: 20,
            ProductUnitPriceTaxExcluding: excludingTax(unitPriceIncluding),
            ProductUnitPriceTaxIncluding: unitPriceIncluding,
          };
        }),
      };
    }),
  });
}
