import { getHepsiburadaCredentials, buildHepsiburadaAuthHeader, buildHepsiburadaUserAgent } from "./auth";

// Hepsiburada Marketplace (Merchant Panel Open Platform) entegrasyonu üç
// ayrı host üzerinden çalışıyor - Trendyol'un tek base URL'inin aksine:
// - Ürün/listing işlemleri: mpop.hepsiburada.com
// - Fiyat/stok işlemleri: listing-external.hepsiburada.com
// - Sipariş işlemleri: oms-external.hepsiburada.com
// NOT: Hepsiburada onayı henüz gelmedi - bu üç host ve aşağıdaki endpoint
// yolları resmi dokümantasyona dayanıyor ama gerçek kimlik bilgileriyle
// canlı doğrulama yapılamadı. Onay gelip ilk gerçek istekler atıldığında
// (özellikle ürün/kategori alanları) yeniden gözden geçirilmesi gerekebilir.
export const HEPSIBURADA_PRODUCT_API_BASE = "https://mpop.hepsiburada.com";
export const HEPSIBURADA_LISTING_API_BASE = "https://listing-external.hepsiburada.com";
export const HEPSIBURADA_ORDER_API_BASE = "https://oms-external.hepsiburada.com";

type HepsiburadaErrorPayload = {
  errors?: { message?: string; errorCode?: string }[];
};

