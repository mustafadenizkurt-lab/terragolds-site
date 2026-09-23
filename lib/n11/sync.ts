import {
  ensureN11Columns,
  createProduct,
  updateStockAndPrice,
  type N11Product,
  type N11ProductAttribute,
} from "./client";
import { getN11Credentials, type N11Credentials } from "./auth";
import { roundToN11Price } from "./http-utils";
import { attributesForCategory, steelCategoryId } from "./attributes";
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

// Trendyol'daki barcodeFor() ile aynı mantık: tedarikçi ürün kodumuz
// (xml_external_id) varsa onu, yoksa kendi id'mizden türetilmiş bir kod
// kullanıyoruz - N11 tarafında stockCode (ve varsa productMainId) olarak
// gönderiliyor.
function stockCodeFor(product: { id: number; xmlExternalId: string | null }): string {
  return product.xmlExternalId || `TG-${product.id}`;
}

// Trendyol'daki TRENDYOL_CATEGORY_BY_GROUP_SLUG ile aynı amaç. Admin
// panelindeki "Kategori ara" aracıyla (appKey/appSecret girildikten sonra)
// bulunan gerçek N11 kategori ID'leri buraya ekleniyor - kademeli olarak,
// bir grup için ID bulununca hemen eklenir. Henüz eklenmemiş bir grup için
// categoryIdFor() bilinçli olarak hata fırlatmaya devam ediyor - sahte/
// tahmini bir ID ile ürün göndermek yanlış kategoride onaysız/reddedilen
// ürünlere yol açabilir (Trendyol'da tam bu yüzden %100 başarısız bir batch
// yaşanmıştı, bkz. sync.ts'teki "Çelik Yüzük" notu).
//
// Her grupta aynı desen: N11'de "Bijuteri ..." kategorisi doğru olan -
// "Altın ...", "Gümüş ..." ve "Pırlanta ..." benzer isimli ama gerçek
// kıymetli maden/taş kategorileri YANLIŞ (N11 kategori aramasında ilk
// bakışta karıştırılabilir), Terragolds çelik/pirinç kaplama taklit takı
// satıyor.
const N11_CATEGORY_BY_GROUP_SLUG: Record<string, number> = {
  bileklik: 1219214, // Bijuteri Bileklik
  kolyeler: 1219212, // Bijuteri Kolye
  yuzuk: 1219213, // Bijuteri Yüzük
  kupeler: 1219216, // Bijuteri Küpe
  // "antika-vintage" grubundaki ürünler GERÇEKTEN ikinci el antika/koleksiyon
  // parçaları (biblo, heykel, tablo, vazo, mumluk, antika porselen/bira
  // bardağı VE antika yüzük/kolye gibi karışık ürün tipleri) - N11'de
  // bunların hepsini kapsayan tek şemsiye kategori "2.El Antika & Koleksiyon"
  // (üst seviye; alt kategorileri "2.El Antika Aksesuar" ve "2.El Antika Ev
  // Dekorasyon" sadece yarısını kapsıyor, o yüzden üst seviye seçildi).
  "antika-vintage": 1003526, // 2.El Antika & Koleksiyon
};

// "sahmeran-halhal" grubu sitede tek nav grubu ama N11'de bunun karşılığı
// TEK bir kategori değil - Şahmeran ve Halhal N11'de tamamen ayrı iki
// kategori (üstelik burada diğer gruplardaki gibi bir "Bijuteri" ayrımı da
// yok, direkt tek kategoriler). Bu yüzden bu grup için N11_CATEGORY_BY_GROUP_SLUG
// yeterli değil - ürünün gerçek (ham) kategori adına bakıp ikisini ayırt
// etmek gerekiyor.
const N11_SAHMERAN_HALHAL_CATEGORY_BY_KEYWORD: { keyword: string; categoryId: number }[] = [
  { keyword: "halhal", categoryId: 1191218 }, // Halhal
  // D1'deki gerçek kategori adı boşluklu "Hal Hal" olabiliyor (bkz.
  // category-groups.ts > sahmeran-halhal grubunun "hal hal" keyword'ü) -
  // bu varyant eksikti, tek bir "Hal Hal" ürünü tüm batch'i (100 ürün)
  // reddettiriyordu (categoryIdFor() attığı hata pending.results.map()'i
  // baştan patlatıyor).
  { keyword: "hal hal", categoryId: 1191218 }, // Halhal (boşluklu yazım)
  { keyword: "şahmeran", categoryId: 1191217 }, // Şahmeran
];

