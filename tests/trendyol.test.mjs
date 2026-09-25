import assert from "node:assert/strict";
import test from "node:test";
import { buildTrendyolAuthHeader, buildTrendyolUserAgent } from "../lib/trendyol/http-utils.ts";
import { mapTrendyolOrderPayload } from "../lib/trendyol/order-mapping.ts";
import {
  computeRequiredPrice,
  effectiveCommissionRateFor,
  clampToPriceLimits,
  calculateTrendyolLimitsFromCost,
  trendyolListPriceFor,
} from "../lib/trendyol/pricing-formula.ts";

// Trendyol henüz API kimlik bilgilerimizi onaylamadı, o yüzden bu testler
// gerçek bir API çağrısı yapmıyor - sadece kimlik bilgisi olmadan da test
// edilebilen SAF fonksiyonları (auth header/user-agent üretimi, sipariş
// yanıtı eşleme) doğruluyor. Örnek sipariş şekli Trendyol'un resmi Sipariş
// Entegrasyonu dokümantasyonundaki yanıt alanlarına (orderNumber, lines,
// shipmentAddress vb.) karşılık geliyor.

test("buildTrendyolAuthHeader Base64 ile doğru Basic auth header'ı üretir", () => {
  const header = buildTrendyolAuthHeader("myApiKey", "myApiSecret");
  assert.equal(header, `Basic ${Buffer.from("myApiKey:myApiSecret").toString("base64")}`);
});

test("buildTrendyolUserAgent Trendyol'un beklediği formatı üretir", () => {
  assert.equal(buildTrendyolUserAgent("123456"), "123456 - SelfIntegration");
});

test("mapTrendyolOrderPayload örnek bir Trendyol siparişini doğru eşliyor", () => {
  // Trendyol'un GET /order/sellers/{supplierId}/orders örnek yanıtındaki
  // "content" dizisinin bir elemanına karşılık gelen şekil.
  const samplePackage = {
    shipmentPackageId: 987654321,
    orderNumber: "TY-2026-000123",
    status: "Created",
    grossAmount: 349.9,
    totalDiscount: 20,
    customerFirstName: "Ayşe",
    customerLastName: "Yılmaz",
    customerEmail: "ayse@example.com",
    orderDate: 1750000000000,
    shipmentAddress: {
      address1: "Örnek Mahalle Örnek Sokak No:1",
      district: "Kadıköy",
      city: "İstanbul",
      postalCode: "34710",
      countryCode: "TR",
      phone: "5551234567",
    },
    lines: [
      {
        barcode: "TG-42",
        productName: "316L Çelik Gold Kolye",
        quantity: 2,
        price: 174.95,
        productId: 42,
      },
    ],
  };

  const mapped = mapTrendyolOrderPayload(samplePackage);

  assert.equal(mapped.orderNumber, "TY-2026-000123");
  assert.equal(mapped.status, "paid");
  assert.equal(mapped.customerFirstName, "Ayşe");
  assert.equal(mapped.customerLastName, "Yılmaz");
  assert.equal(mapped.customerEmail, "ayse@example.com");
  assert.equal(mapped.customerPhone, "5551234567");
  assert.equal(mapped.shippingAddress, "Örnek Mahalle Örnek Sokak No:1");
  assert.equal(mapped.shippingDistrict, "Kadıköy");
  assert.equal(mapped.shippingCity, "İstanbul");
  assert.equal(mapped.shippingPostcode, "34710");
  assert.equal(mapped.shippingCountry, "TR");
  // 349.9 TL -> 34990 kuruş
  assert.equal(mapped.totalAmount, 34990);
  // 20 TL -> 2000 kuruş
  assert.equal(mapped.discountAmount, 2000);
  assert.equal(mapped.currency, "TRY");
  assert.equal(mapped.items.length, 1);
  assert.deepEqual(mapped.items[0], {
    productId: 42,
    name: "316L Çelik Gold Kolye",
    quantity: 2,
    // 174.95 TL -> 17495 kuruş
    unitPrice: 17495,
  });
});

test("mapTrendyolOrderPayload durum eşlemesi: Shipped/Delivered/Cancelled/Returned", () => {
  const base = {
    orderNumber: "TY-1",
    grossAmount: 100,
    totalDiscount: 0,
    lines: [],
  };
  assert.equal(mapTrendyolOrderPayload({ ...base, status: "Shipped" }).status, "shipped");
  assert.equal(mapTrendyolOrderPayload({ ...base, status: "Delivered" }).status, "delivered");
  assert.equal(mapTrendyolOrderPayload({ ...base, status: "Cancelled" }).status, "cancelled");
  assert.equal(mapTrendyolOrderPayload({ ...base, status: "Returned" }).status, "cancelled");
  assert.equal(mapTrendyolOrderPayload({ ...base, status: "Created" }).status, "paid");
});

test("mapTrendyolOrderPayload eksik müşteri/adres alanlarında çökmüyor", () => {
  const mapped = mapTrendyolOrderPayload({
    orderNumber: "TY-2",
    status: "Awaiting",
    grossAmount: 0,
    totalDiscount: 0,
    lines: [],
  });
  assert.equal(mapped.customerFirstName, "");
  assert.equal(mapped.shippingCity, "");
  assert.equal(mapped.shippingCountry, "TR");
  assert.equal(mapped.trackingNumber, "");
  assert.deepEqual(mapped.items, []);
});

