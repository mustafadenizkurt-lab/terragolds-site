import assert from "node:assert/strict";
import test from "node:test";
import { buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent, normalizeIntegratorName } from "../lib/hepsiburada/http-utils.ts";
import { mapHepsiburadaOrderPayload } from "../lib/hepsiburada/order-mapping.ts";
import { computeRequiredPrice, effectiveCommissionRate } from "../lib/hepsiburada/pricing-formula.ts";

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

test("computeRequiredPrice maliyet 100 TL için beklenen fiyatı üretir (%22 komisyon + komisyon üzerine %20 KDV)", () => {
  // productCostWithVat = 100 * 1.2 = 120
  // totalCost = 120 + 29 (ORDER_FEE) + 80 (SHIPPING_COST) = 229
  // targetProfit = 120 * 0.5 = 60
  // efektif komisyon = 0.22 * 1.2 = 0.264
  // requiredPrice = (229 + 60) / (1 - 0.264) = 289 / 0.736
  const result = computeRequiredPrice(100);
  assert.ok(Math.abs(result - 289 / (1 - effectiveCommissionRate())) < 1e-9);
});

test("computeRequiredPrice maliyet arttıkça gerekli fiyatı da artırır", () => {
  const low = computeRequiredPrice(50);
  const high = computeRequiredPrice(200);
  assert.ok(high > low);
});

test("computeRequiredPrice maliyet 0 için sadece sabit maliyetleri (kargo+sipariş) yansıtır", () => {
  const result = computeRequiredPrice(0);
  assert.ok(Math.abs(result - 109 / (1 - effectiveCommissionRate())) < 1e-9);
});


test("entegratör adı noktasız ı ve boşluklardan arındırılır (401 nedeni)", () => {
  assert.equal(normalizeIntegratorName("selfıt_dev"), "selfit_dev");
  assert.equal(normalizeIntegratorName("  selfit_dev \n"), "selfit_dev");
  assert.equal(buildHepsiburadaUserAgent("selfıt_dev"), "selfit_dev");
});

import { buildImportItem, hepsiburadaCategoryFor, HB_CATEGORY } from "../lib/hepsiburada/attributes.ts";

test("hepsiburadaCategoryFor sitedeki kategorileri Hepsiburada Bijuteri kategorilerine eşler", () => {
  assert.equal(hepsiburadaCategoryFor({ category: "Kolye", name: "Gold Kadın Kolye" }), HB_CATEGORY.kolye);
  assert.equal(hepsiburadaCategoryFor({ category: "Erkek Kolye", name: "Erkek Zincir Kolye" }), HB_CATEGORY.erkekKolye);
  assert.equal(hepsiburadaCategoryFor({ category: "Bayan Yüzük ve Kombinler", name: "Zirkon Yüzük" }), HB_CATEGORY.yuzuk);
  assert.equal(hepsiburadaCategoryFor({ category: "Küpe", name: "Halka Küpe" }), HB_CATEGORY.kupe);
  assert.equal(hepsiburadaCategoryFor({ category: "Bayan Bileklik", name: "Bileklik" }), HB_CATEGORY.bileklik);
  assert.equal(hepsiburadaCategoryFor({ category: "Takı", name: "Kalp Kolye" }), HB_CATEGORY.kolye);
  assert.equal(hepsiburadaCategoryFor({ category: "Hal Hal", name: "Halhal" }), HB_CATEGORY.halhal);
  assert.equal(hepsiburadaCategoryFor({ category: "Şahmeran", name: "Şahmeran" }), null);
  assert.equal(hepsiburadaCategoryFor({ category: "Antika ~ Vintage", name: "Biblo" }), null);
});

test("buildImportItem zorunlu özellikleri üretir, yüzükte cinsiyet ekler", () => {
  const item = buildImportItem({
    merchantId: "M1", categoryId: HB_CATEGORY.yuzuk, merchantSku: "BYK1",
    title: "Zirkon Yüzük", description: "Açıklama", images: ["https://x/a.jpg", "https://x/b.jpg"], male: false,
  });
  assert.equal(item.merchant, "M1");
  for (const key of ["merchantSku", "Barcode", "UrunAdi", "Marka", "tax_vat_rate", "Image1"]) {
    assert.ok(item.attributes[key], key);
  }
  assert.equal(item.attributes.Image2, "https://x/b.jpg");
  assert.equal(item.attributes.cinsiyet, "Kadın");
  const kolye = buildImportItem({ merchantId: "M1", categoryId: HB_CATEGORY.kolye, merchantSku: "K1", title: "K", description: "d", images: ["https://x/a.jpg"], male: false });
  assert.equal(kolye.attributes.cinsiyet, undefined);
});

import { parseImportStatus } from "../lib/hepsiburada/import-parse.ts";

test("parseImportStatus yetki reddi, hata ve bekleyen durumları ayırır", () => {
  const denied = parseImportStatus({
    data: [{ merchantSku: "A", importStatus: "FAILED", importMessages: [{ severity: "ERROR", message: "Access denied for merchant X" }] }],
  });
  assert.equal(denied[0].outcome, "accessDenied");
  const failed = parseImportStatus({
    data: [{ merchantSku: "B", importStatus: "FAILED", importMessages: [{ severity: "ERROR", message: "Marka bulunamadı" }] }],
  });
  assert.equal(failed[0].outcome, "failed");
  assert.match(failed[0].reason, /Marka/);
  const pending = parseImportStatus({ data: [{ merchantSku: "C", importStatus: "IN_PROGRESS", importMessages: [] }] });
  assert.equal(pending[0].outcome, "pending");
  const ok = parseImportStatus({
    data: [{ merchantSku: "D", importStatus: "SUCCESS", productStatus: "WAITING_FOR_APPROVAL", importMessages: [] }],
  });
  assert.equal(ok[0].outcome, "success");
  assert.deepEqual(parseImportStatus(null), []);
});
