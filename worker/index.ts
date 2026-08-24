/** Terragolds Cloudflare Worker entry point. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { dispatchApiRequest } from "./api-dispatch";

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
};

export default worker;
