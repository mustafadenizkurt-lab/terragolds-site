import assert from "node:assert/strict";
import test from "node:test";
import { costWithVat } from "../lib/product-price-lock.ts";

// Kilitli bir kampanya fiyatının (ör. "Her Şey 50 TL") hâlâ güvenli olup
// olmadığı bu fonksiyonla karşılaştırılıyor (bkz. lib/xml-sync/syncSupplier.ts) -
// KDV hariç maliyeti KDV dahile çevirip kilitli fiyatla kıyaslıyor.

test("costWithVat maliyete %20 KDV ekler", () => {
  assert.equal(costWithVat(10), 12);
  assert.equal(costWithVat(30), 36);
  assert.equal(costWithVat(0), 0);
});

test("costWithVat yuvarlar", () => {
  assert.equal(costWithVat(11), 13); // 13.2 -> 13
});
