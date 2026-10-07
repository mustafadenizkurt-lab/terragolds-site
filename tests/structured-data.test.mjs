import { test } from "node:test";
import assert from "node:assert/strict";
import { productSchema } from "../lib/seo/structured-data.ts";

const baseProduct = {
  id: 42,
  name: "316L Çelik Gold Renk Yüzük",
  description: "Açıklama",
  image: "/uploads/foo.jpg",
  category: "Yüzük",
  price: 199,
  stock: 5,
  shippingFee: "79.90",
};

test("productSchema Google'ın Merchant listing zorunlu kıldığı shippingDetails'i üretir", () => {
  const schema = productSchema(baseProduct);
  assert.equal(schema.offers.shippingDetails["@type"], "OfferShippingDetails");
  assert.equal(schema.offers.shippingDetails.shippingRate.value, "79.90");
  assert.equal(schema.offers.shippingDetails.shippingRate.currency, "TRY");
  assert.equal(schema.offers.shippingDetails.shippingDestination.addressCountry, "TR");
});

test("productSchema Google'ın Merchant listing zorunlu kıldığı hasMerchantReturnPolicy'yi üretir", () => {
  const schema = productSchema(baseProduct);
  assert.equal(schema.offers.hasMerchantReturnPolicy["@type"], "MerchantReturnPolicy");
  assert.equal(schema.offers.hasMerchantReturnPolicy.applicableCountry, "TR");
  assert.equal(schema.offers.hasMerchantReturnPolicy.merchantReturnDays, 14);
});

test("productSchema review yokken aggregateRating eklemez (uydurma puan yok)", () => {
  const schema = productSchema(baseProduct);
  assert.equal("aggregateRating" in schema, false);
});
