/** Terragolds Cloudflare Worker entry point. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { dispatchApiRequest } from "./api-dispatch";
import { restockActiveSuppliers, syncActiveSuppliers } from "../lib/xml-sync/syncSupplier";
import { syncTrendyolOrders } from "../lib/trendyol/orders";
// Shopify kanalı pasife alındı - bkz. scheduled() içindeki yorum. Tekrar
// açılınca bu import'lar da geri gelmeli.
// import {
//   publishExistingProductsToShopify,
//   syncProductsToShopify,
// } from "../lib/shopify/sync";
// import { pushPendingShopifyPrices } from "../lib/shopify/price";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const staticAssetPattern =
  /\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|png|svg|txt|webp|woff2?|xml)$/i;

async function fetchStaticAsset(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (
    !url.pathname.startsWith("/assets/") &&
    !url.pathname.startsWith("/app/") &&
    !staticAssetPattern.test(url.pathname)
  ) {
    return null;
  }

  const response = await env.ASSETS.fetch(request);
  return response.status === 404 ? null : response;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Canonicalize on www: the bare apex domain serves identical content
    // with no redirect, which Google treats as duplicate content and
    // arbitrarily picks a canonical for - keeping pages out of the index.
    // Every URL in the codebase (sitemap, robots.txt, llms.txt, SITE_URL)
    // already assumes www, so redirect the apex to it permanently.
    if (url.hostname === "terragolds.com") {
      url.hostname = "www.terragolds.com";
      return Response.redirect(url.toString(), 301);
    }

    const staticResponse = await fetchStaticAsset(request, env);
    if (staticResponse) return staticResponse;

    if (url.pathname.startsWith("/api/")) {
      const apiResponse = await dispatchApiRequest(request);
      if (apiResponse) return apiResponse;
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncActiveSuppliers(env.DB));
    // "manual" işaretli ürünlerin (tedarikçiye elle bağlanmış, fiyatı/adı
    // elle yönetilen kayıtlar) stoğu yukarıdaki normal senkrona hiç dahil
    // değil - tedarikçide tükenen bir ürün fark edilmeden "stokta"
    // görünmeye devam edebiliyordu (gerçek bir sipariş kabul edildi).
    ctx.waitUntil(restockActiveSuppliers(env.DB).catch(() => {}));
    // Trendyol siparişleri hiçbir zaman otomatik çekilmiyordu - admin
    // panelinde bunu tetikleyen bir buton da yoktu, cron'a da bağlı
    // değildi. Sonuç: Trendyol'da gerçek bir sipariş oluşsa bile biri elle
    // /api/admin/trendyol/orders'a istek atmadıkça admin panelde hiç
    // görünmüyordu. syncTrendyolOrders zaten INSERT OR IGNORE kullandığı
    // için (aynı sipariş tekrar çekilirse D1'deki durumun üzerine yazmıyor)
    // her 6 saatte bir tekrar çalıştırmak güvenli.
    ctx.waitUntil(syncTrendyolOrders(env.DB).catch(() => {}));
    // Shopify kanalı pasife alındı (hiç sipariş gelmiyordu, kullanıcı
    // talebiyle durduruldu) - otomatik ürün/fiyat/stok gönderimi geçici
    // olarak kapalı. Kod silinmedi, tekrar açmak için aşağıdaki 3 satırı
    // geri yorum satırından çıkarmak yeterli.
    // ctx.waitUntil(syncProductsToShopify(env.DB).catch(() => {}));
    // ctx.waitUntil(
    //   publishExistingProductsToShopify(env.DB, 200).catch(() => {}),
    // );
    // ctx.waitUntil(pushPendingShopifyPrices(env.DB, 200).catch(() => {}));
  },
};

export default worker;
