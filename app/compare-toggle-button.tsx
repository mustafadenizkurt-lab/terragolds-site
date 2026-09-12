"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../lib/language-client";

export const COMPARE_STORAGE_KEY = "terragolds-compare";
export const MAX_COMPARE_PRODUCTS = 4;

const copy = {
  tr: {
    inCompare: "Karşılaştırmada",
    compare: "Karşılaştır",
    atCapacity: (max: number) => `En fazla ${max} ürün karşılaştırabilirsiniz`,
    remove: (name: string) => `${name} ürününü karşılaştırmadan çıkar`,
    add: (name: string) => `${name} ürününü karşılaştırmaya ekle`,
  },
  en: {
    inCompare: "In compare",
    compare: "Compare",
    atCapacity: (max: number) => `You can compare up to ${max} products`,
    remove: (name: string) => `Remove ${name} from compare`,
    add: (name: string) => `Add ${name} to compare`,
  },
} as const;

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
  const [selected, setSelected] = useState(false);
  const [atCapacity, setAtCapacity] = useState(false);
  const [language] = useLanguage();
  const t = copy[language];

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
      title={atCapacity ? t.atCapacity(MAX_COMPARE_PRODUCTS) : undefined}
      aria-label={
        selected
          ? t.remove(productName)
          : atCapacity
            ? t.atCapacity(MAX_COMPARE_PRODUCTS)
            : t.add(productName)
      }
    >
      <span aria-hidden="true">⇄</span>
      {selected ? t.inCompare : t.compare}
    </button>
  );
}
