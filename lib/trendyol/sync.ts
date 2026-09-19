import { ensureTrendyolColumns, createProduct, updateStockAndPrice, type TrendyolProduct, type TrendyolProductAttribute } from "./client";
import { toAbsoluteImageUrl } from "../shopify/client";
import { groupForCategory } from "../category-groups";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  category: string;
  xmlExternalId: string | null;
};

// Trendyol her ürün için barkod zorunlu tutuyor - tedarikçi ürün kodumuz
// (xml_external_id) varsa onu kullanıyoruz, yoksa kendi id'mizden türetilmiş
// bir kod (yerel ürünler ve elle eklenenler için).
function barcodeFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// Site kategori grubu (lib/category-groups.ts slug'ı) -> Trendyol'un kendi
// kategori ağacındaki ID'si. Admin panelindeki "Kategori ara" ile bulundu;
// hepsi mümkün olduğunda "Çelik ..." (paslanmaz çelik/gold kaplama)
// alt kategorisi - Terragolds'un asıl sattığı ürün tipiyle eşleşiyor.
// "antika-vintage", "saat-kombin" ve "aksesuar" grupları için henüz uygun
// bir Trendyol kategorisi netleştirilmedi, o yüzden şimdilik Kolye'yle aynı
// varsayılana düşüyorlar - gerçek ID'ler bulununca burada güncellenmeli.
const TRENDYOL_CATEGORY_BY_GROUP_SLUG: Record<string, number> = {
  yuzuk: 2841, // Çelik Yüzük
  kolyeler: 2853, // Çelik Kolye
  kupeler: 2846, // Çelik Küpe
  bileklik: 2845, // Çelik Bileklik
  "sahmeran-halhal": 3500, // Bijuteri Halhal (çelik seçeneği yok)
};
const TRENDYOL_FALLBACK_CATEGORY_ID = 2853; // Çelik Kolye - eşleşmeyen/bilinmeyen gruplar için

// Trendyol markasız ürün kabul etmiyor - admin panelindeki "Marka ara" ile
// bulunan, tescilli marka bekletmeyen "Genel Markalar" kaydının ID'si.
const TRENDYOL_DEFAULT_BRAND_ID = 1041874;

// "Antika ~ Vintage" (grup: antika-vintage) karma bir kategori - içinde hem
// gerçek takı (burç yüzükleri, antik sikke kolye) hem de takı OLMAYAN ev
// dekorasyon/aksesuar ürünleri (biblo, heykel, tablo, tesbih) var. Bunları
// çelik takı kategorisine göndermek yanlış olur - admin panelindeki
// "Kategori ara" ile bulunan gerçek Trendyol kategorilerine, ürün adındaki
// anahtar kelimeye göre yönlendiriliyor. Eşleşmeyen (yüzük/kolye gibi
// gerçek takı isimli) ürünler normal akışa (Kolye varsayılanı) düşer.
const NON_JEWELRY_CATEGORY_KEYWORDS: { keywords: string[]; categoryId: number }[] = [
  { keywords: ["tesbih"], categoryId: 1823 }, // Aksesuar > Diğer Aksesuar > Tesbih
  { keywords: ["tablo", "pano"], categoryId: 842 }, // Ev & Mobilya > Ev Dekorasyon > Tablo
  { keywords: ["biblo", "heykel", "figür"], categoryId: 1877 }, // Ev Dekorasyon > Dekoratif Obje ve Biblo
];

// "Figür" gibi kelimeler gerçek takı ürünlerinde de sıfat olarak geçebiliyor
// (ör. "Figürlü Eskitme Yüzük Seti") - isimde ayrıca gerçek bir takı ismi
// varsa bu, dekor değil takı demektir, non-jewelry eşlemesi atlanır.
const JEWELRY_NAME_KEYWORDS = ["yüzük", "kolye", "küpe", "bileklik", "halhal"];

function nonJewelryCategoryIdFor(product: { category: string; name: string }): number | null {
  const group = groupForCategory(product.category);
  if (group?.slug !== "antika-vintage") return null;
  const name = product.name.toLocaleLowerCase("tr-TR");
  if (JEWELRY_NAME_KEYWORDS.some((keyword) => name.includes(keyword))) return null;
  const match = NON_JEWELRY_CATEGORY_KEYWORDS.find((entry) =>
    entry.keywords.some((keyword) => name.includes(keyword)),
  );
  return match?.categoryId ?? null;
}

