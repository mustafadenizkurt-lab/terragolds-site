import { getN11Credentials, buildN11Headers } from "./auth";

// N11'in resmi geliştirici portalı (developer.n11.com) bot korumalı olduğu
// için doğrudan WebFetch ile erişilemedi - ama kullanıcının N11'den indirdiği
// resmi entegrasyon dokümanından (PDF/DOCX) gerçek uç nokta yolları, gövde
// şemaları ve alan adları elle aktarıldı (product-create/update/price-stock
// gövdesi {payload:{integrator, skus:[...]}}, sipariş güncellemede sadece
// "Picking" durumu, tarihler ms epoch vb.). Yine de örnek YANITLARIN tam
// zarfı (task-details/product-query envelope'u, sipariş paketinin id alan
// adı) dokümanda örneklenmedi - bu belirsiz noktalar ham (raw) fonksiyonlar
// veya esnek/opsiyonel tipler ile işaretlendi, ilk gerçek istekte netleşince
// güncellenmeli.
const N11_API_BASE = "https://api.n11.com";

type N11ErrorPayload = {
  message?: string;
  errorMessage?: string;
  errors?: { message?: string; code?: string }[];
};

// N11'in genel istek limiti kamuya açık dokümantasyonda netleşmediği için
// (Trendyol'daki "10 saniyede 50 istek" gibi doğrulanmış bir sayı yok),
// proaktif bir sliding-window kurmak yerine sadece 429 yanıtına reaktif
// olarak Retry-After'a (yoksa üstel geri çekilmeye) uyuyoruz.
const MAX_RATE_LIMIT_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function n11Fetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  attempt = 0,
): Promise<T> {
  const { appKey, appSecret } = await getN11Credentials();

  // Trendyol client.ts'teki aynı gerekçe: fetch() zaman aşımı olmadan
  // çağrılırsa N11 tarafı yanıtı geciktirdiğinde tüm istek süresiz askıda
  // kalabilir.
  const REQUEST_TIMEOUT_MS = 20_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${N11_API_BASE}${path}`, {
      method: init.method ?? "GET",
      headers: buildN11Headers(appKey, appSecret),
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `N11 API isteği zaman aşımına uğradı (${REQUEST_TIMEOUT_MS / 1000} sn): ${path}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 429) {
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error("N11 API istek limiti aşıldı (429) - tekrar denemeler tükendi.");
    }
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000
      : 2 ** attempt * 1000;
    await sleep(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 1000);
    return n11Fetch(path, init, attempt + 1);
  }

  if (!response.ok) {
    const rawBody = await response.text();
    let message = rawBody;
    try {
      const parsed = JSON.parse(rawBody) as N11ErrorPayload;
      const fromErrors = parsed.errors
        ?.map((error) => [error.code, error.message].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(", ");
      message = fromErrors || parsed.message || parsed.errorMessage || rawBody;
    } catch {
      // N11 bu sefer JSON döndürmedi - ham gövdeyle devam et.
    }
    // Teşhis: ayrıştırdığımız "message" alanı N11'in gerçek şikayetini
    // (hangi alan, neden) hep içermiyor - varsayılan errors[].code/message
    // alan adları yanlış çıkabilir. Ham gövdeyi de hata metnine ekliyoruz
    // ki admin panelinde görünen hata, N11'in TAM ne dediğini kaybetmesin
    // (2 üst üste "Apide doğrulama işlemi başarısız oldu" denemesi hiçbir
    // ayrıntı vermedi - bu, ayrıştırmanın gerçek alanları kaçırdığından
    // şüphelendiriyor).
    const detail = message === rawBody ? "" : ` — HAM YANIT: ${rawBody.slice(0, 1000)}`;
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `N11 kimlik doğrulama hatası (${response.status}): appKey/appSecret'i kontrol edin. ${message}${detail}`,
      );
    }
    throw new Error(`N11 API isteği başarısız (${response.status}): ${message}${detail}`);
  }

  return response.json() as Promise<T>;
}

