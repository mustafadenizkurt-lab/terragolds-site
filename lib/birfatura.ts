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

function randomApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `tg_bf_${base64}`;
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

// BirFatura'dan gelen isteklerde Authorization header'ını doğrular -
// "Bearer <anahtar>" veya çıplak anahtar kabul ediyor (BirFatura'nın tam
// olarak hangi formatı göndereceği henüz netleşmedi, ikisi de destekleniyor).
export async function verifyBirfaturaRequest(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? request.headers.get("x-api-key");
  if (!header) return false;
  const provided = header.replace(/^Bearer\s+/i, "").trim();
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
