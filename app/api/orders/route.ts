import { getD1 } from "../../../lib/store-db";
import {
  BIRFATURA_ORDER_STATUS_MAP,
  BIRFATURA_PAYMENT_METHOD_MAP,
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

// D1: "2026-07-16 10:30:00" -> BirFatura: "16.07.2026 10:30:00"
function toBirfaturaDate(sqliteTimestamp: string): string {
  const [datePart, timePart] = sqliteTimestamp.split(" ");
  const [year, month, day] = datePart.split("-");
  return `${day}.${month}.${year} ${timePart ?? "00:00:00"}`;
}

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

// Dokümanın cURL/PHP örnekleri POST, C# örneği GET kullanıyor (bkz.
// orderStatus/paymentMethods) - ikisini de kabul ediyoruz. Tarih
// aralığı/durum filtresinin body'de mi query'de mi geldiği henüz
// doğrulanmadığından şimdilik sadece query parametreleri okunuyor.
async function handle(request: Request) {
  if (!(await verifyBirfaturaRequest(request))) {
    return Response.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const since = searchParams.get("since"); // ISO tarih - opsiyonel, verilirse sadece bu tarihten sonra güncellenen siparişler

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
       WHERE status != 'pending'
         ${since ? "AND updated_at > ?" : ""}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...(since ? [since, limit] : [limit]))
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

export const GET = handle;
export const POST = handle;
