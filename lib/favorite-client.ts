const FAVORITE_VISITOR_KEY = "terragolds-favorite-visitor";

function getFavoriteVisitorId() {
  const existing = window.localStorage.getItem(FAVORITE_VISITOR_KEY);
  if (existing) return existing;

  const visitorId = crypto.randomUUID();
  window.localStorage.setItem(FAVORITE_VISITOR_KEY, visitorId);
  return visitorId;
}

export function syncFavorites(productIds: number[]) {
  const cleanProductIds = [
    ...new Set(
      productIds.filter(
        (productId) => Number.isInteger(productId) && productId > 0,
      ),
    ),
  ].slice(0, 250);

  void fetch("/api/favorites/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      visitorId: getFavoriteVisitorId(),
      productIds: cleanProductIds,
    }),
  }).catch(() => {
    // Favoriler cihazda çalışmaya devam eder; sunucu istatistiği sonra eşitlenir.
  });
}
