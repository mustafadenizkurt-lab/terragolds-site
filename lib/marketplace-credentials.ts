import { getD1 } from "./store-db";
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
} from "./payment-crypto";

// payment-crypto.ts fonksiyonları sağlayıcı adına göre genel (generic) AES-GCM
// şifreleme yapıyor - ödemeye özel bir şey yok, "provider" sadece şifreleme
// bağlamını (additionalData) ayırt etmek için kullanılıyor. Trendyol/
// Hepsiburada kimlik bilgileri için ayrı bir şifreleme modülü yazmak yerine
// aynı PAYMENT_CONFIG_ENCRYPTION_KEY ile bunu doğrudan tekrar kullanıyoruz.

export type MarketplaceId = "trendyol" | "hepsiburada";
export const marketplaceIds: MarketplaceId[] = ["trendyol", "hepsiburada"];

export function isMarketplaceId(value: unknown): value is MarketplaceId {
  return value === "trendyol" || value === "hepsiburada";
}

export type MarketplaceFieldDefinition = {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string;
  required: boolean;
};

type MarketplaceDefinition = {
  id: MarketplaceId;
  name: string;
  shortDescription: string;
  fields: MarketplaceFieldDefinition[];
};

export type MarketplaceCredentialSummary = MarketplaceDefinition & {
  enabled: boolean;
  configured: boolean;
  credentialHint: string;
};

export const marketplaceCredentialDefinitions: Record<
  MarketplaceId,
  MarketplaceDefinition
> = {
  trendyol: {
    id: "trendyol",
    name: "Trendyol",
    shortDescription:
      "Trendyol Marketplace API üzerinden ürün, stok ve sipariş senkronu.",
    fields: [
      {
        key: "supplierId",
        label: "Satıcı (Supplier) ID",
        secret: false,
        placeholder: "Trendyol Satıcı ID",
        required: true,
      },
      {
        key: "apiKey",
        label: "API Key",
        secret: false,
        placeholder: "Trendyol API Key",
        required: true,
      },
      {
        key: "apiSecret",
        label: "API Secret",
        secret: true,
        placeholder: "Trendyol API Secret",
        required: true,
      },
    ],
  },
  hepsiburada: {
    id: "hepsiburada",
    name: "Hepsiburada",
    shortDescription:
      "Hepsiburada Merchant Panel API üzerinden ürün, stok ve sipariş senkronu.",
    fields: [
      {
        key: "merchantId",
        label: "Merchant ID",
        secret: false,
        placeholder: "Hepsiburada Merchant ID",
        required: true,
      },
      {
        key: "secretKey",
        label: "Servis Anahtarı (Secret Key)",
        secret: true,
        placeholder: "Entegratör ekranındaki Servis Anahtarı",
        required: true,
      },
      {
        key: "integratorName",
        label: "Entegratör Adı",
        secret: false,
        placeholder: "Entegratör panelindeki adınız",
        required: true,
      },
    ],
  },
};

type MarketplaceRow = {
  provider: MarketplaceId;
  enabled: number;
  encrypted_credentials: string;
  credential_hint: string;
};

// Diğer entegrasyon tablolarıyla (hepsiburada_orders, trendyol_orders vb.)
// aynı "lazy" desen: drizzle-kit migration'ları prodüksiyondaki D1'e hiç
// uygulanmıyor, bu yüzden tablo ilk kullanımda burada oluşturuluyor.
export async function ensureMarketplaceCredentialsTable(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS marketplace_credential_settings (
        provider TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        encrypted_credentials TEXT NOT NULL DEFAULT '',
        credential_hint TEXT NOT NULL DEFAULT '',
        updated_by INTEGER,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    )
    .run();
}

function credentialHint(
  definition: MarketplaceDefinition,
  credentials: Record<string, string>,
) {
  const identifierField = definition.fields.find((field) => !field.secret);
  const identifier = identifierField ? credentials[identifierField.key] : undefined;
  if (!identifier) return "";
  const suffix = identifier.slice(-4);
  return suffix ? `•••• ${suffix}` : "Kaydedildi";
}

function validateCredentials(
  provider: MarketplaceId,
  input: Record<string, string>,
) {
  const credentials: Record<string, string> = {};
  for (const field of marketplaceCredentialDefinitions[provider].fields) {
    const value = String(input[field.key] ?? "").trim();
    if (value.length > 500) {
      throw new Error(`${field.label} çok uzun.`);
    }
    if (value) credentials[field.key] = value;
  }
  return credentials;
}

