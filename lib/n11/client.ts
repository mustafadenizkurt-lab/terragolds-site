import { getN11Credentials, buildN11Headers } from "./auth";

// N11'in resmi geliştirici portalı (developer.n11.com) bot korumalı olduğu
// için taban URL ve uç noktalar üçüncü taraf entegrasyon kaynaklarından
// (magazadestek.n11.com, codeilla.com.tr) derlendi - Trendyol client.ts'te
// olduğu gibi developers.trendyol.com'dan birebir doğrulanmadı. İlk gerçek
// istekte (kimlik bilgileri admin panelinden girildikten sonra) alan
// adları/uç nokta yolları sapma gösterirse buradaki tipler ve yollar
// güncellenmeli - ham (raw) fonksiyonlar bu yüzden bilhassa korunuyor.
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
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as N11ErrorPayload;
      const fromErrors = parsed.errors
        ?.map((error) => [error.code, error.message].filter(Boolean).join(": "))
        .filter(Boolean)
        .join(", ");
      message = fromErrors || parsed.message || parsed.errorMessage || message;
    } catch {
      // N11 bu sefer JSON döndürmedi - ham gövdeyle devam et.
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `N11 kimlik doğrulama hatası (${response.status}): appKey/appSecret'i kontrol edin. ${message}`,
      );
    }
    throw new Error(`N11 API isteği başarısız (${response.status}): ${message}`);
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
  name: string;
};

export type N11CategoryAttribute = {
  id: number;
  name: string;
  isMandatory: boolean;
  isCustomValue: boolean;
  isVariant: boolean;
  values?: N11CategoryAttributeValue[];
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

export type N11ProductAttribute = {
  attributeId: number;
  // isCustomValue=true olan özellikler için customValue serbest metin,
  // aksi halde N11'in kendi değer listesinden valueId gönderilmeli (bkz.
  // getCategoryAttributes).
  valueId?: number;
  customValue?: string;
};

export type N11Product = {
  categoryId: number;
  productMainId: string;
  stockCode: string;
  title: string;
  description: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
  vatRate: number;
  currencyType: "TL";
  images: { url: string }[];
  attributes?: N11ProductAttribute[];
  // barcode alanı Codeilla'nın derlediği zorunlu alan listesinde açıkça
  // GEÇMİYOR (Trendyol'un aksine) - ama pek çok pazaryeri entegrasyonunda
  // fiilen isteniyor, bu yüzden gönderiliyor ama opsiyonel işaretlendi.
  // İlk gerçek istekte N11 bunu reddederse (veya zorunlu isterse) burası
  // güncellenmeli.
  barcode?: string;
};

// POST /ms/product/tasks/product-create - "tasks" segmenti asenkron bir
// işlem kuyruğuna işaret ediyor (Trendyol'un batchRequestId'siyle benzer),
// ama görev durumunu SORGULAYAN uç nokta üçüncü taraf kaynaklarda
// belirtilmemiş - taskId burada ham olarak saklanıyor, gerçek durumunu
// N11 satıcı panelinden kontrol etmek gerekiyor ilk entegrasyon testinde.
export type N11TaskResult = {
  taskId?: string;
  id?: string;
  [key: string]: unknown;
};

export async function createProduct(products: N11Product[]): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/product-create", {
    method: "POST",
    body: { products },
  });
}

export async function updateProduct(products: N11Product[]): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/product-update", {
    method: "POST",
    body: { products },
  });
}

export type N11PriceStockItem = {
  stockCode: string;
  quantity: number;
  salePrice: number;
  listPrice: number;
};

// D1 tek gerçek kaynak - Trendyol/Hepsiburada entegrasyonlarıyla aynı
// prensip: N11 tarafında yapılan bir değişiklik asla D1'e geri okunmaz.
export async function updateStockAndPrice(
  items: N11PriceStockItem[],
): Promise<N11TaskResult> {
  return n11Fetch("/ms/product/tasks/price-stock-update", {
    method: "POST",
    body: { products: items },
  });
}

// --- Sipariş ---

export type N11OrderLine = {
  productId?: number;
  stockCode: string;
  productName: string;
  quantity: number;
  price: number;
};

export type N11OrderPackage = {
  id: number; // shipmentPackageId
  orderNumber: string;
  status: string;
  totalAmount: number;
  discountAmount?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  orderDate?: string;
  trackingNumber?: string;
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
export async function getOrders(params: {
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
} = {}): Promise<{ content: N11OrderPackage[]; totalElements?: number }> {
  const query = new URLSearchParams();
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const search = query.toString();
  return n11Fetch(`/rest/delivery/v1/shipmentPackages${search ? `?${search}` : ""}`);
}

export async function getOrdersRaw(params: Record<string, string> = {}): Promise<unknown> {
  const query = new URLSearchParams(params);
  const search = query.toString();
  return n11Fetch(`/rest/delivery/v1/shipmentPackages${search ? `?${search}` : ""}`);
}

// PUT /rest/order/v1/update - Terragolds admin kargo durumunu değiştirdiği
// TEK yer (Trendyol/Hepsiburada ile aynı tek yönlü kural): sadece N11'e
// "kargoya verildi" bilgisini bildirir, hiçbir durumu N11'den geri okumaz.
export async function updateOrderStatus(
  shipmentPackageId: number,
  input: { status: "Shipped" | "Delivered"; trackingNumber?: string; cargoProviderName?: string },
): Promise<void> {
  await n11Fetch("/rest/order/v1/update", {
    method: "PUT",
    body: {
      shipmentPackageId,
      status: input.status,
      trackingNumber: input.trackingNumber,
      cargoProviderName: input.cargoProviderName,
    },
  });
}
