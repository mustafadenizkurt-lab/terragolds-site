import { getD1 } from "./store-db";

export type SavedPaymentMethodRow = {
  id: number;
  user_id: number;
  provider: string;
  provider_payment_method_id: string;
  cardholder_name: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: number;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_email?: string;
};

export type SavedPaymentMethod = {
  id: number;
  userId: number;
  provider: string;
  tokenPreview: string;
  cardholderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
};

const allowedBrands = new Set([
  "visa",
  "mastercard",
  "amex",
  "troy",
  "discover",
  "other",
]);

export async function ensureSavedPaymentMethodsTable() {
  await getD1()
    .prepare(
      `CREATE TABLE IF NOT EXISTS saved_payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'manual',
        provider_payment_method_id TEXT NOT NULL,
        cardholder_name TEXT NOT NULL DEFAULT '',
        brand TEXT NOT NULL DEFAULT 'other',
        last4 TEXT NOT NULL,
        exp_month INTEGER NOT NULL,
        exp_year INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();

  await getD1()
    .prepare(
      `CREATE INDEX IF NOT EXISTS saved_payment_methods_user_idx
        ON saved_payment_methods(user_id, is_default, created_at)`,
    )
    .run();
}

export function mapSavedPaymentMethod(
  row: SavedPaymentMethodRow,
): SavedPaymentMethod {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    tokenPreview: `${row.provider_payment_method_id.slice(0, 8)}...`,
    cardholderName: row.cardholder_name,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
  };
}

export function normalizePaymentMethodInput(body: Record<string, unknown>) {
  if (body.cardNumber || body.number || body.cvv || body.cvc || body.cvv2) {
    throw new Error(
      "Tam kart numarası veya CVV kaydedilemez. Sadece ödeme sağlayıcı tokenı, marka ve son 4 hane saklanır.",
    );
  }

  const last4 = String(body.last4 ?? "").replace(/\D/g, "");
  const expMonth = Number(body.expMonth);
  const expYear = Number(body.expYear);
  const brand = String(body.brand ?? "other")
    .trim()
    .toLocaleLowerCase("tr-TR");
  const provider = String(body.provider ?? "manual").trim().slice(0, 40);
  const token = String(body.providerPaymentMethodId ?? "").trim();

  if (!/^\d{4}$/.test(last4)) {
    throw new Error("Kartın son 4 hanesi 4 rakam olmalı.");
  }
  if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
    throw new Error("Geçerli bir son kullanma ayı seçin.");
  }
  if (!Number.isInteger(expYear) || expYear < 2026 || expYear > 2100) {
    throw new Error("Geçerli bir son kullanma yılı girin.");
  }

  return {
    provider: provider || "manual",
    providerPaymentMethodId: token || `manual_${crypto.randomUUID()}`,
    cardholderName: String(body.cardholderName ?? "").trim().slice(0, 90),
    brand: allowedBrands.has(brand) ? brand : "other",
    last4,
    expMonth,
    expYear,
    isDefault: Boolean(body.isDefault),
  };
}
