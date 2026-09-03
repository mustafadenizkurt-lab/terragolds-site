"use client";

import { useEffect, useState } from "react";
import { syncFavorites } from "../lib/favorite-client";

function readLiked(): number[] {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem("terragolds-liked") ?? "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Standalone favorite/heart toggle for product cards rendered from a server
 * component (e.g. the category grid), which can't hold the shared `liked`
 * array state the homepage keeps in memory - this reads/writes the same
 * "terragolds-liked" localStorage key and "terragolds-storage" event so it
 * stays in sync with the homepage, product detail page, and favorites list.
 */
export default function FavoriteHeartButton({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [liked, setLikedState] = useState(
    () => typeof window !== "undefined" && readLiked().includes(productId),
  );

  useEffect(() => {
    const refresh = () => setLikedState(readLiked().includes(productId));
    window.addEventListener("terragolds-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("terragolds-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [productId]);

  const toggle = () => {
    const current = readLiked();
    const nextLiked = !current.includes(productId);
    const next = nextLiked
      ? [...new Set([...current, productId])]
      : current.filter((id) => id !== productId);
    window.localStorage.setItem("terragolds-liked", JSON.stringify(next));
    window.dispatchEvent(new Event("terragolds-storage"));
    syncFavorites(next);
    setLikedState(nextLiked);
  };

  return (
    <button
      type="button"
      className={liked ? "heart liked" : "heart"}
      onClick={toggle}
      aria-label={liked ? `${productName} favorilerden çıkar` : `${productName} favorilere ekle`}
    >
      {liked ? "♥" : "♡"}
    </button>
  );
}
