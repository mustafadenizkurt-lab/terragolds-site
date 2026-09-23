// Kasıtlı olarak hiçbir şey import etmiyor (http-utils.ts ile aynı desen) -
// testler doğrudan import edebilsin.

export type N11Attribute = { id: number; valueId?: number; customValue?: string };

// GET /cdn/category/{id}/attribute ham yanıtından (9 kategorinin TAMAMI
// programatik olarak taranarak) çıkarılan gerçek isMandatory=true listeleri:
//   Bijuteri Yüzük (1219213):    Cinsiyet(22) + Marka(1) + Ölçü(1567) + Renk(429)
//   Bijuteri Kolye/Bileklik/Küpe (1219212/1219214/1219216): Cinsiyet(22) + Marka(1) + Renk(429)
//   Broş/Piercing/Şahmeran/Halhal (1191220/1191216/1191217/1191218): Marka(1) + Renk(429)
//   2.El Antika & Koleksiyon (1003526): zorunlu özellik YOK (Marka/Renk/
//     Cinsiyet bu kategoride hiç tanımlı değil - göndermek geçersiz ID olur)
type CategoryRule = {
  gender: boolean;
  size: boolean;
  brandAndColor: boolean;
  steel?: "chain" | "ring" | "bracelet" | "plain";
};

// "Çelik Takılar" (paslanmaz çelik) N11'de "Bijuteri"den AYRI bir ağaç;
// "316L Çelik" ürünler Bijuteri'ye gönderilince "ürün bilgisi ürün grubuyla
// uyumlu değil" (Katalog) ile reddedildi. Çelik kategorilerinin zorunlu
// listeleri (ham yanıttan taranarak):
//   Çelik Kolye 1219218:   Cinsiyet + Marka + Renk + Zincir Uzunluğu(947, valueId)
//   Çelik Yüzük 1219219:   Cinsiyet + Marka + Renk + Yüzük Ölçüsü(620, valueId)
//   Çelik Bileklik 1219220: Cinsiyet + Marka + Renk + Beden(1494, serbest metin)
//   Çelik Bilezik 1219221 / Küpe 1219222 / Set 1219223: Cinsiyet + Marka + Renk
export const N11_STEEL_CATEGORY_BY_GROUP: Record<string, number> = {
  kolyeler: 1219218,
  yuzuk: 1219219,
  bileklik: 1219220,
  kupeler: 1219222,
};
const STEEL_SET_CATEGORY = 1219223;

export function isSteelProduct(name: string): boolean {
  return /316l|çelik/.test(lower(name));
}

export function steelCategoryId(
  groupSlug: string | undefined,
  name: string,
): number | undefined {
  if (!isSteelProduct(name)) return undefined;
  if (/\bset\b|seti\b|takım/.test(lower(name))) return STEEL_SET_CATEGORY;
  return groupSlug ? N11_STEEL_CATEGORY_BY_GROUP[groupSlug] : undefined;
}

const RULES: Record<number, CategoryRule> = {
  1219218: { gender: true, size: false, brandAndColor: true, steel: "chain" },
  1219219: { gender: true, size: false, brandAndColor: true, steel: "ring" },
  1219220: { gender: true, size: false, brandAndColor: true, steel: "bracelet" },
  1219221: { gender: true, size: false, brandAndColor: true, steel: "plain" },
  1219222: { gender: true, size: false, brandAndColor: true, steel: "plain" },
  1219223: { gender: true, size: false, brandAndColor: true, steel: "plain" },
  1219213: { gender: true, size: true, brandAndColor: true },
  1219212: { gender: true, size: false, brandAndColor: true },
  1219214: { gender: true, size: false, brandAndColor: true },
  1219216: { gender: true, size: false, brandAndColor: true },
  1191220: { gender: false, size: false, brandAndColor: true },
  1191216: { gender: false, size: false, brandAndColor: true },
  1191217: { gender: false, size: false, brandAndColor: true },
  1191218: { gender: false, size: false, brandAndColor: true },
  1003526: { gender: false, size: false, brandAndColor: false },
};

