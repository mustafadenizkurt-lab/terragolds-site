import assert from "node:assert/strict";
import test from "node:test";
import { buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "../lib/hepsiburada/http-utils.ts";
import { mapHepsiburadaOrderPayload } from "../lib/hepsiburada/order-mapping.ts";

// Hepsiburada henüz API kimlik bilgilerimizi onaylamadı, o yüzden bu
// testler gerçek bir API çağrısı yapmıyor - sadece kimlik bilgisi olmadan
// da test edilebilen SAF fonksiyonları (auth header/user-agent üretimi,
// sipariş yanıtı eşleme) doğruluyor. tests/trendyol.test.mjs ile aynı desen.

test("buildHepsiburadaAuthHeader merchantId:secretKey ile doğru Basic auth header'ı üretir", () => {
  const header = buildHepsiburadaAuthHeader("11111111-2222-3333-4444-555555555555", "aB3xQ9mZ7kLp");
  assert.equal(
    header,
    `Basic ${Buffer.from("11111111-2222-3333-4444-555555555555:aB3xQ9mZ7kLp").toString("base64")}`,
  );
});

test("buildHepsiburadaUserAgent entegratör adını olduğu gibi döndürür", () => {
  assert.equal(buildHepsiburadaUserAgent("x_dev"), "x_dev");
});

test("mapHepsiburadaOrderPayload örnek bir Hepsiburada siparişini doğru eşliyor", () => {
  const samplePackage = {
    orderNumber: "HB-2026-000456",
    packageNumber: "PKG-999",
    status: "Open",
    totalPrice: 349.9,
    totalDiscount: 20,
    customerName: "Ayşe Yılmaz",
    customerEmail: "ayse@example.com",
    orderDate: "2026-06-15T10:00:00Z",
    deliveryAddress: {
      address: "Örnek Mahalle Örnek Sokak No:1",
      town: "Kadıköy",
      city: "İstanbul",
      postalCode: "34710",
      countryCode: "TR",
      phoneNumber: "5551234567",
    },
    items: [
      {
        merchantSku: "TG-42",
        productName: "316L Çelik Gold Kolye",
        quantity: 2,
        unitPrice: 174.95,
      },
    ],
  };

  const mapped = mapHepsiburadaOrderPayload(samplePackage);

  assert.equal(mapped.orderNumber, "HB-2026-000456");
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
    productId: null,
    name: "316L Çelik Gold Kolye",
    quantity: 2,
    // 174.95 TL -> 17495 kuruş
    unitPrice: 17495,
  });
});

test("mapHepsiburadaOrderPayload durum eşlemesi: Shipped/Delivered/Cancelled/Returned", () => {
  const base = {
    orderNumber: "HB-1",
    totalPrice: 100,
    totalDiscount: 0,
    items: [],
  };
  assert.equal(mapHepsiburadaOrderPayload({ ...base, status: "Shipped" }).status, "shipped");
  assert.equal(mapHepsiburadaOrderPayload({ ...base, status: "Delivered" }).status, "delivered");
  assert.equal(mapHepsiburadaOrderPayload({ ...base, status: "Cancelled" }).status, "cancelled");
  assert.equal(mapHepsiburadaOrderPayload({ ...base, status: "Returned" }).status, "cancelled");
  assert.equal(mapHepsiburadaOrderPayload({ ...base, status: "Open" }).status, "paid");
});

test("mapHepsiburadaOrderPayload tek kelimelik veya eksik müşteri adında çökmüyor", () => {
  const mappedSingleName = mapHepsiburadaOrderPayload({
    orderNumber: "HB-2",
    status: "Open",
    totalPrice: 0,
    totalDiscount: 0,
    customerName: "Ayşe",
    items: [],
  });
  assert.equal(mappedSingleName.customerFirstName, "Ayşe");
  assert.equal(mappedSingleName.customerLastName, "");

  const mappedNoName = mapHepsiburadaOrderPayload({
    orderNumber: "HB-3",
    status: "Awaiting",
    totalPrice: 0,
    totalDiscount: 0,
    items: [],
  });
  assert.equal(mappedNoName.customerFirstName, "");
  assert.equal(mappedNoName.shippingCity, "");
  assert.equal(mappedNoName.shippingCountry, "TR");
  assert.equal(mappedNoName.trackingNumber, "");
  assert.deepEqual(mappedNoName.items, []);
});
