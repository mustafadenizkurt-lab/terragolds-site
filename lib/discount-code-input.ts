import { normalizeDiscountCode, parseTlToKurus } from "./cart-pricing";

export type DiscountCodeInput = {
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minimumOrderAmount: number;
  usageLimit: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
};

function optionalDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Kampanya tarihi geçersiz.");
  }
  return date.toISOString();
}

export function parseDiscountCodeInput(
  body: Record<string, unknown>,
): DiscountCodeInput {
  const code = normalizeDiscountCode(body.code);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    throw new Error(
      "Kod 3–40 karakter olmalı; yalnızca harf, rakam, tire ve alt çizgi kullanılabilir.",
    );
  }

  const discountType =
    body.discountType === "fixed" ? "fixed" : "percent";
  const rawValue = Number(body.discountValue);
  const discountValue =
    discountType === "percent"
      ? Math.round(rawValue)
      : parseTlToKurus(body.discountValue);
  if (
    !Number.isFinite(rawValue) ||
    (discountType === "percent" &&
      (discountValue < 1 || discountValue > 90)) ||
    (discountType === "fixed" && discountValue < 1)
  ) {
    throw new Error(
      discountType === "percent"
        ? "Yüzde indirimi 1 ile 90 arasında olmalıdır."
        : "Sabit indirim tutarı sıfırdan büyük olmalıdır.",
    );
  }

  const startsAt = optionalDate(body.startsAt);
  const expiresAt = optionalDate(body.expiresAt);
  if (
    startsAt &&
    expiresAt &&
    new Date(expiresAt).getTime() <= new Date(startsAt).getTime()
  ) {
    throw new Error("Bitiş tarihi başlangıç tarihinden sonra olmalıdır.");
  }

  const usageLimit = Math.max(0, Math.round(Number(body.usageLimit) || 0));
  return {
    code,
    description: String(body.description ?? "").trim().slice(0, 160),
    discountType,
    discountValue,
    minimumOrderAmount: parseTlToKurus(body.minimumOrderAmount),
    usageLimit: Math.min(1_000_000, usageLimit),
    active: body.active !== false,
    startsAt,
    expiresAt,
  };
}
