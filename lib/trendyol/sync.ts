import { ensureTrendyolColumns, createProduct, updateProduct, updateStockAndPrice, type TrendyolProduct, type TrendyolProductAttribute } from "./client";
import { toAbsoluteImageUrl } from "../shopify/client";
import { groupForCategory } from "../category-groups";

type PendingProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string;
  hoverImage: string | null;
  category: string;
  xmlExternalId: string | null;
};

// Trendyol her ürün için barkod zorunlu tutuyor - tedarikçi ürün kodumuz
// (xml_external_id) varsa onu kullanıyoruz, yoksa kendi id'mizden türetilmiş
// bir kod (yerel ürünler ve elle eklenenler için).
//
// Bu 12 ürün daha önce yanlış categoryId (Kolye) ile onaylanmıştı - Trendyol
// onaylı ürünlerde categoryId güncellemesini desteklemiyor
// (developers.trendyol.com "Ürün Güncelleme - Onaylı Ürün v2": "barcode,
// productMainId, brandId, categoryId ... güncellenemez"). Doğru kategoriyle
// YENİ bir ürün olarak oluşturulabilmeleri için farklı bir barkod
// kullanılıyor - eski (yanlış kategorili) TG-{id} kaydı Trendyol panelinden
// elle pasife alınmalı, otomatik silinmiyor.
const RECREATE_WITH_NEW_BARCODE_IDS = new Set([
  5015, 5016, 5017, 5022, 5023, 5025, 5026, 5027, 5028, 5029, 5033, 5514,
]);

function barcodeFor(product: { id: number; xmlExternalId: string | null }): string {
  const base = product.xmlExternalId || `TG-${product.id}`;
  return RECREATE_WITH_NEW_BARCODE_IDS.has(product.id) ? `${base}-v2` : base;
}

