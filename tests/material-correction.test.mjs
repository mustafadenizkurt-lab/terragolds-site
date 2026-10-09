import { test } from "node:test";
import assert from "node:assert/strict";
import { correctMaterialWording } from "../lib/xml-sync/material-correction.ts";

test("correctMaterialWording ürün adının başındaki Pirinç'i Çelik yapar", () => {
  assert.equal(
    correctMaterialWording("Pirinç Gold Renk Zirkon Taşlı Sallantı Kalp Model Kadın Küpe"),
    "Çelik Gold Renk Zirkon Taşlı Sallantı Kalp Model Kadın Küpe",
  );
});

test("correctMaterialWording ürün adının ortasındaki/sonundaki pirinci de yakalar", () => {
  assert.equal(
    correctMaterialWording("Gümüş Renk Zirkon Taşlı Pirinç Yıldız Model Kadın Küpe Seti"),
    "Gümüş Renk Zirkon Taşlı Çelik Yıldız Model Kadın Küpe Seti",
  );
  assert.equal(
    correctMaterialWording("Zikzak Model Gold Renk Pirinç Kadın Bileklik"),
    "Zikzak Model Gold Renk Çelik Kadın Bileklik",
  );
});

test("correctMaterialWording açıklamadaki 'pirinçtir' yüklemini doğru çekimle değiştirir", () => {
  assert.equal(
    correctMaterialWording("- Ürün materyali pirinçtir.- Dikkatli kullanımda kararma olmaz."),
    "- Ürün materyali çeliktir.- Dikkatli kullanımda kararma olmaz.",
  );
});

test("correctMaterialWording Gümüş Kaplama / Altın Kaplama'yı tek kelimeye indirir", () => {
  assert.equal(
    correctMaterialWording("Gümüş Kaplama İnce Zincir Kolye"),
    "Çelik İnce Zincir Kolye",
  );
  assert.equal(
    correctMaterialWording("Altın kaplama Zarif Yüzük"),
    "Çelik Zarif Yüzük",
  );
});

test("correctMaterialWording metal olmayan malzemelere (Deri, Doğal Taş) dokunmaz", () => {
  assert.equal(correctMaterialWording("Deri Kordonlu Erkek Bileklik"), "Deri Kordonlu Erkek Bileklik");
  assert.equal(
    correctMaterialWording("Doğal Taş Detaylı Kadın Kolye"),
    "Doğal Taş Detaylı Kadın Kolye",
  );
});

test("correctMaterialWording zaten Çelik olan ürünlere malzeme değişimi uygulamaz", () => {
  assert.equal(
    correctMaterialWording("Çelik Altın Renk 45 cm İtalyan Zincir Model Kadın Kolye"),
    "Çelik Altın Renk 45 cm İtalyan Zincir Model Kadın Kolye",
  );
});

test("correctMaterialWording başındaki '316L' kalite kodunu siler (Trendyol bunu marka sanıp reddediyordu)", () => {
  assert.equal(
    correctMaterialWording("316L Çelik Altın Renk 45 cm İtalyan Zincir Model Kadın Kolye"),
    "Çelik Altın Renk 45 cm İtalyan Zincir Model Kadın Kolye",
  );
});

test("correctMaterialWording ortadaki '316L' kalite kodunu da siler", () => {
  assert.equal(
    correctMaterialWording("Vintage Model 316L Çelik Gold Renk Kadın Küpe"),
    "Vintage Model Çelik Gold Renk Kadın Küpe",
  );
});