export async function ensureN11Columns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("n11_stock_code")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_stock_code TEXT").run();
  }
  if (!names.has("n11_task_id")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_task_id TEXT").run();
  }
  if (!names.has("n11_synced_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_synced_at TEXT").run();
  }
  if (!names.has("n11_price_synced")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_price_synced INTEGER").run();
  }
  // Trendyol'daki trendyol_image_locked_at ile aynı amaç: admin N11 panelinden
  // elle düzeltilmiş bir görseli, ileride eklenecek toplu görsel yenileme
  // araçlarının üzerine yazmaması için (bkz. lib/product-image-lock.ts -
  // ORTAK image_locked_at kolonu zaten XML senkronuna karşı koruyor; bu N11'e
  // ÖZGÜ ayrı kilit, N11 tarafında elle yapılan bir düzeltmeyi de korur).
  if (!names.has("n11_image_locked_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN n11_image_locked_at TEXT").run();
  }
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS products_n11_stock_code_unique ON products(n11_stock_code) WHERE n11_stock_code IS NOT NULL",
    )
    .run();
}

// --- Kategori ---

export type N11Category = {
  id: number;
  name: string;
  parentId?: number | null;
  subCategories?: N11Category[];
};

// GET /cdn/categories - N11'in tüm kategori ağacını döner. Yanıt zarfının
// tam şekli (categories: [] mı, doğrudan [] mi) doğrulanmadı - ikisini de
// kabul ediyor. name verilirse istemci tarafında (N11 sunucu tarafı arama
// desteklemiyorsa) filtreleniyor.
export async function getCategories(name?: string): Promise<N11Category[]> {
  const result = await n11Fetch<N11Category[] | { categories: N11Category[] }>(
    "/cdn/categories",
  );
  const all = Array.isArray(result) ? result : (result.categories ?? []);
  if (!name) return all;
  const search = name.toLocaleLowerCase("tr-TR");
  const matches = (categories: N11Category[]): N11Category[] =>
    categories.flatMap((category) => [
      ...(category.name?.toLocaleLowerCase("tr-TR").includes(search) ? [category] : []),
      ...matches(category.subCategories ?? []),
    ]);
  return matches(all);
}

// Ham teşhis: gerçek yanıt zarfını olduğu gibi döner - getCategories()'in
// varsayımlarını (categories anahtarı, id/name alan adları) doğrulamak için.
export async function getCategoriesRaw(): Promise<unknown> {
  return n11Fetch("/cdn/categories");
}

export function flattenN11Categories(
  categories: N11Category[],
  parentPath = "",
): { id: number; path: string }[] {
  return categories.flatMap((category) => {
    const path = parentPath ? `${parentPath} > ${category.name}` : category.name;
    return [
      { id: category.id, path },
      ...flattenN11Categories(category.subCategories ?? [], path),
    ];
  });
}

export type N11CategoryAttributeValue = {
  id: number;
  name?: string;
  value?: string;
};

// Alan adı (attributeValues) N11'in resmi entegrasyon dokümanında bu şekilde
// doğrulandı - ilk sürümde tahmini olarak "values" kullanılmıştı, gerçek
// dokümanla düzeltildi.
export type N11CategoryAttribute = {
  id: number;
  name: string;
  isMandatory: boolean;
  isCustomValue: boolean;
  isVariant?: boolean;
  attributeValues?: N11CategoryAttributeValue[];
};

// GET /cdn/category/{categoryId}/attribute - bir kategorinin zorunlu/
// opsiyonel özelliklerini döner (Trendyol'daki getCategoryAttributes ile
// aynı amaç). isMandatory=true olanlar ürün gönderiminde attributes
// listesinde bulunmazsa N11 isteği reddeder.
export async function getCategoryAttributes(
  categoryId: number,
): Promise<N11CategoryAttribute[]> {
  const result = await n11Fetch<
    N11CategoryAttribute[] | { attributes: N11CategoryAttribute[] }
  >(`/cdn/category/${categoryId}/attribute`);
  return Array.isArray(result) ? result : (result.attributes ?? []);
}