// Site kategori grubu (lib/category-groups.ts slug'ı) -> Trendyol'un kendi
// kategori ağacındaki ID'si. Admin panelindeki "Kategori ara" ile bulundu;
// hepsi mümkün olduğunda "Çelik ..." (paslanmaz çelik/gold kaplama)
// alt kategorisi - Terragolds'un asıl sattığı ürün tipiyle eşleşiyor.
// "antika-vintage", "saat-kombin" ve "aksesuar" grupları için henüz uygun
// bir Trendyol kategorisi netleştirilmedi, o yüzden şimdilik Kolye'yle aynı
// varsayılana düşüyorlar - gerçek ID'ler bulununca burada güncellenmeli.
//
// yuzuk için "Çelik Yüzük" (2841) YANLIŞTI: bu kategoride zorunlu+varyant
// belirleyici "Beden" özelliği sadece somut yüzük ölçüleri kabul ediyor,
// "Ayarlanabilir" gibi tek-beden bir değeri yok - ürünlerimizin neredeyse
// tamamı ("Pirinç ... Ayarlanabilir Yüzük") bu yüzden batch KABUL EDİLİP
// (batchRequestId dönüp) arka planda TEK TEK sessizce reddedildi (696/696,
// %100 başarısızlık - Trendyol satıcı panelindeki gerçek ürün sayısıyla
// karşılaştırılarak bulundu). "Bijuteri Yüzük" (1261) kategorisinde
// "Beden: Ayarlanabilir" (10620045) seçeneği var - doğru kategori bu.
const TRENDYOL_CATEGORY_BY_GROUP_SLUG: Record<string, number> = {
  yuzuk: 1261, // Bijuteri Yüzük
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
//
// Her kategorinin kendi zorunlu özellikleri var (admin panelindeki
// "Kategori özellikleri" teşhis aracıyla tek tek doğrulandı) - jewelry
// varsayılanlarından (Materyal: Paslanmaz Çelik vb.) tamamen farklı, bu
// yüzden ayrı bir attributes listesi taşıyorlar. "Çerçeve Tipi" (id 5),
// Biblo kategorisinde zorunlu görünüyor ama Trendyol'da hiç tanımlı
// değeri yok - gönderilemediği için atlandı.
type NonJewelryCategory = {
  keywords: string[];
  categoryId: number;
  attributes: TrendyolProductAttribute[];
};

const NON_JEWELRY_CATEGORIES: NonJewelryCategory[] = [
  {
    keywords: ["tesbih"],
    categoryId: 1823, // Aksesuar > Diğer Aksesuar > Tesbih
    attributes: [
      { attributeId: 348, attributeValueId: 7001 }, // Web Color: Kahverengi
      { attributeId: 260, attributeValueId: 1209593 }, // Taş Cinsi: Yok
      { attributeId: 1186, attributeValueId: 10559446 }, // Kutu Durumu: Kutu yok
      { attributeId: 1192, attributeValueId: 10617344 }, // Menşei: TR
      { attributeId: 47, customAttributeValue: "Kahverengi" }, // Renk (allowCustom)
      { attributeId: 14, attributeValueId: 1215244 }, // Materyal: Ağaç
    ],
  },
  {
    keywords: ["tablo", "pano"],
    categoryId: 842, // Ev & Mobilya > Ev Dekorasyon > Tablo
    attributes: [
      { attributeId: 348, attributeValueId: 7001 }, // Web Color: Kahverengi
      { attributeId: 14, attributeValueId: 1256806 }, // Materyal: Belirtilmemiş
      { attributeId: 47, customAttributeValue: "Kahverengi" }, // Renk (allowCustom)
      { attributeId: 1192, attributeValueId: 10617344 }, // Menşei: TR
      { attributeId: 18, attributeValueId: 1256822 }, // Parça Sayısı: Belirtilmemiş
      { attributeId: 20, attributeValueId: 1256823 }, // Tema/Stil: Belirtilmemiş
    ],
  },
  {
    keywords: ["biblo", "heykel", "figür"],
    categoryId: 1877, // Ev & Mobilya > Ev Dekorasyon > Dekoratif Obje ve Biblo
    attributes: [
      { attributeId: 47, customAttributeValue: "Kahverengi" }, // Renk (allowCustom)
      { attributeId: 348, attributeValueId: 7001 }, // Web Color: Kahverengi
      { attributeId: 92, attributeValueId: 142196 }, // Boyut/Ebat: Tek Ebat
      { attributeId: 14, attributeValueId: 1256806 }, // Materyal: Belirtilmemiş
      { attributeId: 20, attributeValueId: 1256823 }, // Tema/Stil: Belirtilmemiş
      { attributeId: 1192, attributeValueId: 10617344 }, // Menşei: TR
      { attributeId: 18, attributeValueId: 1256822 }, // Parça Sayısı: Belirtilmemiş
    ],
  },
];

// "Figür" gibi kelimeler gerçek takı ürünlerinde de sıfat olarak geçebiliyor
// (ör. "Figürlü Eskitme Yüzük Seti") - isimde ayrıca gerçek bir takı ismi
// varsa bu, dekor değil takı demektir, non-jewelry eşlemesi atlanır.
const JEWELRY_NAME_KEYWORDS = ["yüzük", "kolye", "küpe", "bileklik", "halhal"];

function nonJewelryCategoryFor(
  product: { category: string; name: string },
): NonJewelryCategory | null {
  const group = groupForCategory(product.category);
  if (group?.slug !== "antika-vintage") return null;
  const name = product.name.toLocaleLowerCase("tr-TR");
  if (JEWELRY_NAME_KEYWORDS.some((keyword) => name.includes(keyword))) return null;
  return (
    NON_JEWELRY_CATEGORIES.find((entry) =>
      entry.keywords.some((keyword) => name.includes(keyword)),
    ) ?? null
  );
}

export function categoryIdFor(product: { category: string; name: string }): number {
  const nonJewelry = nonJewelryCategoryFor(product);
  if (nonJewelry) return nonJewelry.categoryId;
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

// Kategoriye özgü ek zorunlu alan(lar) - grup slug'ına göre (bkz.
// TRENDYOL_CATEGORY_BY_GROUP_SLUG). Kolye/Bileklik "Beden", Küpe "Model",
// Halhal "Yaş Grubu" istiyor; eşleşmeyen/bilinmeyen gruplar
// TRENDYOL_FALLBACK_CATEGORY_ID (Kolye) ile aynı "Beden" alanına düşer.
// Yüzük ("Bijuteri Yüzük" 1261) hem "Beden" (Ayarlanabilir) HEM "Yaş
// Grubu" (Yetişkin) istiyor - diğer 4 kategoride bu ikinci alan zorunlu
// değil (100% başarıyla kanıtlandı), o yüzden liste kategoriye göre
// değişen uzunlukta.
const TRENDYOL_EXTRA_ATTRIBUTES_BY_GROUP_SLUG: Record<string, TrendyolProductAttribute[]> = {
  yuzuk: [
    { attributeId: 338, attributeValueId: 10620045 }, // Beden: Ayarlanabilir
    { attributeId: 346, attributeValueId: 4293 }, // Yaş Grubu: Yetişkin
  ],
  kolyeler: [{ attributeId: 338, attributeValueId: 144271 }], // Beden: Standart
  bileklik: [{ attributeId: 338, attributeValueId: 144271 }], // Beden: Standart
  kupeler: [{ attributeId: 32, attributeValueId: 870 }], // Model: Standart
  "sahmeran-halhal": [{ attributeId: 346, attributeValueId: 4293 }], // Yaş Grubu: Yetişkin
};
const TRENDYOL_FALLBACK_EXTRA_ATTRIBUTES = TRENDYOL_EXTRA_ATTRIBUTES_BY_GROUP_SLUG.kolyeler;

function attributesFor(
  product: { category: string; name: string },
): TrendyolProductAttribute[] {
  // Biblo/tablo/tesbih çelik takı değil - Materyal: Paslanmaz Çelik gibi
  // takıya özgü varsayılanlar bu kategorilerde anlamsız/yanlış olur, kendi
  // (NON_JEWELRY_CATEGORIES'teki) özellik listeleri kullanılıyor.
  const nonJewelry = nonJewelryCategoryFor(product);
  if (nonJewelry) return nonJewelry.attributes;
  const group = groupForCategory(product.category);
  const extra =
    (group && TRENDYOL_EXTRA_ATTRIBUTES_BY_GROUP_SLUG[group.slug]) ||
    TRENDYOL_FALLBACK_EXTRA_ATTRIBUTES;
  return [...TRENDYOL_COMMON_ATTRIBUTES, ...extra];
}

// Trendyol v2'de en fazla 8 görsel kabul ediyor, ilki kapak fotoğrafı olarak
// kullanılıyor - sitemizdeki ana görsel (image) + hover görseli (hoverImage,
// üzerine gelince/karşılaştırmada görünen ikinci fotoğraf) sırasıyla
// gönderiliyor. Daha önce sadece image gönderiliyordu, Trendyol'da tek
// fotoğraf görünmesinin sebebi buydu.
function toTrendyolProduct(product: PendingProduct): TrendyolProduct {
  const imageUrls = [product.image, product.hoverImage]
    .map((url) => (url ? toAbsoluteImageUrl(url) : null))
    .filter((url): url is string => Boolean(url));
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
    images: imageUrls.map((url) => ({ url })),
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
      `SELECT id, name, description, price, stock, image, hover_image AS hoverImage, category,
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

// Bir ürün Trendyol'a yanlış categoryId ile gönderildiğinde (ör. Antika ~
// Vintage'daki biblo/tablo/tesbih ürünleri önce Kolye kategorisine
// gitmişti), aynı barkodla tekrar createProduct() çağırmak Trendyol'un
// "Aynı barkodlu bir ürününüz bulunduğundan yeni ürün oluşturulamaz"
// hatasına düşüyor - barkod zaten var olan bir ürünü PUT (updateProduct)
// ile güncellemek gerekiyor. Bu, belirli bir ürün ID listesini zorla
// yeniden gönderen tek seferlik bir düzeltme aracı.
export async function updateProductsCategoryOnTrendyol(
  db: D1Database,
  productIds: number[],
): Promise<{ batchRequestId: string }> {
  await ensureTrendyolColumns(db);
  if (productIds.length === 0) throw new Error("Ürün ID listesi boş.");

  const placeholders = productIds.map(() => "?").join(",");
  const products = await db
    .prepare(
      `SELECT id, name, description, price, stock, image, hover_image AS hoverImage, category,
              xml_external_id AS xmlExternalId
       FROM products WHERE id IN (${placeholders})`,
    )
    .bind(...productIds)
    .all<PendingProduct>();

  const trendyolProducts = products.results.map(toTrendyolProduct);
  const { batchRequestId } = await updateProduct(trendyolProducts);
  for (const product of products.results) {
    await db
      .prepare(
        `UPDATE products SET trendyol_barcode = ?, trendyol_listing_id = ?,
         trendyol_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(barcodeFor(product), batchRequestId, product.id)
      .run();
  }
  return { batchRequestId };
}

type StockPriceRow = {
  price: number;
  stock: number;
  trendyolBarcode: string | null;
  trendyolOverridePrice: number | null;
};

// D1 kaynak (source of truth) - Shopify'daki pushInventoryToShopify/
// pushPriceToShopify ile aynı prensip, tek farkla: Trendyol stok ve fiyatı
// tek bir endpoint'te (updateStockAndPrice) birlikte istiyor, bu yüzden
// burada da tek fonksiyonda birleşik.
//
// trendyol_override_price VARSA o kullanılır, products.price (site fiyatı)
// DEĞİL - lib/trendyol/pricing.ts'in hesapladığı maliyet+kâr hedefli fiyatı
// bu fonksiyon eskiden yok sayıp doğrudan site fiyatını gönderiyordu; bu da
// her stok senkronunda (restockSupplierProducts, 6 saatte bir cron)
// dinamik fiyatlamayı sessizce site fiyatına geri döndürüyordu (1934 ürün
// etkilendi, kullanıcı Trendyol panelinde fark etti).
export async function pushStockAndPriceToTrendyol(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureTrendyolColumns(db);

  const product = await db
    .prepare(
      `SELECT price, stock, trendyol_barcode AS trendyolBarcode,
              trendyol_override_price AS trendyolOverridePrice
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<StockPriceRow>();

  // Henüz Trendyol'a hiç gönderilmemiş (veya hiç gönderilmeyecek, örn. bir
  // taslak ürün) - gönderilecek bir şey yok. syncProductsToTrendyol() ilk
  // oluşturulduğunda zaten güncel stok/fiyatla gönderir.
  if (!product?.trendyolBarcode) return;

  const salePrice = product.trendyolOverridePrice ?? product.price;

  await updateStockAndPrice([
    {
      barcode: product.trendyolBarcode,
      quantity: product.stock,
      salePrice,
      listPrice: salePrice,
    },
  ]);

  await db
    .prepare("UPDATE products SET trendyol_price_synced = ? WHERE id = ?")
    .bind(salePrice, productId)
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
//
// Ürün başına ayrı ayrı pushStockAndPriceToTrendyol() çağıran ilk sürüm
// (binlerce sıralı Trendyol API isteği) isteği zaman aşımına uğrattı -
// restockSupplierProducts'ta yaşanan aynı sorun. Artık updateStockAndPrice'a
// tek seferde (max 1000) toplu gönderiliyor.
export async function pushPendingTrendyolPrices(
  db: D1Database,
  batchSize = 1000,
): Promise<TrendyolPricePushResult> {
  await ensureTrendyolColumns(db);

  // Hedef fiyat trendyol_override_price varsa odur, yoksa products.price -
  // pushStockAndPriceToTrendyol'un gerçekte gönderdiğiyle aynı öncelik
  // (yoksa override'lı ürünler trendyol_price_synced hep "farklı" görünüp
  // sonsuza kadar "pending" sayılırdı).
  const pending = await db
    .prepare(
      `SELECT id, stock, trendyol_barcode AS trendyolBarcode,
              COALESCE(trendyol_override_price, price) AS salePrice
       FROM products
       WHERE trendyol_barcode IS NOT NULL
         AND (trendyol_price_synced IS NULL OR trendyol_price_synced != COALESCE(trendyol_override_price, price))
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number; stock: number; trendyolBarcode: string; salePrice: number }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE trendyol_barcode IS NOT NULL
           AND (trendyol_price_synced IS NULL OR trendyol_price_synced != COALESCE(trendyol_override_price, price))`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { pushed: 0, failed: 0, remaining: 0, errors: [] };
  }

  try {
    await updateStockAndPrice(
      pending.results.map((row) => ({
        barcode: row.trendyolBarcode,
        quantity: row.stock,
        salePrice: row.salePrice,
        listPrice: row.salePrice,
      })),
    );
  } catch (error) {
    return {
      pushed: 0,
      failed: pending.results.length,
      remaining: await remainingCount(),
      errors: [error instanceof Error ? error.message : "bilinmeyen hata"],
    };
  }

  const updateStmt = db.prepare("UPDATE products SET trendyol_price_synced = ? WHERE id = ?");
  await db.batch(pending.results.map((row) => updateStmt.bind(row.salePrice, row.id)));

  return { pushed: pending.results.length, failed: 0, remaining: await remainingCount(), errors: [] };
}

// --- Tek seferlik fiyat artışı: 0-200 TL arası ürünlere %20 zam ---
//
// D1'deki price kolonu tek gerçek kaynak - Trendyol'un kendi ürün listeleme
// (filterProducts) servisinden "mevcut fiyatı" çekmek yerine doğrudan D1
// filtreleniyor (bu servis ayrıca şu an 426 brownout hatası veriyor, bkz.
// /api/admin/trendyol/missing-products teşhisi). updateStockAndPrice zaten
// var olan batch (max 1000 item) + rate-limit + kimlik doğrulama altyapısını
// kullanıyor, tekrar yazılmadı.
//
// Aynı ürüne yanlışlıkla iki kez zam uygulanmasını (ör. script iki kez
// tetiklenirse 50 -> 60 -> 72 gibi) önlemek için işlenen her ürün
// trendyol_price_increase_log tablosuna kalıcı olarak yazılıyor - bir sonraki
// çalıştırma bu tabloda olan ID'leri otomatik atlıyor, script güvenle tekrar
// çalıştırılabilir (ör. bir parti başarısız olduğunda kalanları tamamlamak
// için).
async function ensurePriceIncreaseLogTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS trendyol_price_increase_log (
        product_id INTEGER PRIMARY KEY,
        old_price INTEGER NOT NULL,
        new_price INTEGER NOT NULL,
        batch_request_id TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

type PriceIncreaseCandidate = {
  id: number;
  name: string;
  price: number;
  stock: number;
  trendyolBarcode: string;
};

const PRICE_INCREASE_MULTIPLIER = 1.2;
const PRICE_INCREASE_MAX_PRICE = 200;
const PRICE_INCREASE_BATCH_SIZE = 1000; // Trendyol updatePriceAndInventory limiti

async function priceIncreaseCandidates(db: D1Database): Promise<PriceIncreaseCandidate[]> {
  await ensureTrendyolColumns(db);
  await ensurePriceIncreaseLogTable(db);
  const result = await db
    .prepare(
      `SELECT id, name, price, stock, trendyol_barcode AS trendyolBarcode
       FROM products
       WHERE status = 'published'
         AND trendyol_barcode IS NOT NULL
         AND price > 0 AND price <= ?
         AND id NOT IN (SELECT product_id FROM trendyol_price_increase_log)
       ORDER BY id`,
    )
    .bind(PRICE_INCREASE_MAX_PRICE)
    .all<PriceIncreaseCandidate>();
  return result.results;
}

export type PriceIncreasePreview = {
  candidateCount: number;
  alreadyProcessedCount: number;
  sample: { id: number; name: string; oldPrice: number; newPrice: number }[];
};

// Hiçbir şeyi değiştirmeden - kaç ürünün etkileneceğini ve örnek eski/yeni
// fiyatları göstermek için. Uygulamadan önce admin panelinden kontrol amaçlı.
export async function previewTrendyolPriceIncrease(db: D1Database): Promise<PriceIncreasePreview> {
  await ensurePriceIncreaseLogTable(db);
  const candidates = await priceIncreaseCandidates(db);
  const alreadyProcessed = await db
    .prepare("SELECT COUNT(*) AS c FROM trendyol_price_increase_log")
    .first<{ c: number }>();
  return {
    candidateCount: candidates.length,
    alreadyProcessedCount: alreadyProcessed?.c ?? 0,
    sample: candidates.slice(0, 20).map((product) => ({
      id: product.id,
      name: product.name,
      oldPrice: product.price,
      newPrice: Math.round(product.price * PRICE_INCREASE_MULTIPLIER),
    })),
  };
}

export type PriceIncreaseBatchLog = {
  batchRequestId: string;
  itemCount: number;
};

export type PriceIncreaseResult = {
  totalCandidates: number;
  increased: number;
  batches: PriceIncreaseBatchLog[];
  stoppedEarly: boolean;
  error: string | null;
};

// Gerçek uygulama: D1'i günceller, Trendyol'a gönderir, her ürünü log
// tablosuna yazar. Bir parti başarısız olursa işlem orada durur (henüz
// loglanmamış ürünler bir sonraki çalıştırmada otomatik tekrar denenir) -
// zaten başarıyla işlenmiş partiler geri alınmaz.
export async function applyTrendyolPriceIncrease(db: D1Database): Promise<PriceIncreaseResult> {
  const candidates = await priceIncreaseCandidates(db);
  const batches: PriceIncreaseBatchLog[] = [];
  let increased = 0;

  for (let offset = 0; offset < candidates.length; offset += PRICE_INCREASE_BATCH_SIZE) {
    const chunk = candidates.slice(offset, offset + PRICE_INCREASE_BATCH_SIZE);
    const pricedChunk = chunk.map((product) => ({
      product,
      newPrice: Math.round(product.price * PRICE_INCREASE_MULTIPLIER),
    }));

    let batchRequestId: string;
    try {
      const result = await updateStockAndPrice(
        pricedChunk.map(({ product, newPrice }) => ({
          barcode: product.trendyolBarcode,
          quantity: product.stock,
          salePrice: newPrice,
          listPrice: newPrice,
        })),
      );
      batchRequestId = result.batchRequestId;
    } catch (error) {
      return {
        totalCandidates: candidates.length,
        increased,
        batches,
        stoppedEarly: true,
        error: error instanceof Error ? error.message : "bilinmeyen hata",
      };
    }

    // Ürün başına 2 ayrı await'li tekil sorgu yerine (1000 ürün = 2000
    // sıralı D1 round-trip - istek zaman aşımına uğradı) db.batch() ile TEK
    // round-trip'te tüm UPDATE+INSERT'ler gönderiliyor.
    const updateStmt = db.prepare(
      `UPDATE products SET price = ?, trendyol_price_synced = ? WHERE id = ?`,
    );
    const insertStmt = db.prepare(
      `INSERT INTO trendyol_price_increase_log (product_id, old_price, new_price, batch_request_id)
       VALUES (?, ?, ?, ?)`,
    );
    const statements = pricedChunk.flatMap(({ product, newPrice }) => [
      updateStmt.bind(newPrice, newPrice, product.id),
      insertStmt.bind(product.id, product.price, newPrice, batchRequestId),
    ]);
    await db.batch(statements);

    batches.push({ batchRequestId, itemCount: chunk.length });
    increased += chunk.length;
  }

  return { totalCandidates: candidates.length, increased, batches, stoppedEarly: false, error: null };
}
