// Kayıt formunda serbest metin olarak girilen telefonu (boşluk, tire,
// parantez, +90/0 öneki farklı olabiliyor) tek bir kanonik biçime
// indirgiyor - hem kayıt sırasında saklamak hem de telefonla giriş
// yaparken aynı numarayı eşleştirebilmek için AYNI fonksiyon kullanılmalı.
export function normalizePhoneDigits(raw: unknown): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}
