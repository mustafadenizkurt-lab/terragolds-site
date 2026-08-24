export type ShippingTrackingSettings = {
  manualDeliveryEnabled: boolean;
  automaticTrackingEnabled: boolean;
  providerName: string;
  apiBaseUrl: string;
  configured: boolean;
  credentialHint: string;
};

export const defaultShippingTrackingSettings: ShippingTrackingSettings = {
  manualDeliveryEnabled: true,
  automaticTrackingEnabled: false,
  providerName: "",
  apiBaseUrl: "",
  configured: false,
  credentialHint: "",
};