test("computeRequiredPrice maliyet 100 TL için beklenen fiyatı üretir (varsayılan %22 komisyon + komisyon üzerine %20 KDV + %2 hizmet bedeli)", () => {
  // productCostWithVat = 100 * 1.2 = 120
  // totalCost = 120 + 29 (ORDER_FEE) + 80 (SHIPPING_COST) = 229
  // targetProfit = 120 * 0.5 = 60
  // efektif komisyon = 0.22 * 1.2 + 0.02 (hizmet bedeli) = 0.284
  // requiredPrice = (229 + 60) / (1 - 0.284) = 289 / 0.716
  const result = computeRequiredPrice(100, 9999); // bilinmeyen kategori -> default oran
  assert.ok(Math.abs(result - 289 / (1 - effectiveCommissionRateFor(9999))) < 1e-9);
});

test("computeRequiredPrice maliyet arttıkça gerekli fiyatı da artırır", () => {
  const low = computeRequiredPrice(50, 9999);
  const high = computeRequiredPrice(200, 9999);
  assert.ok(high > low);
});

test("computeRequiredPrice maliyet 0 için sadece sabit maliyetleri (kargo+sipariş) yansıtır", () => {
  // productCostWithVat=0, targetProfit=0 -> requiredPrice = (0+29+80+0) / (1-efektifKomisyon)
  const result = computeRequiredPrice(0, 9999);
  assert.ok(Math.abs(result - 109 / (1 - effectiveCommissionRateFor(9999))) < 1e-9);
});

test("clampToPriceLimits sınır yoksa fiyatı olduğu gibi bırakır", () => {
  assert.equal(clampToPriceLimits(500, null, null), 500);
});

test("clampToPriceLimits alt sınırın altına inmiyor", () => {
  assert.equal(clampToPriceLimits(300, 400, null), 400);
  assert.equal(clampToPriceLimits(500, 400, null), 500);
});

test("clampToPriceLimits üst sınırın üstüne çıkmıyor", () => {
  assert.equal(clampToPriceLimits(900, null, 800), 800);
  assert.equal(clampToPriceLimits(700, null, 800), 700);
});

test("clampToPriceLimits alt ve üst sınır birlikte verildiğinde ikisine de uyar", () => {
  assert.equal(clampToPriceLimits(100, 400, 800), 400);
  assert.equal(clampToPriceLimits(1000, 400, 800), 800);
  assert.equal(clampToPriceLimits(600, 400, 800), 600);
});

test("calculateTrendyolLimitsFromCost maliyet 150 TL altında (uygun ürün) 25 TL kâr hedefiyle hesaplar", () => {
  // costWithVat = 100 * 1.2 = 120
  // lowerLimit = (120 + 80 (kargo) + 30 (ebijuteri sipariş ücreti) + 25 (min kâr, <150 TL)) / (1 - efektif komisyon) = 255 / (1 - 0.284)
  const { lowerLimit, upperLimit } = calculateTrendyolLimitsFromCost(100, 9999);
  const expectedLower = Math.round(255 / (1 - effectiveCommissionRateFor(9999)));
  assert.equal(lowerLimit, expectedLower);
  assert.equal(upperLimit, Math.round(expectedLower * 1.5));
});

test("calculateTrendyolLimitsFromCost maliyet 150 TL ve üstünde (yüksek ürün) 50 TL kâr hedefiyle hesaplar", () => {
  // costWithVat = 150 * 1.2 = 180
  // lowerLimit = (180 + 80 (kargo) + 30 + 50 (min kâr, >=150 TL)) / (1 - efektif komisyon) = 340 / (1 - 0.284)
  const { lowerLimit, upperLimit } = calculateTrendyolLimitsFromCost(150, 9999);
  const expectedLower = Math.round(340 / (1 - effectiveCommissionRateFor(9999)));
  assert.equal(lowerLimit, expectedLower);
  assert.equal(upperLimit, Math.round(expectedLower * 1.5));
});

test("calculateTrendyolLimitsFromCost 150 TL eşiğinin hemen altı ve üstü arasında kâr hedefi sıçrar", () => {
  const belowThreshold = calculateTrendyolLimitsFromCost(149, 9999);
  const atThreshold = calculateTrendyolLimitsFromCost(150, 9999);
  assert.ok(atThreshold.lowerLimit > belowThreshold.lowerLimit);
});

test("calculateTrendyolLimitsFromCost maliyet arttıkça sınırları da artırır", () => {
  const low = calculateTrendyolLimitsFromCost(50, 9999);
  const high = calculateTrendyolLimitsFromCost(200, 9999);
  assert.ok(high.lowerLimit > low.lowerLimit);
  assert.ok(high.upperLimit > low.upperLimit);
});

test("calculateTrendyolLimitsFromCost üst sınır her zaman alt sınırdan büyük", () => {
  const { lowerLimit, upperLimit } = calculateTrendyolLimitsFromCost(75, 9999);
  assert.ok(upperLimit > lowerLimit);
});

test("trendyolListPriceFor satış fiyatının %10 indirimli göründüğü bir liste fiyatı üretir", () => {
  const listPrice = trendyolListPriceFor(900);
  assert.ok(listPrice > 900);
  assert.equal(listPrice, Math.round(900 / 0.9));
  // 900, 1000'in %10 indirimlisi olarak görünmeli
  assert.equal(Math.round(listPrice * 0.9), 900);
});
