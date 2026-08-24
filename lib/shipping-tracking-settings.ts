import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
} from "./payment-crypto";
import {
  defaultShippingTrackingSettings,
  type ShippingTrackingSettings,
} from "./shipping-tracking-types";
import { getD1 } from "./store-db";

const ENCRYPTION_SCOPE = "shipping_tracking";

type ShippingTrackingRow = {
  manual_delivery_enabled: number;
  automatic_tracking_enabled: number;
  provider_name: string;
  api_base_url: string;
  encrypted_credentials: string;
  credential_hint: string;
};

function summaryFromRow(
  row: ShippingTrackingRow | null,
): ShippingTrackingSettings {
  if (!row) return defaultShippingTrackingSettings;
  return {
    manualDeliveryEnabled: Boolean(row.manual_delivery_enabled),
    automaticTrackingEnabled: Boolean(row.automatic_tracking_enabled),
    providerName: row.provider_name,
    apiBaseUrl: row.api_base_url,
    configured: Boolean(
      row.provider_name &&
        row.api_base_url &&
        row.encrypted_credentials,
    ),
    credentialHint: row.credential_hint,
  };
}

export async function getShippingTrackingSettings() {
  const row = await getD1()
    .prepare(
      `SELECT manual_delivery_enabled, automatic_tracking_enabled,
              provider_name, api_base_url, encrypted_credentials,
              credential_hint
       FROM shipping_tracking_settings
       WHERE id = 1`,
    )
    .first<ShippingTrackingRow>();
  return summaryFromRow(row);
}

function credentialHint(apiKey: string) {
  const suffix = apiKey.slice(-4);
  return suffix ? `•••• ${suffix}` : "";
}

export async function saveShippingTrackingSettings(input: {
  manualDeliveryEnabled: boolean;
  automaticTrackingEnabled: boolean;
  providerName: string;
  apiBaseUrl: string;
  apiKey: string;
  accountCode: string;
  updatedBy: number;
}) {
  const providerName = input.providerName.trim().slice(0, 100);
  const apiBaseUrl = input.apiBaseUrl.trim().slice(0, 500);
  if (apiBaseUrl && !/^https:\/\//i.test(apiBaseUrl)) {
    throw new Error("Kargo API adresi https:// ile başlamalıdır.");
  }

  const current = await getD1()
    .prepare(
      `SELECT encrypted_credentials
       FROM shipping_tracking_settings
       WHERE id = 1`,
    )
    .first<{ encrypted_credentials: string }>();
  const credentials =
    current?.encrypted_credentials
      ? await decryptPaymentCredentials(
          ENCRYPTION_SCOPE,
          current.encrypted_credentials,
        )
      : {};
  const apiKey = input.apiKey.trim().slice(0, 1000);
  const accountCode = input.accountCode.trim().slice(0, 300);
  if (apiKey) credentials.apiKey = apiKey;
  if (accountCode) credentials.accountCode = accountCode;

  const encryptedCredentials = Object.keys(credentials).length
    ? await encryptPaymentCredentials(ENCRYPTION_SCOPE, credentials)
    : "";
  const hint = credentials.apiKey
    ? credentialHint(credentials.apiKey)
    : "";

  await getD1()
    .prepare(
      `INSERT INTO shipping_tracking_settings
        (id, manual_delivery_enabled, automatic_tracking_enabled,
         provider_name, api_base_url, encrypted_credentials,
         credential_hint, updated_by, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         manual_delivery_enabled = excluded.manual_delivery_enabled,
         automatic_tracking_enabled = excluded.automatic_tracking_enabled,
         provider_name = excluded.provider_name,
         api_base_url = excluded.api_base_url,
         encrypted_credentials = excluded.encrypted_credentials,
         credential_hint = excluded.credential_hint,
         updated_by = excluded.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(
      input.manualDeliveryEnabled ? 1 : 0,
      input.automaticTrackingEnabled ? 1 : 0,
      providerName,
      apiBaseUrl,
      encryptedCredentials,
      hint,
      input.updatedBy,
    )
    .run();

  return getShippingTrackingSettings();
}
