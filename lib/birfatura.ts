import { getD1 } from "./store-db";

// BirFatura bizim sitemize DIŞARIDAN istek atacak (Hepsiburada/Trendyol'un
// tersi - orada biz onlara istek atıyorduk). Bu yüzden burada bir API
// anahtarı üretip BirFatura'nın "API Şifresi" alanına girmeleri gerekiyor.
// Anahtar sadece üretildiği an düz metin olarak gösteriliyor (Stripe/GitHub
// token'ları gibi), D1'de sadece SHA-256 özeti saklanıyor - bir daha geri
// gösterilemiyor, sadece yenisi üretilebiliyor.

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// BirFatura'nın kendi dokümantasyonuna göre token bir GUID olmalı - Web
// Crypto'nun randomUUID()'si zaten bunu üretiyor.
function randomApiKey(): string {
  return crypto.randomUUID();
}

export async function ensureBirfaturaTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS birfatura_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        api_key_hash TEXT NOT NULL DEFAULT '',
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

export type BirfaturaStatus = {
  enabled: boolean;
  configured: boolean;
  updatedAt: string | null;
};

export async function getBirfaturaStatus(): Promise<BirfaturaStatus> {
  const db = getD1();
  await ensureBirfaturaTable(db);
  const row = await db
    .prepare(
      "SELECT enabled, api_key_hash AS apiKeyHash, updated_at AS updatedAt FROM birfatura_settings WHERE id = 1",
    )
    .first<{ enabled: number; apiKeyHash: string; updatedAt: string }>();
  return {
    enabled: Boolean(row?.enabled),
    configured: Boolean(row?.apiKeyHash),
    updatedAt: row?.updatedAt ?? null,
  };
}

// Yeni bir API anahtarı üretir, D1'e sadece özetini (hash) yazar ve
// entegrasyonu etkinleştirir. Düz metin anahtar SADECE bu çağrının
// dönüşünde var - bir daha hiçbir yerden okunamaz.
export async function regenerateBirfaturaApiKey(
  updatedBy: number,
): Promise<string> {
  const db = getD1();
  await ensureBirfaturaTable(db);
  const apiKey = randomApiKey();
  const hash = await sha256Hex(apiKey);
  await db
    .prepare(
      `INSERT INTO birfatura_settings (id, enabled, api_key_hash, updated_by, updated_at)
       VALUES (1, 1, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         enabled = 1,
         api_key_hash = excluded.api_key_hash,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(hash, updatedBy)
    .run();
  return apiKey;
}

export async function disableBirfaturaAccess(updatedBy: number) {
  const db = getD1();
  await ensureBirfaturaTable(db);
  await db
    .prepare(
      `INSERT INTO birfatura_settings (id, enabled, api_key_hash, updated_by, updated_at)
       VALUES (1, 0, '', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         enabled = 0,
         api_key_hash = '',
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(updatedBy)
    .run();
}

// BirFatura /api/orderStatus servisinden dönen sabit liste - db'deki
// orders.status (orders_status_check kısıtlaması: pending/paid/failed/
// shipped/delivered/cancelled) değerlerini BirFatura'nın beklediği
// {Id, Value} çiftlerine eşliyor. "pending" (henüz ödenmemiş, faturalanacak
// bir şey yok) kasıtlı olarak listede yok. /api/orders servisi de bu
// ID'leri OrderStatusId alanında kullanıyor - ikisi arasında tutarlı olması
// dokümanda özellikle belirtiliyor.
export const BIRFATURA_ORDER_STATUS_MAP: Record<
  string,
  { id: number; value: string }
> = {
  paid: { id: 1, value: "Ödendi" },
  shipped: { id: 2, value: "Kargolandı" },
  delivered: { id: 3, value: "Teslim Edildi" },
  cancelled: { id: 4, value: "İptal Edildi" },
  failed: { id: 5, value: "Başarısız" },
};

// BirFatura /api/paymentMethods servisinden dönen sabit liste. Terragolds'ta
// gerçek ödeme sağlayıcı (Shopier/PayTR/iyzico) fark etmeksizin müşteri
// tarafında hepsi "kredi/banka kartı" olarak görünüyor - kapıda ödeme
// (orders.is_cod) ayrı bir yöntem. /api/orders'ın PaymentMethodId alanı bu
// ID'leri kullanacak.
export const BIRFATURA_PAYMENT_METHOD_MAP = {
  card: { id: 1, value: "Kredi Kartı" },
  cod: { id: 2, value: "Kapıda Ödeme" },
} as const;

// BirFatura'nın resmi dokümantasyonuna göre (developers.birfatura.com/
// dokuman/ozel-entegrasyon-api) token, "token" adlı düz bir header'da
// gönderiliyor - Authorization/Bearer değil.
export async function verifyBirfaturaRequest(request: Request): Promise<boolean> {
  const provided = request.headers.get("token")?.trim();
  if (!provided) return false;

  const db = getD1();
  await ensureBirfaturaTable(db);
  const row = await db
    .prepare(
      "SELECT enabled, api_key_hash AS apiKeyHash FROM birfatura_settings WHERE id = 1",
    )
    .first<{ enabled: number; apiKeyHash: string }>();
  if (!row?.enabled || !row.apiKeyHash) return false;

  const providedHash = await sha256Hex(provided);
  return providedHash === row.apiKeyHash;
}