async function readRow(db: D1Database, provider: MarketplaceId) {
  await ensureMarketplaceCredentialsTable(db);
  return db
    .prepare(
      `SELECT provider, enabled, encrypted_credentials, credential_hint
       FROM marketplace_credential_settings WHERE provider = ?`,
    )
    .bind(provider)
    .first<MarketplaceRow>();
}

export async function listMarketplaceCredentialsForAdmin(): Promise<
  MarketplaceCredentialSummary[]
> {
  const db = getD1();
  await ensureMarketplaceCredentialsTable(db);
  const result = await db
    .prepare(
      `SELECT provider, enabled, encrypted_credentials, credential_hint
       FROM marketplace_credential_settings`,
    )
    .all<MarketplaceRow>();
  const byProvider = new Map(
    result.results
      .filter((row) => isMarketplaceId(row.provider))
      .map((row) => [row.provider, row]),
  );

  return marketplaceIds.map((provider) => {
    const definition = marketplaceCredentialDefinitions[provider];
    const row = byProvider.get(provider);
    return {
      ...definition,
      enabled: row ? Boolean(row.enabled) : false,
      configured: Boolean(row?.encrypted_credentials),
      credentialHint: row?.credential_hint ?? "",
    };
  });
}

// Gerçek API isteklerinde kullanılır: D1'de kayıtlı ve etkinleştirilmiş,
// tüm zorunlu alanları dolu kimlik bilgilerini döner. Yoksa null - çağıran
// taraf (lib/trendyol/auth.ts, lib/hepsiburada/auth.ts) bunun üzerine
// Worker secret'a (getRequiredEnv) düşer.
export async function getMarketplaceCredential(
  provider: MarketplaceId,
): Promise<Record<string, string> | null> {
  const row = await readRow(getD1(), provider);
  if (!row?.enabled || !row.encrypted_credentials) return null;

  const credentials = await decryptPaymentCredentials(
    provider,
    row.encrypted_credentials,
  );
  const missingRequired = marketplaceCredentialDefinitions[provider].fields.some(
    (field) => field.required && !credentials[field.key],
  );
  return missingRequired ? null : credentials;
}

export async function saveMarketplaceCredential(input: {
  provider: MarketplaceId;
  enabled: boolean;
  credentials: Record<string, string>;
  updatedBy: number;
}) {
  const db = getD1();
  const current = await readRow(db, input.provider);

  let credentials = current?.encrypted_credentials
    ? await decryptPaymentCredentials(input.provider, current.encrypted_credentials)
    : {};
  credentials = {
    ...credentials,
    ...validateCredentials(input.provider, input.credentials),
  };

  const definition = marketplaceCredentialDefinitions[input.provider];
  const missing = definition.fields.filter(
    (field) => field.required && !credentials[field.key],
  );
  if (input.enabled && missing.length) {
    throw new Error(
      `Etkinleştirmek için ${missing.map((field) => field.label).join(", ")} alanlarını doldurun.`,
    );
  }

  const configured = Object.keys(credentials).length > 0;
  const encryptedCredentials = configured
    ? await encryptPaymentCredentials(input.provider, credentials)
    : "";

  await db
    .prepare(
      `INSERT INTO marketplace_credential_settings
        (provider, enabled, encrypted_credentials, credential_hint, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET
         enabled = excluded.enabled,
         encrypted_credentials = excluded.encrypted_credentials,
         credential_hint = excluded.credential_hint,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      input.provider,
      input.enabled ? 1 : 0,
      encryptedCredentials,
      credentialHint(definition, credentials),
      input.updatedBy,
    )
    .run();
}

export async function removeMarketplaceCredential(
  provider: MarketplaceId,
  updatedBy: number,
) {
  const db = getD1();
  await ensureMarketplaceCredentialsTable(db);
  await db
    .prepare(
      `INSERT INTO marketplace_credential_settings
        (provider, enabled, encrypted_credentials, credential_hint, updated_by, updated_at)
       VALUES (?, 0, '', '', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET
         enabled = 0,
         encrypted_credentials = '',
         credential_hint = '',
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(provider, updatedBy)
    .run();
}
