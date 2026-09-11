"use client";

import { useEffect, useState } from "react";

export const COMPARE_STORAGE_KEY = "terragolds-compare";
export const MAX_COMPARE_PRODUCTS = 4;

export function readCompareList(): number[] {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(COMPARE_STORAGE_KEY) ?? "[]",
    ) as unknown;
    return Array.isArray(stored)
      ? stored.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Standalone compare toggle for product cards, mirroring
 * favorite-heart-button.tsx's pattern: reads/writes the shared
 * "terragolds-compare" localStorage key and "terragolds-storage" event so
 * every card (category grid, product detail, homepage) and the header
 * badge stay in sync without any shared React state.
 */
export default function CompareToggleButton({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const [selected, setSelected] = useState(
    () => typeof window !== "undefined" && readCompareList().includes(productId),
  );
  const [atCapacity, setAtCapacity] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const current = readCompareList();
      setSelected(current.includes(productId));
      setAtCapacity(
        current.length >= MAX_COMPARE_PRODUCTS && !current.includes(productId),
      );
    };
    refresh();
    window.addEventListener("terragolds-storage", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("terragolds-storage", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [productId]);

  const toggle = () => {
    const current = readCompareList();
    const isSelected = current.includes(productId);
    if (!isSelected && current.length >= MAX_COMPARE_PRODUCTS) return;
    const next = isSelected
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("terragolds-storage"));
    setSelected(!isSelected);
  };

  return (
    <button
      type="button"
      className={selected ? "compare-toggle selected" : "compare-toggle"}
      onClick={toggle}
      disabled={atCapacity}
      aria-pressed={selected}
      title={
        atCapacity
          ? `En fazla ${MAX_COMPARE_PRODUCTS} ürün karşılaştırabilirsiniz`
          : undefined
      }
      aria-label={
        selected
          ? `${productName} ürününü karşılaştırmadan çıkar`
          : atCapacity
            ? `En fazla ${MAX_COMPARE_PRODUCTS} ürün karşılaştırabilirsiniz`
            : `${productName} ürününü karşılaştırmaya ekle`
      }
    >
      <span aria-hidden="true">⇄</span>
      {selected ? "Karşılaştırmada" : "Karşılaştır"}
    </button>
  );
}