// Cinsiyet değer ID'leri KATEGORİYE ÖZGÜ (yüzükteki "Kadın" ID'si kolyede
// geçersiz) - ham yanıttan alındı.
type GenderIds = { erkek: number; kadin: number; unisex: number; cocuk: number };
const GENDER_IDS: Record<number, GenderIds> = {
  1219213: { erkek: 2467475, kadin: 2467568, unisex: 2467536, cocuk: 16358103 },
  1219212: { erkek: 2480550, kadin: 2480474, unisex: 2480444, cocuk: 11095952 },
  1219214: { erkek: 2475352, kadin: 2475283, unisex: 2475355, cocuk: 10993761 },
  1219216: { erkek: 2468122, kadin: 2468071, unisex: 2468125, cocuk: 16224780 },
  1219218: { erkek: 3347021, kadin: 3348229, unisex: 3348166, cocuk: 16483653 },
  1219219: { erkek: 3343714, kadin: 3343689, unisex: 3343355, cocuk: 16313214 },
  1219220: { erkek: 2466042, kadin: 2465963, unisex: 2465977, cocuk: 11111231 },
  1219221: { erkek: 2470562, kadin: 2470510, unisex: 2470531, cocuk: 16484958 },
  1219222: { erkek: 2460640, kadin: 2460611, unisex: 2460645, cocuk: 16342894 },
  1219223: { erkek: 2472962, kadin: 2472956, unisex: 2473017, cocuk: 16286976 },
};

// Çelik Kolye "Zincir Uzunluğu" (947) valueId listesi - yalnızca "N CM"
// biçimindeki gerçek değerler (ham yanıttan). Adında cm yoksa listedeki
// gerçek "Standart" değeri.
const CHAIN_LENGTH_VALUE_ID: Record<number, number> = {
  35: 5970448, 37: 5736248, 38: 3348806, 39: 6167777, 40: 3348322, 41: 3349978,
  42: 3350004, 43: 5416808, 44: 6038489, 45: 3348256, 46: 5365476, 47: 5316392,
  48: 5759458, 50: 3348206, 51: 5662764, 52: 6582609, 53: 5663328, 54: 5759474,
  55: 3348186, 56: 3348370, 57: 3350066, 58: 6090488, 59: 6550968, 60: 3348176,
  61: 5713982, 62: 5759366, 63: 5696852, 64: 5759468, 65: 3348188, 66: 5696880,
  70: 3348190, 75: 3348192, 80: 3348194, 86: 6896258, 100: 6167997,
};
const CHAIN_LENGTH_STANDARD = 3347022;

// Çelik Yüzük "Yüzük Ölçüsü" (620) valueId listesi ("5".."30" + Ayarlanabilir/
// Standart).
const RING_SIZE_VALUE_ID: Record<number, number> = {
  5: 3344478, 6: 3343356, 7: 3343362, 8: 3343364, 9: 3343692, 10: 3343694,
  11: 3343696, 12: 3343792, 13: 3343400, 14: 3343730, 15: 3343790, 16: 3343402,
  17: 3343732, 18: 3343788, 19: 3343404, 20: 3343734, 21: 3343814, 22: 3343786,
  23: 3343708, 24: 3343704, 25: 3343700, 26: 3343702, 27: 3343706, 28: 3343812,
  29: 3344420, 30: 3344336,
};
const RING_SIZE_ADJUSTABLE = 3344396;
const RING_SIZE_STANDARD = 3682272;

export function chainLengthValueId(name: string): number {
  const match = /(\d{2,3})\s*cm/.exec(lower(name));
  const id = match ? CHAIN_LENGTH_VALUE_ID[Number(match[1])] : undefined;
  return id ?? CHAIN_LENGTH_STANDARD;
}

export function steelRingSizeValueId(name: string): number {
  const text = lower(name);
  if (/ayarlanabilir|ayarlamalı|ayarlı/.test(text)) return RING_SIZE_ADJUSTABLE;
  const match = /(?:no|numara|beden|ölçü)\s*[:.]?\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:numara|no\b)/.exec(text);
  const size = Number(match?.[1] ?? match?.[2]);
  return RING_SIZE_VALUE_ID[size] ?? RING_SIZE_STANDARD;
}

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

export function genderValueId(
  categoryId: number,
  product: { category: string; name: string },
): number | null {
  const ids = GENDER_IDS[categoryId];
  if (!ids) return null;
  const haystack = lower(`${product.name} ${product.category}`);
  if (haystack.includes("erkek")) return ids.erkek;
  if (haystack.includes("unisex")) return ids.unisex;
  if (haystack.includes("çocuk")) return ids.cocuk;
  return ids.kadin;
}