function categoryIdFor(product: { category: string; name: string }): number {
  const nonJewelryCategoryId = nonJewelryCategoryIdFor(product);
  if (nonJewelryCategoryId) return nonJewelryCategoryId;
  const group = groupForCategory(product.category);
  return (group && TRENDYOL_CATEGORY_BY_GROUP_SLUG[group.slug]) || TRENDYOL_FALLBACK_CATEGORY_ID;
}

// Admin panelindeki "Kategori özellikleri" teşhis aracıyla (developers.trendyol.com
// "Kategori Özellik Listesi v2" + "Kategori Özellik Değerleri Listesi v2")
// her 5 kategori tek tek sorgulanarak bulundu - zorunlu attributeId'ler
// kategoriye göre değişiyor (ör. Küpe'de Beden yerine Model isteniyor), ama
// gönderdiğimiz attributeValueId'ler Trendyol'un global özellik değerleri
// olduğu için tüm kategorilerde aynı.
//
// Tüm 5 kategoride ortak zorunlu (Cinsiyet, Materyal, Menşei, Web Color) ve
// her yerde var olan opsiyonel (Taş Cinsi) alanlar - ürünlerimizde bu
// verileri ayrı ayrı takip etmediğimiz için sabit, jewelry'ye uygun bir
// varsayılan kullanılıyor.
const TRENDYOL_COMMON_ATTRIBUTES: TrendyolProductAttribute[] = [
  { attributeId: 343, attributeValueId: 4296 }, // Cinsiyet: Unisex
  { attributeId: 14, attributeValueId: 688 }, // Materyal: Paslanmaz Çelik
  { attributeId: 1192, attributeValueId: 10617344 }, // Menşei: TR
  { attributeId: 348, attributeValueId: 7000 }, // Web Color: Gümüş
  { attributeId: 260, attributeValueId: 1209593 }, // Taş Cinsi: Yok
  { attributeId: 47, customAttributeValue: "Gümüş" }, // Renk (allowCustom)
];

// Kategoriye özgü ek zorunlu alan - grup slug'ına göre (bkz.
// TRENDYOL_CATEGORY_BY_GROUP_SLUG). Kolye/Yüzük/Bileklik "Beden", Küpe
// "Model", Halhal "Yaş Grubu" istiyor; eşleşmeyen/bilinmeyen gruplar
// TRENDYOL_FALLBACK_CATEGORY_ID (Kolye) ile aynı "Beden" alanına düşer.
const TRENDYOL_EXTRA_ATTRIBUTE_BY_GROUP_SLUG: Record<string, TrendyolProductAttribute> = {
  yuzuk: { attributeId: 338, attributeValueId: 144271 }, // Beden: Standart
  kolyeler: { attributeId: 338, attributeValueId: 144271 }, // Beden: Standart
  bileklik: { attributeId: 338, attributeValueId: 144271 }, // Beden: Standart
  kupeler: { attributeId: 32, attributeValueId: 870 }, // Model: Standart
  "sahmeran-halhal": { attributeId: 346, attributeValueId: 4293 }, // Yaş Grubu: Yetişkin
};
const TRENDYOL_FALLBACK_EXTRA_ATTRIBUTE = TRENDYOL_EXTRA_ATTRIBUTE_BY_GROUP_SLUG.kolyeler;

function attributesFor(
  product: { category: string; name: string },
): TrendyolProductAttribute[] | undefined {
  // Biblo/tablo/tesbih çelik takı değil - Materyal: Paslanmaz Çelik gibi
  // takıya özgü varsayılanlar bu kategorilerde anlamsız/yanlış olur, o
  // yüzden bu ürünler için hiç attributes göndermiyoruz.
  if (nonJewelryCategoryIdFor(product)) return undefined;
  const group = groupForCategory(product.category);
  const extra =
    (group && TRENDYOL_EXTRA_ATTRIBUTE_BY_GROUP_SLUG[group.slug]) ||
    TRENDYOL_FALLBACK_EXTRA_ATTRIBUTE;
  return [...TRENDYOL_COMMON_ATTRIBUTES, extra];
}

