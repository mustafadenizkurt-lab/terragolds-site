import assert from "node:assert/strict";
import test from "node:test";
import { buildN11Headers, roundToN11Price } from "../lib/n11/http-utils.ts";
import { mapN11OrderPayload } from "../lib/n11/order-mapping.ts";

// N11'in resmi entegrasyon dokümanındaki (kullanıcının indirdiği PDF/DOCX)
// product-create/update, price-stock-update ve shipmentPackages
// şemalarına göre - gerçek bir API çağrısı yapmıyor, sadece kimlik
// bilgisi olmadan da test edilebilen SAF fonksiyonları doğruluyor
// (Trendyol'daki tests/trendyol.test.mjs ile aynı desen).

test("buildN11Headers appkey/appsecret header'larını doğru üretir", () => {
  const headers = buildN11Headers("myAppKey", "myAppSecret");
  assert.equal(headers.appkey, "myAppKey");
  assert.equal(headers.appsecret, "myAppSecret");
  assert.equal(headers["content-type"], "application/json");
});

test("roundToN11Price 2 ondalık haneye yuvarlar", () => {
  assert.equal(roundToN11Price(129.999), 130);
  assert.equal(roundToN11Price(129.9), 129.9);
  assert.equal(roundToN11Price(0.1 + 0.2), 0.3);
});

test("mapN11OrderPayload örnek bir N11 sipariş paketini doğru eşliyor", () => {
  // N11'in resmi dokümanındaki GET /rest/delivery/v1/shipmentPackages örnek
  // yanıt alanlarına (orderNumber, lines[], shipmentPackageStatus vb.)
  // karşılık geliyor.
  const samplePackage = {
    orderNumber: "N11-2026-000123",
    shipmentPackageStatus: "Picking",
    customerFirstName: "Ayşe",
    customerLastName: "Yılmaz",
    customerEmail: "ayse@example.com",
    shippingAddress: {
      address: "Örnek Mahalle Örnek Sokak No:1",
      district: "Kadıköy",
      city: "İstanbul",
      postalCode: "34710",
      countryCode: "TR",
      phone: "5551234567",
    },
    lines: [
      {
        stockCode: "TG-42",
        productName: "316L Çelik Gold Kolye",
        quantity: 2,
        price: 174.95,
        productId: 42,
        orderLineId: 555,
      },
    ],
  };

  const mapped = mapN11OrderPayload(samplePackage);

  assert.equal(mapped.orderNumber, "N11-2026-000123");
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
  assert.equal(mapped.currency, "TRY");
  assert.equal(mapped.items.length, 1);
  assert.deepEqual(mapped.items[0], {
    productId: 42,
    name: "316L Çelik Gold Kolye",
    quantity: 2,
    // 174.95 TL -> 17495 kuruş
    unitPrice: 17495,
    lineId: 555,
  });
  // totalAmount dokümanda örneklenmedi - satır toplamından hesaplanmalı:
  // 17495 * 2 = 34990
  assert.equal(mapped.totalAmount, 34990);
});

test("mapN11OrderPayload durum eşlemesi: Picking dışındaki tahmini durumlar", () => {
  const base = { orderNumber: "N11-1", lines: [] };
  assert.equal(
    mapN11OrderPayload({ ...base, shipmentPackageStatus: "Shipped" }).status,
    "shipped",
  );
  assert.equal(
    mapN11OrderPayload({ ...base, shipmentPackageStatus: "Delivered" }).status,
    "delivered",
  );
  assert.equal(
    mapN11OrderPayload({ ...base, shipmentPackageStatus: "Cancelled" }).status,
    "cancelled",
  );
  assert.equal(
    mapN11OrderPayload({ ...base, shipmentPackageStatus: "Picking" }).status,
    "paid",
  );
});

