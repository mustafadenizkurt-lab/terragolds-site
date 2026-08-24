import { getD1 } from "./store-db";
import { getOptionalEnv } from "./runtime-env";
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
} from "./payment-crypto";
import {
  isPaymentProviderId,
  paymentProviderIds,
  type PaymentProviderId,
  type PaymentProviderSummary,
} from "./payment-types";

type ProviderDefinition = Omit<
  PaymentProviderSummary,
  | "enabled"
  | "configured"
  | "testMode"
  | "isPrimary"
  | "credentialHint"
>;

type ProviderRow = {
  provider: PaymentProviderId;
  enabled: number;
  test_mode: number;
  is_primary: number;
  encrypted_credentials: string;
  credential_hint: string;
};

export const paymentProviderDefinitions: Record<
  PaymentProviderId,
  ProviderDefinition
> = {
  shopier: {
    id: "shopier",
    name: "Shopier",
    shortDescription:
      "Müşteriyi Shopier'in güvenli ödeme sayfasına yönlendirir.",
    supportsTestMode: false,
    fields: [
      {
        key: "apiKey",
        label: "API anahtarı",
        secret: false,
        placeholder: "Shopier API anahtarınız",
        required: true,
      },
      {
        key: "secretKey",
        label: "Gizli anahtar",
        secret: true,
        placeholder: "Shopier gizli anahtarınız",
        required: true,
      },
    ],
  },
  paytr: {
    id: "paytr",
    name: "PayTR",
    shortDescription:
      "Kart ödemelerini PayTR'nin güvenli iFrame ödeme ekranında alır.",
    supportsTestMode: true,
    fields: [
      {
        key: "merchantId",
        label: "Mağaza numarası",
        secret: false,
        placeholder: "Merchant ID",
        required: true,
      },
      {
        key: "merchantKey",
        label: "Mağaza parolası",
        secret: true,
        placeholder: "Merchant Key",
        required: true,
      },
      {
        key: "merchantSalt",
        label: "Mağaza gizli anahtarı",
        secret: true,
        placeholder: "Merchant Salt",
        required: true,
      },
    ],
  },
  iyzico: {
    id: "iyzico",
    name: "iyzico",
    shortDescription:
      "Kart bilgilerini iyzico'nun barındırdığı ödeme formunda işler.",
    supportsTestMode: true,
    fields: [
      {
        key: "apiKey",
        label: "API anahtarı",
        secret: false,
        placeholder: "iyzico API anahtarınız",
        required: true,
      },
      {
        key: "secretKey",
        label: "Gizli anahtar",
        secret: true,
        placeholder: "iyzico gizli anahtarınız",
        required: true,
      },
    ],
  },
};

function legacyShopierCredentials(): Record<string, string> | null {
  const apiKey = getOptionalEnv("SHOPIER_API_KEY");
  const secretKey = getOptionalEnv("SHOPIER_SECRET_KEY");
  if (!apiKey || !secretKey) return null;
  return {
    apiKey,
    secretKey,
    paymentUrl: getOptionalEnv(
      "SHOPIER_PAYMENT_URL",
      "https://www.shopier.com/ShowProduct/api_pay4.php",
    ),
  };
}

function credentialHint(
  provider: PaymentProviderId,
  credentials: Record<string, string>,
) {
  const identifier =
    provider === "paytr" ? credentials.merchantId : credentials.apiKey;
  if (!identifier) return "";
  const suffix = identifier.slice(-4);
  return suffix ? `•••• ${suffix}` : "Kaydedildi";
}

function validateCredentials(
  provider: PaymentProviderId,
  input: Record<string, string>,
) {
  const credentials: Record<string, string> = {};
  for (const field of paymentProviderDefinitions[provider].fields) {
    const value = String(input[field.key] ?? "").trim();
    if (value.length > 500) {
      throw new Error(`${field.label} çok uzun.`);
    }
    if (value) credentials[field.key] = value;
  }
  return credentials;
}

async function readProviderRows() {
  const result = await getD1()
    .prepare(
      `SELECT provider, enabled, test_mode, is_primary,
              encrypted_credentials, credential_hint
       FROM payment_provider_settings`,
    )
    .all<ProviderRow>();
  return result.results.filter((row) => isPaymentProviderId(row.provider));
}