// NOT: HEPSIBURADA_MERCHANT_ID/USERNAME/PASSWORD henüz .env'de/Worker
// secret olarak tanımlı değil (onay bekleniyor) - bu yüzden bu dosyadaki
// hiçbir fonksiyon şu an gerçekten çalıştırılamaz; her çağrı
// getHepsiburadaCredentials() üzerinden "ortam değişkeni ayarlanmamış"
// hatasıyla başarısız olur.
async function hepsiburadaFetch<T>(
  baseUrl: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { merchantId, secretKey, integratorName } = await getHepsiburadaCredentials();

  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      authorization: buildHepsiburadaAuthHeader(merchantId, secretKey),
      "user-agent": buildHepsiburadaUserAgent(merchantId, integratorName),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    let message = await response.text();
    try {
      const parsed = JSON.parse(message) as HepsiburadaErrorPayload;
      if (parsed.errors?.length) {
        message = parsed.errors
          .map((error) => error.message ?? error.errorCode ?? "bilinmeyen hata")
          .join(", ");
      }
    } catch {
      // Hepsiburada didn't return JSON this time - fall back to the raw body.
    }
    throw new Error(`Hepsiburada API isteği başarısız (${response.status}): ${message}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function ensureHepsiburadaColumns(db: D1Database) {
  const columns = await db
    .prepare("PRAGMA table_info(products)")
    .all<{ name: string }>();
  const names = new Set(columns.results.map((column) => column.name));
  if (!names.has("hepsiburada_sku")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hepsiburada_sku TEXT").run();
  }
  if (!names.has("hepsiburada_listing_id")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hepsiburada_listing_id TEXT").run();
  }
  if (!names.has("hepsiburada_synced_at")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hepsiburada_synced_at TEXT").run();
  }
  if (!names.has("hepsiburada_price_synced")) {
    await db.prepare("ALTER TABLE products ADD COLUMN hepsiburada_price_synced INTEGER").run();
  }
  await db
    .prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS products_hepsiburada_sku_unique ON products(hepsiburada_sku) WHERE hepsiburada_sku IS NOT NULL",
    )
    .run();
}

// --- Product/Listing Integration ---

export type HepsiburadaProduct = {
  merchantSku: string;
  hepsiburadaSku?: string;
  productName: string;
  categoryId: string;
  brand: string;
  price: number;
  availableStock: number;
  description: string;
  images: string[];
  vatRate: number;
};

type HepsiburadaBatchResult = {
  trackingId: string;
};

export async function getProducts(params: {
  offset?: number;
  limit?: number;
  merchantSku?: string;
} = {}): Promise<{ items: HepsiburadaProduct[]; totalCount: number }> {
  const { merchantId } = await getHepsiburadaCredentials();
  const query = new URLSearchParams();
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.merchantSku) query.set("merchantSku", params.merchantSku);
  const search = query.toString();
  return hepsiburadaFetch(
    HEPSIBURADA_LISTING_API_BASE,
    `/listings/merchantid/${merchantId}${search ? `?${search}` : ""}`,
  );
}

export async function createProduct(
  products: HepsiburadaProduct[],
): Promise<HepsiburadaBatchResult> {
  return hepsiburadaFetch(HEPSIBURADA_PRODUCT_API_BASE, `/product/api/products/import`, {
    method: "POST",
    body: { items: products },
  });
}

export async function updateProduct(
  products: HepsiburadaProduct[],
): Promise<HepsiburadaBatchResult> {
  // Hepsiburada'da ürün güncellemesi de aynı import endpoint'i üzerinden,
  // merchantSku eşleştirmesiyle yapılıyor - Trendyol'daki v2/products PUT
  // deseniyle aynı mantık.
  return hepsiburadaFetch(HEPSIBURADA_PRODUCT_API_BASE, `/product/api/products/import`, {
    method: "POST",
    body: { items: products },
  });
}

export async function getTrackingResult(trackingId: string): Promise<{
  trackingId: string;
  items: { status: string; errorMessages?: string[] }[];
}> {
  return hepsiburadaFetch(
    HEPSIBURADA_PRODUCT_API_BASE,
    `/product/api/products/import/${trackingId}`,
  );
}

// --- Price & Inventory Integration ---

export type HepsiburadaPriceAndInventoryItem = {
  merchantSku: string;
  availableStock: number;
  price: number;
};

// D1 tek gerçek kaynak (source of truth) - stok/fiyat her zaman D1'den
// Hepsiburada'ya tek yönlü gönderilir, Shopify/Trendyol entegrasyonlarındaki
// ile aynı prensip.
export async function updateStockAndPrice(
  items: HepsiburadaPriceAndInventoryItem[],
): Promise<HepsiburadaBatchResult> {
  const { merchantId } = await getHepsiburadaCredentials();
  return hepsiburadaFetch(
    HEPSIBURADA_LISTING_API_BASE,
    `/listings/merchantid/${merchantId}/price-inventory`,
    { method: "PUT", body: { items } },
  );
}

// --- Order Integration ---

export type HepsiburadaOrderLine = {
  merchantSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineItemId?: string;
};

export type HepsiburadaOrder = {
  orderNumber: string;
  packageNumber: string;
  status: string;
  totalPrice: number;
  totalDiscount: number;
  customerName: string;
  customerEmail: string;
  orderDate: string;
  cargoTrackingNumber?: string;
  deliveryAddress?: {
    address?: string;
    town?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
    phoneNumber?: string;
  };
  items: HepsiburadaOrderLine[];
};

export async function getOrders(params: {
  startDate?: string;
  endDate?: string;
  status?: string;
  offset?: number;
  limit?: number;
} = {}): Promise<{ items: HepsiburadaOrder[]; totalCount: number }> {
  const { merchantId } = await getHepsiburadaCredentials();
  const query = new URLSearchParams();
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.status) query.set("status", params.status);
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  const search = query.toString();
  return hepsiburadaFetch(
    HEPSIBURADA_ORDER_API_BASE,
    `/orders/merchantid/${merchantId}${search ? `?${search}` : ""}`,
  );
}

// Terragolds admin, kargo durumunu değiştirebileceğimiz TEK yer - Shopify/
// Trendyol entegrasyonlarındaki ile aynı "geri okuma yok" kuralı: bu sadece
// Hepsiburada'ya kargoya verildi bilgisini tek yönlü bildirir.
export async function updateOrderStatus(
  packageNumber: string,
  input: { trackingNumber: string; cargoCompany: string },
): Promise<void> {
  await hepsiburadaFetch(
    HEPSIBURADA_ORDER_API_BASE,
    `/Shipment/Package/${packageNumber}`,
    {
      method: "PUT",
      body: {
        cargoTrackingNumber: input.trackingNumber,
        cargoCompany: input.cargoCompany,
      },
    },
  );
}