function toTrendyolProduct(product: PendingProduct): TrendyolProduct {
  const imageUrl = toAbsoluteImageUrl(product.image);
  return {
    barcode: barcodeFor(product),
    title: product.name,
    productMainId: barcodeFor(product),
    brandId: TRENDYOL_DEFAULT_BRAND_ID,
    categoryId: categoryIdFor(product),
    quantity: product.stock,
    stockCode: barcodeFor(product),
    listPrice: product.price,
    salePrice: product.price,
    // Trendyol boş açıklamayı reddediyor ve tek gönderdiğimiz TÜM parti
    // (25 ürün) reddedilen tek bir satır yüzünden başarısız oluyor - D1'de
    // birkaç ürünün açıklaması boş, o yüzden ürün adına düşülüyor.
    description: product.description.trim() || product.name,
    images: imageUrl ? [{ url: imageUrl }] : [],
    vatRate: 20,
    attributes: attributesFor(product),
  };
}

export type TrendyolSyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToShopify (lib/shopify/sync.ts) ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
// Trendyol'un create endpoint'i tek çağrıda birden fazla ürün kabul ettiği
// için (Shopify'ın aksine, tek tek istemek yerine) tüm parti tek bir
// createProduct() çağrısıyla gönderiliyor - kısmi başarı/başarısızlık
// getBatchRequestResult() ile ayrıca sorgulanabilir (bkz. client.ts),
// bu ilk sürüm şimdilik tüm partiyi tek sonuç olarak işliyor.
export async function syncProductsToTrendyol(
  db: D1Database,
  batchSize = 25,
): Promise<TrendyolSyncResult> {
  await ensureTrendyolColumns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, stock, image, category,
              xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND trendyol_listing_id IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND trendyol_listing_id IS NULL",
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { created: 0, failed: 0, remaining: 0, errors: [] };
  }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  try {
    const trendyolProducts = pending.results.map(toTrendyolProduct);
    const { batchRequestId } = await createProduct(trendyolProducts);
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET trendyol_barcode = ?, trendyol_listing_id = ?,
           trendyol_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(barcodeFor(product), batchRequestId, product.id)
        .run();
      created += 1;
    }
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  return { created, failed, remaining: await remainingCount(), errors };
}

type StockPriceRow = {
  price: number;
  stock: number;
  trendyolBarcode: string | null;
};

// D1 kaynak (source of truth) - Shopify'daki pushInventoryToShopify/
// pushPriceToShopify ile aynı prensip, tek farkla: Trendyol stok ve fiyatı
// tek bir endpoint'te (updateStockAndPrice) birlikte istiyor, bu yüzden
// burada da tek fonksiyonda birleşik.
export async function pushStockAndPriceToTrendyol(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureTrendyolColumns(db);

  const product = await db
    .prepare(
      `SELECT price, stock, trendyol_barcode AS trendyolBarcode
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<StockPriceRow>();

  // Henüz Trendyol'a hiç gönderilmemiş (veya hiç gönderilmeyecek, örn. bir
  // taslak ürün) - gönderilecek bir şey yok. syncProductsToTrendyol() ilk
  // oluşturulduğunda zaten güncel stok/fiyatla gönderir.
  if (!product?.trendyolBarcode) return;

  await updateStockAndPrice([
    {
      barcode: product.trendyolBarcode,
      quantity: product.stock,
      salePrice: product.price,
      listPrice: product.price,
    },
  ]);

  await db
    .prepare("UPDATE products SET trendyol_price_synced = ? WHERE id = ?")
    .bind(product.price, productId)
    .run();
}

export type TrendyolPricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingShopifyPrices (lib/shopify/price.ts) ile aynı desen: bir
// tedarikçinin toplu yeniden fiyatlandırması gibi durumlarda satır satır
// değil, D1'de fiyatı değişmiş ama Trendyol'a henüz yansımamış ürünleri
// partiler hâlinde işler. `remaining` 0 olana kadar tekrar çağrılabilir.
export async function pushPendingTrendyolPrices(
  db: D1Database,
  batchSize = 25,
): Promise<TrendyolPricePushResult> {
  await ensureTrendyolColumns(db);

  const pending = await db
    .prepare(
      `SELECT id FROM products
       WHERE trendyol_barcode IS NOT NULL
         AND (trendyol_price_synced IS NULL OR trendyol_price_synced != price)
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE trendyol_barcode IS NOT NULL
           AND (trendyol_price_synced IS NULL OR trendyol_price_synced != price)`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const row of pending.results) {
    try {
      await pushStockAndPriceToTrendyol(db, row.id);
      pushed += 1;
    } catch (error) {
      failed += 1;
      errors.push(
        `#${row.id}: ${error instanceof Error ? error.message : "bilinmeyen hata"}`,
      );
    }
  }

  return { pushed, failed, remaining: await remainingCount(), errors };
}