test("mapN11OrderPayload eksik müşteri/adres alanlarında çökmüyor", () => {
  const mapped = mapN11OrderPayload({
    orderNumber: "N11-2",
    shipmentPackageStatus: "New",
    lines: [],
  });
  assert.equal(mapped.customerFirstName, "");
  assert.equal(mapped.shippingCity, "");
  assert.equal(mapped.shippingCountry, "TR");
  assert.equal(mapped.trackingNumber, "");
  assert.equal(mapped.totalAmount, 0);
  assert.deepEqual(mapped.items, []);
});

test("mapN11OrderPayload sağlanan totalAmount'u satır toplamına tercih eder", () => {
  const mapped = mapN11OrderPayload({
    orderNumber: "N11-3",
    shipmentPackageStatus: "Picking",
    totalAmount: 349.9,
    lines: [
      { stockCode: "TG-1", quantity: 1, price: 100, orderLineId: 1 },
    ],
  });
  // 349.9 TL -> 34990 kuruş (satır toplamı 10000 olurdu, ama gerçek
  // totalAmount verildiği için o kullanılmalı)
  assert.equal(mapped.totalAmount, 34990);
});

import {
  attributesForCategory,
  colorFor,
  genderValueId,
  ringSizeFor,
} from "../lib/n11/attributes.ts";

// Zorunlu özellik listeleri 9 kategorinin ham /cdn/category/{id}/attribute
// yanıtından programatik olarak çıkarıldı (bkz. lib/n11/attributes.ts).
test("attributesForCategory yüzük için Marka+Cinsiyet+Ölçü+Renk üretir", () => {
  const attrs = attributesForCategory(1219213, {
    category: "Bayan Yüzük ve Kombinler",
    name: "Gümüş Renk Köşeli Yonca Model Zirkon Taşlı Kadın Yüzük",
  });
  assert.deepEqual(attrs.map((a) => a.id).sort((a, b) => a - b), [1, 22, 429, 1567]);
  assert.equal(attrs.find((a) => a.id === 429).customValue, "Gümüş");
  assert.equal(attrs.find((a) => a.id === 22).valueId, 2467568);
});

test("Cinsiyet değer ID'leri kategoriye özgü (kolyede yüzük ID'si kullanılmaz)", () => {
  const p = { category: "Kolye", name: "Gold Renk Kadın Kolye" };
  assert.equal(genderValueId(1219212, p), 2480474);
  assert.equal(genderValueId(1219214, p), 2475283);
  assert.equal(genderValueId(1219216, p), 2468071);
  assert.equal(genderValueId(1191220, p), null);
});

test("Broş/Piercing/Şahmeran/Halhal Cinsiyet göndermez, Antika hiç özellik göndermez", () => {
  const p = { category: "x", name: "Gold Renk Broş" };
  for (const id of [1191220, 1191216, 1191217, 1191218]) {
    assert.deepEqual(attributesForCategory(id, p).map((a) => a.id), [1, 429]);
  }
  assert.deepEqual(attributesForCategory(1003526, p), []);
});

test("kategori kuralı olmayan ID için hata fırlatır", () => {
  assert.throws(() => attributesForCategory(999, { category: "x", name: "y" }));
});

test("colorFor ürün adındaki ilk rengi seçer, yoksa Diğer", () => {
  assert.equal(colorFor({ name: "Gold Renk Nazar Boncuk Model Kadın Yüzük" }), "Altın");
  assert.equal(colorFor({ name: "Pirinç Gümüş Renk Beyaz Sedefli Yonca Yüzük" }), "Gümüş");
  assert.equal(colorFor({ name: "Rose Gold Kalpli Kolye" }), "Rose Gold");
  assert.equal(colorFor({ name: "Nazar Boncuklu Kolye" }), "Diğer");
});

test("ringSizeFor numara/ayarlanabilir/varsayılan", () => {
  assert.equal(ringSizeFor({ name: "Ayarlamalı Silver Renk Yüzük" }), "Ayarlanabilir");
  assert.equal(ringSizeFor({ name: "Gold Yüzük No: 17" }), "17");
  assert.equal(ringSizeFor({ name: "Gold Renk Kadın Yüzük" }), "Standart");
});