// "Broş" ve "Piercing" sitenin nav grupları arasında hiç yok (category-groups.ts
// > categoryGroups içinde karşılığı yok) - bu yüzden groupForCategory() bunlar
// için hep undefined dönüyor ve categoryIdFor() hata fırlatıp tüm batch'i
// durduruyordu. Nav grubu eklemek yerine (sitenin müşteri tarafı navigasyonunu
// etkiler) sadece N11 tarafında ham kategori adına bakan doğrudan bir eşleme.
const N11_DIRECT_CATEGORY_BY_KEYWORD: { keyword: string; categoryId: number }[] = [
  { keyword: "broş", categoryId: 1191220 }, // Broş (2.El Broş, İğne, Rozet DEĞİL - o ikinci el)
  { keyword: "piercing", categoryId: 1191216 }, // Piercing & Hızma
];

export function categoryIdFor(product: { category: string; name: string }): number {
  const directHaystack = product.category.toLocaleLowerCase("tr-TR");
  const directMatch = N11_DIRECT_CATEGORY_BY_KEYWORD.find((entry) =>
    directHaystack.includes(entry.keyword),
  );
  if (directMatch) return directMatch.categoryId;

  // "Takı" (jenerik "takı" anlamında) bazı ürünlerde category alanına yanlış
  // girilmiş - gerçek isimlerine bakınca hepsi kolye/küpe/bilezik/yüzük.
  // groupForCategory() bu jenerik değerle hiçbir gruba eşleşmediği için ürün
  // adına düşüp oradan doğru grubu buluyoruz.
  const categoryForGrouping =
    product.category.trim().toLocaleLowerCase("tr-TR") === "takı"
      ? product.name
      : product.category;
  const group = groupForCategory(categoryForGrouping);

  if (group?.slug === "sahmeran-halhal") {
    const haystack = product.category.toLocaleLowerCase("tr-TR");
    const match = N11_SAHMERAN_HALHAL_CATEGORY_BY_KEYWORD.find((entry) =>
      haystack.includes(entry.keyword),
    );
    if (match) return match.categoryId;
    throw new Error(
      `N11 kategori eşlemesi belirsiz: "${product.category}" ne "halhal" ne "şahmeran" içeriyor.`,
    );
  }

  const steelId = steelCategoryId(group?.slug, product.name);
  if (steelId) return steelId;

  const categoryId = group && N11_CATEGORY_BY_GROUP_SLUG[group.slug];
  if (!categoryId) {
    throw new Error(
      `N11 kategori eşlemesi henüz yapılandırılmamış (grup: ${group?.slug ?? product.category}). ` +
        "Önce N11 senkronu sekmesindeki \"Kategori ara\" aracıyla doğru kategori ID'sini bulup " +
        "lib/n11/sync.ts > N11_CATEGORY_BY_GROUP_SLUG içine ekleyin.",
    );
  }
  return categoryId;
}

// Zorunlu özellikler kategoriye özgü (Cinsiyet değer ID'leri bile kategoriden
// kategoriye değişiyor) - kurallar ve gerekçe lib/n11/attributes.ts'te.
function attributesFor(
  categoryId: number,
  product: { category: string; name: string; description?: string },
): N11ProductAttribute[] {
  return attributesForCategory(categoryId, product);
}

