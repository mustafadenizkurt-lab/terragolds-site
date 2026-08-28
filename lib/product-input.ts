import { slugify } from "./slugify";
import type { Product } from "./store-data";

export type ProductInput = Omit<Product, "id">;

export function parseProductInput(payload: unknown): ProductInput {
  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const name = String(body.name ?? "").trim();
  if (!name) throw new Error("Ürün adı zorunludur.");

  const price = Math.max(0, Math.round(Number(body.price) || 0));
  const stock = Math.max(0, Math.round(Number(body.stock) || 0));
  const discountPercent = Math.min(
    90,
    Math.max(0, Math.round(Number(body.discountPercent) || 0)),
  );
  const status = body.status === "published" ? "published" : "draft";
  const syncStatus =
    body.shopierSyncStatus === "connected" ||
    body.shopierSyncStatus === "pending" ||
    body.shopierSyncStatus === "error"
      ? body.shopierSyncStatus
      : "manual";

  return {
    name,
    stone: String(body.stone ?? "").trim(),
    category: String(body.category ?? "Doğal Taşlar").trim(),
    price,
    stock,
    image: String(body.image ?? "").trim() || "/stone-collection.jpg",
    hoverImage: String(body.hoverImage ?? "").trim() || undefined,
    badge: String(body.badge ?? "").trim() || undefined,
    campaignLabel: String(body.campaignLabel ?? "").trim() || undefined,
    discountPercent,
    description: String(body.description ?? "").trim(),
    status,
    shopierUrl: String(body.shopierUrl ?? "").trim() || undefined,
    shopierProductId:
      String(body.shopierProductId ?? "").trim() || undefined,
    shopierSyncStatus: syncStatus,
    // Empty string means "not set by the caller" — the insert/update route
    // generates one from the name (with collision handling) in that case.
    slug: slugify(String(body.slug ?? "").trim()),
    metaTitle: String(body.metaTitle ?? "").trim() || undefined,
    metaDescription: String(body.metaDescription ?? "").trim() || undefined,
    featured: Boolean(body.featured),
    sortOrder: Math.max(0, Math.round(Number(body.sortOrder) || 0)),
  };
}
