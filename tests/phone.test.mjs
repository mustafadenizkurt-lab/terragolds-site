import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhoneDigits } from "../lib/phone.ts";

// Kayıt formunda serbest metin olarak girilen telefonun (0/+90 önekli,
// boşluklu/tireli) tek bir kanonik 10 haneli forma indirgendiğini
// doğruluyor - kayıt sırasında saklanan ve giriş sırasında sorgulanan
// değer AYNI fonksiyondan geçmezse telefonla giriş asla eşleşmez.

test("normalizePhoneDigits 0 önekini kaldırır", () => {
  assert.equal(normalizePhoneDigits("05321234567"), "5321234567");
});

test("normalizePhoneDigits +90 önekini kaldırır", () => {
  assert.equal(normalizePhoneDigits("+90 532 123 45 67"), "5321234567");
});

test("normalizePhoneDigits zaten 10 haneliyse aynen döner", () => {
  assert.equal(normalizePhoneDigits("532 123 45 67"), "5321234567");
});

test("normalizePhoneDigits geçersiz uzunlukta null döner", () => {
  assert.equal(normalizePhoneDigits("12345"), null);
  assert.equal(normalizePhoneDigits(""), null);
  assert.equal(normalizePhoneDigits(undefined), null);
});