// N11 en fazla kaç görsel kabul ediyor net değil - Trendyol'daki gibi ana
// görsel (image) + hover görseli (hoverImage) sırasıyla, N11'in resmi
// şemasındaki order alanıyla (1, 2, ...) gönderiliyor.
function toN11Product(
  product: PendingProduct,
  settings: Pick<N11Credentials, "shipmentTemplate" | "preparingDay">,
): N11Product {
  const imageUrls = [product.image, product.hoverImage]
    .map((url) => (url ? toAbsoluteImageUrl(url) : null))
    .filter((url): url is string => Boolean(url));
  const stockCode = stockCodeFor(product);
  const price = roundToN11Price(product.price);
  const categoryId = categoryIdFor(product);
  return {
    categoryId,
    productMainId: stockCode,
    stockCode,
    // Gerçek bir GTIN'imiz yok (stockCode barkod değil) ama dokümanın her
    // örneğinde alan açıkça null gönderiliyor - bkz. client.ts > N11Product
    // tipi yorumu.
    barcode: null,
    catalogId: null,
    // N11'in resmi hata tablosu bunu doğruluyor: "ürün başlık alanı n11
    // kataloğu ile eşleşiyor olabilir, bu durumda ürün başlığını
    // farklılaştırmak için sonuna kod ekleyebilirsiniz." Bizim tedarikçi
    // feed'inde birçok FARKLI ürün (farklı görsel/tasarım) aynı jenerik
    // başlığı paylaşıyor (ör. "Pirinç Gümüş Renk Zirkon Taşlı Kadın Küpe")
    // - Renk/Cinsiyet gibi zorunlu özellikler de aynı kalınca N11 bunları
    // "aynı attributes kullanılmış" (mükerrer) diye reddediyordu. stockCode
    // eklemek başlığı tekilleştirip hem bu mükerrer reddi hem de N11'in
    // genel kataloğuyla yanlış eşleşme ("ürün grubuyla uyumlu değil",
    // "Marka Eşleşmesi") ihtimalini azaltıyor.
    title: `${product.name} - ${stockCode}`,
    // N11 muhtemelen boş açıklamayı reddediyor (Trendyol'da doğrulanmış bir
    // davranış) - D1'de birkaç ürünün açıklaması boş olabileceği için aynı
    // önlem: ürün adına düşülüyor.
    description: product.description.trim() || product.name,
    quantity: product.stock,
    salePrice: price,
    listPrice: price,
    vatRate: 20,
    currencyType: "TL",
    preparingDay: settings.preparingDay,
    shipmentTemplate: settings.shipmentTemplate,
    // Dokümanın her örneğinde gönderiliyor (opsiyonel olsa da) - alıcı
    // başına makul bir üst sınır, işimize dair bir kısıtlama değil.
    maxPurchaseQuantity: 20,
    images: imageUrls.map((url, index) => ({ url, order: index + 1 })),
    attributes: attributesFor(categoryId, product),
  };
}