// Renk (429) isCustomValue=true (serbest metin) ama N11'in kendi listesindeki
// yazımlarla (Altın, Gümüş, Rose Gold...) eşleştirmek filtrelemede daha iyi.
// Ürün adındaki İLK geçen renk kelimesi kazanır ("Gold Gümüş" -> Altın).
const COLOR_RULES: { pattern: RegExp; color: string }[] = [
  { pattern: /rose|roze|pembe altın/, color: "Rose Gold" },
  { pattern: /gümüş|silver|gumus/, color: "Gümüş" },
  { pattern: /gold|altın|altin/, color: "Altın" },
  { pattern: /siyah|black/, color: "Siyah" },
  { pattern: /bronz/, color: "Bronz" },
  { pattern: /bakır/, color: "Bakır" },
  { pattern: /beyaz|white/, color: "Beyaz" },
  { pattern: /lacivert/, color: "Lacivert" },
  { pattern: /mavi|blue/, color: "Mavi" },
  { pattern: /kırmızı|\bred\b/, color: "Kırmızı" },
  { pattern: /yeşil|green/, color: "Yeşil" },
  { pattern: /mor\b|purple/, color: "Mor" },
  { pattern: /pembe|pink/, color: "Pembe" },
  { pattern: /turuncu/, color: "Turuncu" },
  { pattern: /bordo/, color: "Bordo" },
  { pattern: /kahve/, color: "Kahverengi" },
  { pattern: /renkli|multi/, color: "Çok Renkli" },
];

export function colorFor(product: { name: string; description?: string }): string {
  for (const source of [product.name, product.description ?? ""]) {
    const text = lower(source);
    let best: { index: number; color: string } | null = null;
    for (const rule of COLOR_RULES) {
      const match = rule.pattern.exec(text);
      if (match && (best === null || match.index < best.index)) {
        best = { index: match.index, color: rule.color };
      }
    }
    if (best) return best.color;
  }
  // "Diğer" Renk listesinde gerçekten mevcut bir değer.
  return "Diğer";
}

// Ölçü (1567) yüzük için zorunlu, isCustomValue=true. Listedeki gerçek
// örnekler: "17", "17-18", "17-18 Numara", "Ayarlanabilir", "Tek Ebat",
// "Standart". Ürün adında açık bir numara yoksa "Standart" (listede var).
export function ringSizeFor(product: { name: string }): string {
  const text = lower(product.name);
  if (text.includes("ayarlanabilir") || text.includes("ayarlamalı") || text.includes("ayarlı")) return "Ayarlanabilir";
  const match = /(?:no|numara|beden|ölçü)\s*[:.]?\s*(\d{2}(?:\s*-\s*\d{2})?)|(\d{2}(?:\s*-\s*\d{2})?)\s*(?:numara|no\b)/.exec(
    text,
  );
  const size = match?.[1] ?? match?.[2];
  return size ? size.replace(/\s+/g, "") : "Standart";
}

export function attributesForCategory(
  categoryId: number,
  product: { category: string; name: string; description?: string },
): N11Attribute[] {
  const rule = RULES[categoryId];
  if (!rule) {
    throw new Error(
      `N11 kategori ${categoryId} için zorunlu özellik kuralı tanımlı değil (lib/n11/attributes.ts).`,
    );
  }
  const attributes: N11Attribute[] = [];
  if (rule.brandAndColor) attributes.push({ id: 1, customValue: "Terragolds" });
  if (rule.gender) {
    const valueId = genderValueId(categoryId, product);
    if (valueId !== null) attributes.push({ id: 22, valueId });
  }
  if (rule.size) attributes.push({ id: 1567, customValue: ringSizeFor(product) });
  if (rule.brandAndColor) attributes.push({ id: 429, customValue: colorFor(product) });
  if (rule.steel === "chain") attributes.push({ id: 947, valueId: chainLengthValueId(product.name) });
  if (rule.steel === "ring") attributes.push({ id: 620, valueId: steelRingSizeValueId(product.name) });
  if (rule.steel === "bracelet") attributes.push({ id: 1494, customValue: /ayarlanabilir|ayarlamalı|ayarlı/.test(lower(product.name)) ? "Ayarlanabilir" : "Standart" });
  return attributes;
}