export async function listPaymentProvidersForAdmin() {
  const rows = await readProviderRows();
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  const legacyShopier = legacyShopierCredentials();

  return paymentProviderIds.map((provider) => {
    const definition = paymentProviderDefinitions[provider];
    const row = byProvider.get(provider);
    const configured =
      Boolean(row?.encrypted_credentials) ||
      (provider === "shopier" && Boolean(legacyShopier));
    return {
      ...definition,
      enabled: row ? Boolean(row.enabled) : provider === "shopier" && configured,
      configured,
      testMode: row ? Boolean(row.test_mode) : false,
      isPrimary: row
        ? Boolean(row.is_primary)
        : provider === "shopier" && configured,
      credentialHint:
        row?.credential_hint ||
        (provider === "shopier" && legacyShopier
          ? credentialHint(provider, legacyShopier)
          : ""),
    } satisfies PaymentProviderSummary;
  });
}

export async function getPaymentProvider(
  provider: PaymentProviderId,
  requireEnabled = true,
) {
  const row = await getD1()
    .prepare(
      `SELECT provider, enabled, test_mode, is_primary,
              encrypted_credentials, credential_hint
       FROM payment_provider_settings
       WHERE provider = ?`,
    )
    .bind(provider)
    .first<ProviderRow>();

  if (row) {
    if (requireEnabled && !row.enabled) {
      throw new Error("Seçtiğiniz ödeme yöntemi etkin değil.");
    }
    if (!row.encrypted_credentials) {
      throw new Error("Ödeme yöntemi henüz yapılandırılmamış.");
    }
    return {
      id: provider,
      enabled: Boolean(row.enabled),
      testMode: Boolean(row.test_mode),
      isPrimary: Boolean(row.is_primary),
      credentials: await decryptPaymentCredentials(
        provider,
        row.encrypted_credentials,
      ),
    };
  }

  if (provider === "shopier") {
    const credentials = legacyShopierCredentials();
    if (credentials) {
      return {
        id: provider,
        enabled: true,
        testMode: false,
        isPrimary: true,
        credentials,
      };
    }
  }

  throw new Error("Ödeme yöntemi henüz yapılandırılmamış.");
}

export async function listEnabledPaymentProviders() {
  const providers = await listPaymentProvidersForAdmin();
  return providers
    .filter((provider) => provider.enabled && provider.configured)
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary))
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      shortDescription: provider.shortDescription,
      enabled: provider.enabled,
      configured: provider.configured,
      testMode: provider.testMode,
      isPrimary: provider.isPrimary,
      supportsTestMode: provider.supportsTestMode,
    }));
}

export async function savePaymentProvider(input: {
  provider: PaymentProviderId;
  enabled: boolean;
  testMode: boolean;
  isPrimary: boolean;
  credentials: Record<string, string>;
  updatedBy: number;
}) {
  const current = await getD1()
    .prepare(
      `SELECT encrypted_credentials
       FROM payment_provider_settings WHERE provider = ?`,
    )
    .bind(input.provider)
    .first<{ encrypted_credentials: string }>();

  let credentials = current
    ? current.encrypted_credentials
      ? await decryptPaymentCredentials(
          input.provider,
          current.encrypted_credentials,
        )
      : {}
    : input.provider === "shopier"
      ? (legacyShopierCredentials() ?? {})
      : {};
  credentials = {
    ...credentials,
    ...validateCredentials(input.provider, input.credentials),
  };

  const missing = paymentProviderDefinitions[input.provider].fields.filter(
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
  const db = getD1();
  const statements = [];
  if (input.isPrimary && input.enabled) {
    statements.push(
      db.prepare(
        "UPDATE payment_provider_settings SET is_primary = 0 WHERE provider <> ?",
      ).bind(input.provider),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO payment_provider_settings
          (provider, enabled, test_mode, is_primary, encrypted_credentials,
           credential_hint, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(provider) DO UPDATE SET
           enabled = excluded.enabled,
           test_mode = excluded.test_mode,
           is_primary = excluded.is_primary,
           encrypted_credentials = excluded.encrypted_credentials,
           credential_hint = excluded.credential_hint,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(
        input.provider,
        input.enabled ? 1 : 0,
        input.testMode &&
          paymentProviderDefinitions[input.provider].supportsTestMode
          ? 1
          : 0,
        input.isPrimary && input.enabled ? 1 : 0,
        encryptedCredentials,
        credentialHint(input.provider, credentials),
        input.updatedBy,
      ),
  );
  await db.batch(statements);
}

export async function removePaymentProvider(
  provider: PaymentProviderId,
  updatedBy: number,
) {
  await getD1()
    .prepare(
      `INSERT INTO payment_provider_settings
        (provider, enabled, test_mode, is_primary, encrypted_credentials,
         credential_hint, updated_by, updated_at)
       VALUES (?, 0, 1, 0, '', '', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(provider) DO UPDATE SET
         enabled = 0,
         is_primary = 0,
         encrypted_credentials = '',
         credential_hint = '',
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(provider, updatedBy)
    .run();
}