export async function getCategoryAttributesRaw(categoryId: number): Promise<unknown> {
  return n11Fetch(`/cdn/category/${categoryId}/attribute`);
}

// --- Ürün ---

// Alan adları N11'in resmi entegrasyon dokümanındaki product-create/
// product-update şemasıyla birebir - id/valueId/customValue (Trendyol'daki
// attributeId değil).
export type N11ProductAttribute = {
  id: number;
  // isCustomValue=true olan özellikler için customValue serbest metin,
  // aksi halde N11'in kendi değer listesinden valueId gönderilmeli (bkz.
  // getCategoryAttributes > attributeValues).
  valueId?: number;
  customValue?: string;
};

export type N11ProductImage = {
  url: string;
  order: number;
};

// N11'in resmi dokümanındaki product-create/product-update sku şeması.
// preparingDay/shipmentTemplate hesap-genelinde sabitler (bkz.
// getN11Credentials) - her sku'ya aynı değerle gömülüyor.
export type N11Product = {
  categoryId: number;
  productMainId: string;
  stockCode: string;
  // Zorunlu DEĞİL (resmi dokümanda "Hayır") - sadece gerçek ulusal barkod/
  // GTIN için (dokümandaki örnekler hep sayısal, ör. 8806094924862). Bizim
  // iç stok kodumuz (BYK4277 gibi alfasayısal) gerçek bir barkod değil, bu
  // yüzden hiç gönderilmiyor - ama bunu kaldırmak TASK_ERR_001'i tek
  // başına ÇÖZMEDİ (aynı jenerik hata farklı ürünlerle de tekrarlandı),
  // sorun başka bir yerde.
  barcode?: string;
  // Dokümanın HER örneğinde bu alan atlanmıyor, açıkça null olarak
  // gönderiliyor - zorunlu olmasa da (Hayır) bazı katı deserializer'lar
  // isteğe bağlı alanın bile alanın KENDİSİNİN var olmasını isteyebiliyor.
  // TASK_ERR_001 hatasını teşhis ederken denenen düşük riskli bir uyum
  // adımı.
  catalogId: null;
  title: string;
  description: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
  vatRate: number;
  currencyType: "TL";
  preparingDay: number;
  shipmentTemplate: string;
  images: N11ProductImage[];
  attributes?: N11ProductAttribute[];
};

// POST /ms/product/tasks/product-create ve .../product-update - N11'in
// resmi dokümanına göre gövde {payload:{integrator, skus:[...]}} şeklinde
// sarmalanıyor (Trendyol'un batchRequestId'sinden farklı) ve yanıt
// {id (taskId), type, status, reasons} - asenkron, gerçek kabul/red
// durumunu getTaskDetails() (task-details/page-query) ile sorgulamak
// gerekiyor.
export type N11TaskResult = {
  id?: string;
  type?: string;
  status?: string;
  reasons?: unknown;
  [key: string]: unknown;
};

export async function createProduct(
  products: N11Product[],
  integrator: string,
): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/product-create", {
    method: "POST",
    body: { payload: { integrator, skus: products } },
  });
}

export async function updateProduct(
  products: N11Product[],
  integrator: string,
): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/product-update", {
    method: "POST",
    body: { payload: { integrator, skus: products } },
  });
}

export type N11PriceStockItem = {
  stockCode: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
  currencyType: "TL";
};

// D1 tek gerçek kaynak - Trendyol/Hepsiburada entegrasyonlarıyla aynı
// prensip: N11 tarafında yapılan bir değişiklik asla D1'e geri okunmaz.
export async function updateStockAndPrice(
  items: N11PriceStockItem[],
  integrator: string,
): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/price-stock-update", {
    method: "POST",
    body: { payload: { integrator, skus: items } },
  });
}

// POST /ms/product/task-details/page-query - product-create/update/
// price-stock-update'in asenkron sonucunu sorgular. Yanıt zarfının tam
// şekli (content mi, skus mu) resmi dokümanda netleşmedi - bu yüzden ham
// döndürülüyor, admin panelindeki "Görev durumu sorgula" aracı JSON'ı
// olduğu gibi gösteriyor.
export async function getTaskDetails(
  taskId: string,
  page = 0,
  size = 100,
): Promise<unknown> {
  return n11Fetch("/ms/product/task-details/page-query", {
    method: "POST",
    body: { taskId, pageable: { page, size } },
  });
}

