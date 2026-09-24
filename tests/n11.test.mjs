import assert from "node:assert/strict";
import test from "node:test";
import { buildN11Headers, roundToN11Price } from "../lib/n11/http-utils.ts";
import { mapN11OrderPayload } from "../lib/n11/order-mapping.ts";
import {
  computeRequiredPrice,
  n11EffectiveCommissionRate,
  n11ListPriceFor,
  N11_SHIPPING_COST,
} from "../lib/n11/pricing-formula.ts";

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

import { steelCategoryId } from "../lib/n11/attributes.ts";

test("316L/çelik ürünler Çelik Takılar kategorilerine yönlenir", () => {
  assert.equal(steelCategoryId("kolyeler", "316L Çelik Altın Renk 60 cm İtalyan Zincir Kolye"), 1219218);
  assert.equal(steelCategoryId("bileklik", "316L Çelik Gold Renk Bileklik"), 1219220);
  assert.equal(steelCategoryId("yuzuk", "Çelik Gümüş Yüzük"), 1219219);
  assert.equal(steelCategoryId("kupeler", "316L Çelik Küpe"), 1219222);
  assert.equal(steelCategoryId("kolyeler", "316L Çelik Kolye Küpe Set"), 1219223);
  assert.equal(steelCategoryId("kolyeler", "Gold Renk Pirinç Kolye"), undefined);
  assert.equal(steelCategoryId("antika-vintage", "Çelik Biblo"), undefined);
});

test("Çelik Kolye zincir uzunluğu adındaki cm'den valueId, yoksa Standart", () => {
  const cm60 = attributesForCategory(1219218, { category: "Kolye", name: "316L Çelik Altın Renk 60 cm Kolye" });
  assert.equal(cm60.find((a) => a.id === 947).valueId, 3348176);
  const none = attributesForCategory(1219218, { category: "Kolye", name: "316L Çelik Kalp Kolye" });
  assert.equal(none.find((a) => a.id === 947).valueId, 3347022);
  assert.deepEqual(none.map((a) => a.id).sort((a, b) => a - b), [1, 22, 429, 947]);
});

test("Çelik Yüzük/Bileklik zorunlu özellikleri", () => {
  const ring = attributesForCategory(1219219, { category: "Yüzük", name: "316L Çelik Ayarlamalı Yüzük" });
  assert.equal(ring.find((a) => a.id === 620).valueId, 3344396);
  assert.deepEqual(ring.map((a) => a.id).sort((a, b) => a - b), [1, 22, 429, 620]);
  const bracelet = attributesForCategory(1219220, { category: "Bileklik", name: "316L Çelik Bileklik" });
  assert.deepEqual(bracelet.map((a) => a.id).sort((a, b) => a - b), [1, 22, 429, 1494]);
  assert.equal(attributesForCategory(1219222, { category: "Küpe", name: "316L Küpe" }).length, 3);
});

import { parseTaskDetails } from "../lib/n11/task-parse.ts";

test("parseTaskDetails SUCCESS/FAIL/mükerrer stok kodunu ayırır", () => {
  const parsed = parseTaskDetails({
    status: "PROCESSED",
    skus: [
      { itemCode: "A1", status: "SUCCESS", reasons: [] },
      { itemCode: "B2", status: "FAIL", reasons: ["ürün grubu bilgisiyle uyumlu değil"] },
      { itemCode: "C3", status: "FAIL", reasons: ["C3 seller stock code tarafınızdan kullanılmaktadır."] },
    ],
  });
  assert.equal(parsed.done, true);
  assert.deepEqual(parsed.skus.map((s) => [s.stockCode, s.ok, s.alreadyExists]), [
    ["A1", true, false],
    ["B2", false, false],
    ["C3", false, true],
  ]);
  assert.equal(parseTaskDetails({ status: "IN_QUEUE", skus: [] }).done, false);
  assert.deepEqual(parseTaskDetails(null).skus, []);
});

test("computeRequiredPrice maliyet 100 TL için beklenen fiyatı üretir", () => {
  // productCostWithVat = 100 * 1.2 = 120
  // totalCost = 120 + 85 (N11_SHIPPING_COST) = 205
  // targetProfit = 120 * 0.5 = 60
  // requiredPrice = (205 + 60) / (1 - efektifKomisyon)
  const result = computeRequiredPrice(100);
  assert.ok(Math.abs(result - 265 / (1 - n11EffectiveCommissionRate())) < 1e-9);
});

test("computeRequiredPrice maliyet arttıkça gerekli fiyatı da artırır", () => {
  const low = computeRequiredPrice(50);
  const high = computeRequiredPrice(200);
  assert.ok(high > low);
});

test("computeRequiredPrice maliyet 0 için sadece sabit maliyeti (kargo) yansıtır", () => {
  const result = computeRequiredPrice(0);
  assert.ok(Math.abs(result - N11_SHIPPING_COST / (1 - n11EffectiveCommissionRate())) < 1e-9);
});

test("n11ListPriceFor satış fiyatının üzerinde bir liste fiyatı üretir", () => {
  const listPrice = n11ListPriceFor(1000);
  assert.ok(listPrice > 1000);
  assert.equal(listPrice, Math.round(1000 * 1.01));
});

import { parseProductQueryPage } from "../lib/n11/task-parse.ts";

test("parseProductQueryPage CatalogRejected ve Active durumlarını okur", () => {
  const page = parseProductQueryPage({
    last: false,
    content: [
      { stockCode: "A1", status: "Active", saleStatus: "On_Sale" },
      { stockCode: "B2", status: "CatalogRejected", saleStatus: "On_Sale" },
    ],
  });
  assert.equal(page.last, false);
  assert.deepEqual(page.items.map((i) => [i.stockCode, i.status]), [
    ["A1", "Active"],
    ["B2", "CatalogRejected"],
  ]);
  assert.equal(parseProductQueryPage({ content: [] }).last, true);
  assert.equal(parseProductQueryPage(null).last, true);
});
