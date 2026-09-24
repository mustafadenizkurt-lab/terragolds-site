// Kasıtlı olarak hiçbir şey import etmiyor (testler doğrudan import edebilsin).

// Hepsiburada kategori ID'leri GET /product/api/categories/get-all-categories
// (leaf=true) yanıtından, zorunlu özellikler GET .../categories/{id}/attributes
// yanıtından çıkarıldı (resmi doküman 403 verdiği için gerçek yanıttan).
// Tüm bu kategorilerde zorunlu: merchantSku, UrunAdi, Barcode, Marka,
// tax_vat_rate, Image1. Ek olarak sadece Yüzük ve Erkek Yüzük: cinsiyet (enum).
export const HB_CATEGORY = {
  kolye: 60001609, // Kadın > Kolye > Bijuteri Kolye
  yuzuk: 60001620, // Kadın > Yüzük > Bijuteri Yüzük
  kupe: 60001608, // Kadın > Küpe > Bijuteri Küpe
  bileklik: 60001611, // Kadın > Bileklik > Bijuteri Bileklik
  bilezik: 60001622, // Kadın > Bilezik > Bijuteri Bilezik
  bros: 60007599, // Kadın > Broş, Taç & Tarak > Bijuteri Broş, Taç & Tarak
  piercing: 60007596, // Kadın > Piercing > Bijuteri Piercing
  halhal: 16041428, // Kadın > Halhal
  erkekKolye: 60004718,
  erkekYuzuk: 60004717,
  erkekKupe: 60004719,
  erkekBileklik: 60004729,
} as const;

const YUZUK_CATEGORIES: number[] = [HB_CATEGORY.yuzuk, HB_CATEGORY.erkekYuzuk];

function lower(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

export function isMaleProduct(product: { category: string; name: string }): boolean {
  return lower(`${product.name} ${product.category}`).includes("erkek");
}

// Sitedeki ham kategori/ad -> Hepsiburada kategorisi. Karşılığı olmayan
// (Şahmeran, Antika/Vintage, Saat, Aksesuar) ürünler için null: sessizce
// yanlış kategoriye göndermek yerine çağıran atlar.
export function hepsiburadaCategoryFor(product: {
  category: string;
  name: string;
}): number | null {
  const category = lower(product.category);
  const name = lower(product.name);
  const male = isMaleProduct(product);
  if (category.includes("piercing")) return HB_CATEGORY.piercing;
  if (category.includes("broş")) return HB_CATEGORY.bros;
  if (category.includes("halhal") || category.includes("hal hal")) return HB_CATEGORY.halhal;
  if (category.includes("şahmeran") || category.includes("antika") || category.includes("vintage")) return null;
  if (category.includes("saat")) return null;
  const text = category.trim() === "takı" ? name : category;
  if (text.includes("yüzük")) return male ? HB_CATEGORY.erkekYuzuk : HB_CATEGORY.yuzuk;
  if (text.includes("kolye")) return male ? HB_CATEGORY.erkekKolye : HB_CATEGORY.kolye;
  if (text.includes("küpe")) return male ? HB_CATEGORY.erkekKupe : HB_CATEGORY.kupe;
  if (text.includes("bilezik")) return HB_CATEGORY.bilezik;
  if (text.includes("bileklik")) return male ? HB_CATEGORY.erkekBileklik : HB_CATEGORY.bileklik;
  return null;
}

export type HepsiburadaImportItem = {
  categoryId: number;
  merchant: string;
  attributes: Record<string, string>;
};

export function buildImportItem(input: {
  merchantId: string;
  categoryId: number;
  merchantSku: string;
  title: string;
  description: string;
  images: string[];
  male: boolean;
}): HepsiburadaImportItem {
  const attributes: Record<string, string> = {
    merchantSku: input.merchantSku,
    Barcode: input.merchantSku,
    UrunAdi: input.title,
    UrunAciklamasi: input.description,
    Marka: "Terragolds",
    tax_vat_rate: "20",
  };
  input.images.slice(0, 5).forEach((url, index) => {
    attributes[`Image${index + 1}`] = url;
  });
  if (YUZUK_CATEGORIES.includes(input.categoryId)) {
    attributes.cinsiyet = input.male ? "Erkek" : "Kadın";
  }
  return { categoryId: input.categoryId, merchant: input.merchantId, attributes };
}