// GET /ms/product-query - satıcının kendi ürünlerini listeler. Şu an sadece
// teşhis amaçlı (ham) - Terragolds D1'i tek gerçek kaynak olarak kullandığı
// için bu uç noktanın sonucu D1'e geri yazılmıyor.
export async function getMyProductsRaw(
  params: {
    id?: number;
    productMainId?: string;
    stockCode?: string;
    saleStatus?: string;
    productStatus?: string;
    brandName?: string;
    categoryIds?: string;
    page?: number;
    size?: number;
  } = {},
): Promise<unknown> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const search = query.toString();
  return n11Fetch(`/ms/product-query${search ? `?${search}` : ""}`);
}

// --- Sipariş ---

// Alan adları N11'in resmi dokümanındaki shipmentPackages yanıtıyla
// birebir - orderLineId, "Picking" onayında (PUT /rest/order/v1/update)
// gönderilmesi gereken lineId ile aynı değer.
export type N11OrderLine = {
  productId?: number;
  stockCode: string;
  productName?: string;
  quantity: number;
  price: number;
  sellerInvoiceAmount?: number;
  orderLineId: number;
  orderItemLineItemStatusName?: string;
};

export type N11OrderPackage = {
  // Paket kimliği alanının gerçek adı (id / shipmentPackageId) resmi
  // dokümanda örnek yanıtla teyit edilmedi - ikisi de kabul ediliyor,
  // bkz. order-mapping.ts.
  id?: number;
  shipmentPackageId?: number;
  orderNumber: string;
  shipmentPackageStatus: string;
  totalAmount?: number;
  discountAmount?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  orderDate?: string;
  trackingNumber?: string;
  billingAddress?: Record<string, unknown>;
  shippingAddress?: {
    address?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phone?: string;
  };
  lines: N11OrderLine[];
};

// GET /rest/delivery/v1/shipmentPackages - sipariş/kargo paketlerini döner.
// startDate/endDate GMT+3 milisaniye epoch (ISO string DEĞİL) - N11'in
// resmi dokümanında böyle belirtiliyor.
export async function getOrders(params: {
  startDate?: number;
  endDate?: number;
  status?: string;
  page?: number;
  size?: number;
  orderByDirection?: "ASC" | "DESC";
} = {}): Promise<{ content: N11OrderPackage[]; totalElements?: number }> {
  const query = new URLSearchParams();
  if (params.startDate !== undefined) query.set("startDate", String(params.startDate));
  if (params.endDate !== undefined) query.set("endDate", String(params.endDate));
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  if (params.orderByDirection) query.set("orderByDirection", params.orderByDirection);
  const search = query.toString();
  return n11Fetch(`/rest/delivery/v1/shipmentPackages${search ? `?${search}` : ""}`);
}

export async function getOrdersRaw(params: Record<string, string> = {}): Promise<unknown> {
  const query = new URLSearchParams(params);
  const search = query.toString();
  return n11Fetch(`/rest/delivery/v1/shipmentPackages${search ? `?${search}` : ""}`);
}

// PUT /rest/order/v1/update - N11'in resmi dokümanına göre şu an SADECE
// "Picking" durumu destekleniyor (Trendyol/Hepsiburada'daki gibi bir
// "Shipped" + kargo takip no bildirimi N11 tarafında henüz YOK). Bu yüzden
// Terragolds admin panelindeki "kargoya verildi" akışına bağlanmıyor -
// bkz. lib/n11/fulfillment.ts'teki karar notu.
export async function updateOrderStatus(lineIds: number[]): Promise<void> {
  if (lineIds.length === 0) return;
  await n11Fetch("/rest/order/v1/update", {
    method: "PUT",
    body: { lines: lineIds.map((lineId) => ({ lineId })), status: "Picking" },
  });
}