export type N11SyncResult = {
  created: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// syncProductsToTrendyol/syncProductsToHepsiburada ile aynı desen: yayındaki,
// henüz gönderilmemiş ürünleri bir seferde batchSize kadar gönderir.
// categoryIdFor() eşleme tablosu boşken her ürün için hata fırlatacağı için
// bu fonksiyon kategori eşlemesi doldurulana kadar sadece hata biriktirir -
// bilinçli olarak böyle, yanlış kategoriyle ürün göndermek yerine.
export async function syncProductsToN11(
  db: D1Database,
  batchSize = 25,
): Promise<N11SyncResult> {
  await ensureN11Columns(db);

  const pending = await db
    .prepare(
      `SELECT id, name, description, price, stock, image, hover_image AS hoverImage, category,
              xml_external_id AS xmlExternalId
       FROM products
       WHERE status = 'published' AND n11_task_id IS NULL AND n11_last_error IS NULL
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<PendingProduct>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS c FROM products WHERE status = 'published' AND n11_task_id IS NULL AND n11_last_error IS NULL",
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
    const credentials = await getN11Credentials();
    const n11Products = pending.results.map((product) => toN11Product(product, credentials));
    const task = await createProduct(n11Products, credentials.integrator);
    // N11 taskId'yi JSON sayısı olarak döndürüyor; string'e çevrilmezse D1'e
    // REAL olarak bağlanıp "3344070382.0" şeklinde kaydediliyordu.
    const taskId = String(task.id ?? "");
    for (const product of pending.results) {
      await db
        .prepare(
          `UPDATE products SET n11_stock_code = ?, n11_task_id = ?,
           n11_synced_at = CURRENT_TIMESTAMP WHERE id = ?`,
        )
        .bind(stockCodeFor(product), taskId, product.id)
        .run();
      created += 1;
    }
  } catch (error) {
    failed = pending.results.length;
    errors.push(error instanceof Error ? error.message : "bilinmeyen hata");
  }

  return { created, failed, remaining: await remainingCount(), errors };
}

// D1 kaynak (source of truth) - Trendyol'daki pushStockAndPriceToTrendyol
// ile aynı prensip (override fiyat kavramı N11 için henüz eklenmedi,
// doğrudan site fiyatı gönderiliyor).
export async function pushStockAndPriceToN11(
  db: D1Database,
  productId: number,
): Promise<void> {
  await ensureN11Columns(db);

  const product = await db
    .prepare(
      `SELECT price, stock, n11_stock_code AS n11StockCode
       FROM products WHERE id = ?`,
    )
    .bind(productId)
    .first<{ price: number; stock: number; n11StockCode: string | null }>();

  if (!product?.n11StockCode) return;

  const credentials = await getN11Credentials();
  const price = roundToN11Price(product.price);
  await updateStockAndPrice(
    [
      {
        stockCode: product.n11StockCode,
        quantity: product.stock,
        salePrice: price,
        listPrice: price,
        currencyType: "TL",
      },
    ],
    credentials.integrator,
  );

  await db
    .prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?")
    .bind(product.price, productId)
    .run();
}

export type N11PricePushResult = {
  pushed: number;
  failed: number;
  remaining: number;
  errors: string[];
};

// pushPendingTrendyolPrices/pushPendingHepsiburadaPrices ile aynı desen:
// D1'de fiyatı/stoku değişmiş ama N11'e henüz yansımamış ürünleri partiler
// hâlinde işler.
export async function pushPendingN11Prices(
  db: D1Database,
  batchSize = 1000,
): Promise<N11PricePushResult> {
  await ensureN11Columns(db);

  const pending = await db
    .prepare(
      `SELECT id, stock, price, n11_stock_code AS n11StockCode
       FROM products
       WHERE n11_stock_code IS NOT NULL
         AND (n11_price_synced IS NULL OR n11_price_synced != price)
       ORDER BY id LIMIT ?`,
    )
    .bind(batchSize)
    .all<{ id: number; stock: number; price: number; n11StockCode: string }>();

  const remainingCount = async () => {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM products
         WHERE n11_stock_code IS NOT NULL
           AND (n11_price_synced IS NULL OR n11_price_synced != price)`,
      )
      .first<{ c: number }>();
    return row?.c ?? 0;
  };

  if (pending.results.length === 0) {
    return { pushed: 0, failed: 0, remaining: 0, errors: [] };
  }

  try {
    const credentials = await getN11Credentials();
    await updateStockAndPrice(
      pending.results.map((row) => {
        const price = roundToN11Price(row.price);
        return {
          stockCode: row.n11StockCode,
          quantity: row.stock,
          salePrice: price,
          listPrice: price,
          currencyType: "TL",
        };
      }),
      credentials.integrator,
    );
  } catch (error) {
    return {
      pushed: 0,
      failed: pending.results.length,
      remaining: await remainingCount(),
      errors: [error instanceof Error ? error.message : "bilinmeyen hata"],
    };
  }

  const updateStmt = db.prepare("UPDATE products SET n11_price_synced = ? WHERE id = ?");
  await db.batch(pending.results.map((row) => updateStmt.bind(row.price, row.id)));

  return { pushed: pending.results.length, failed: 0, remaining: await remainingCount(), errors: [] };
}
