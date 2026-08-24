import {
  getRequestIp,
  savePaymentReference,
  type createCheckoutOrder,
} from "./checkout-order";
import { getPaymentProvider } from "./payment-providers";
import {
  constantTimeEquals,
  hmacSha256,
  utf8ToBase64,
} from "./payment-signatures";
import type { PaymentProviderId } from "./payment-types";

type CheckoutOrder = Awaited<ReturnType<typeof createCheckoutOrder>>;

type GatewayResult =
  | {
      orderId: string;
      redirectUrl: string;
    }
  | {
      orderId: string;
      action: string;
      method: "POST";
      fields: Record<string, string>;
    };

const SHOPIER_PAYMENT_URL =
  "https://www.shopier.com/ShowProduct/api_pay4.php";
const IYZICO_INITIALIZE_PATH =
  "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const IYZICO_RETRIEVE_PATH =
  "/payment/iyzipos/checkoutform/auth/ecom/detail";

function trustedShopierUrl(value: string | undefined) {
  const paymentUrl = new URL(value || SHOPIER_PAYMENT_URL);
  if (
    paymentUrl.protocol !== "https:" ||
    (paymentUrl.hostname !== "shopier.com" &&
      !paymentUrl.hostname.endsWith(".shopier.com"))
  ) {
    throw new Error("Shopier ödeme adresi güvenilir değil.");
  }
  return paymentUrl.toString();
}

function moneyValue(cents: number) {
  return (cents / 100).toFixed(2);
}

export async function initializeShopierPayment(
  request: Request,
  order: CheckoutOrder,
): Promise<GatewayResult> {
  const provider = await getPaymentProvider("shopier");
  const apiKey = provider.credentials.apiKey;
  const secretKey = provider.credentials.secretKey;
  if (!apiKey || !secretKey) {
    throw new Error("Shopier API bilgileri eksik.");
  }

  const totalValue = moneyValue(order.totalAmount);
  const currencyCode = "0";
  const signature = await hmacSha256(
    `${order.randomNr}${order.id}${totalValue}${currencyCode}`,
    secretKey,
    "base64",
  );
  const productName = order.items
    .map(
      (item) =>
        `${item.product.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
    )
    .join(", ")
    .slice(0, 255);
  const callbackUrl = new URL(
    "/api/payments/shopier/callback",
    request.url,
  ).toString();
  const accountAge = order.customer
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(order.customer.createdAt).getTime()) /
            86_400_000,
        ),
      )
    : 0;

  return {
    orderId: order.id,
    action: trustedShopierUrl(provider.credentials.paymentUrl),
    method: "POST",
    fields: {
      API_key: apiKey,
      website_index: "1",
      platform_order_id: order.id,
      product_name: productName,
      product_type: "0",
      buyer_name: order.customerInput.firstName,
      buyer_surname: order.customerInput.lastName,
      buyer_email: order.customerInput.email,
      buyer_account_age: String(accountAge),
      buyer_id_nr: String(order.customer?.id ?? order.randomNr),
      buyer_phone: order.customerInput.phone,
      billing_address: order.customerInput.address,
      billing_city: order.customerInput.city,
      billing_country: "Turkey",
      billing_postcode: order.customerInput.postcode,
      shipping_address: order.customerInput.address,
      shipping_city: order.customerInput.city,
      shipping_country: "Turkey",
      shipping_postcode: order.customerInput.postcode,
      total_order_value: totalValue,
      currency: currencyCode,
      platform: "0",
      is_in_frame: "0",
      current_language: "0",
      modul_version: "terragolds-2.0.0",
      random_nr: order.randomNr,
      signature,
      callback: callbackUrl,
    },
  };
}

export async function initializePaytrPayment(
  request: Request,
  order: CheckoutOrder,
): Promise<GatewayResult> {
  const provider = await getPaymentProvider("paytr");
  const { merchantId, merchantKey, merchantSalt } = provider.credentials;
  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error("PayTR mağaza bilgileri eksik.");
  }

  const userBasket = utf8ToBase64(
    JSON.stringify(
      [["Terragolds siparişi", moneyValue(order.totalAmount), 1]],
    ),
  );
  const userIp = getRequestIp(request);
  const testMode = provider.testMode ? "1" : "0";
  const noInstallment = "0";
  const maxInstallment = "9";
  const currency = "TL";
  const tokenInput =
    `${merchantId}${userIp}${order.id}${order.customerInput.email}` +
    `${order.totalAmount}${userBasket}${noInstallment}${maxInstallment}` +
    `${currency}${testMode}${merchantSalt}`;
  const paytrToken = await hmacSha256(tokenInput, merchantKey, "base64");
  const resultUrl = new URL("/payment/result", request.url);
  resultUrl.searchParams.set("orderId", order.id);

  const form = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: userIp,
    merchant_oid: order.id,
    email: order.customerInput.email,
    payment_amount: String(order.totalAmount),
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: provider.testMode ? "1" : "0",
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name:
      `${order.customerInput.firstName} ${order.customerInput.lastName}`.trim(),
    user_address: order.customerInput.address,
    user_phone: order.customerInput.phone,
    merchant_ok_url: `${resultUrl.toString()}&status=pending`,
    merchant_fail_url: `${resultUrl.toString()}&status=failed`,
    timeout_limit: "30",
    currency,
    test_mode: testMode,
    lang: "tr",
    iframe_v2: "1",
    iframe_v2_dark: "0",
  });
  const response = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const payload = (await response.json()) as {
    status?: string;
    token?: string;
    reason?: string;
  };
  if (!response.ok || payload.status !== "success" || !payload.token) {
    throw new Error(payload.reason || "PayTR ödeme oturumu oluşturulamadı.");
  }

  await savePaymentReference(order.id, "paytr", payload.token);
  const localPaymentPage = new URL("/payment/paytr", request.url);
  localPaymentPage.searchParams.set("token", payload.token);
  localPaymentPage.searchParams.set("orderId", order.id);
  return { orderId: order.id, redirectUrl: localPaymentPage.toString() };
}

function iyzicoBaseUrl(testMode: boolean) {
  return testMode
    ? "https://sandbox-api.iyzipay.com"
    : "https://api.iyzipay.com";
}

export async function iyzicoRequest<T>(
  provider: Awaited<ReturnType<typeof getPaymentProvider>>,
  path: string,
  body: Record<string, unknown>,
) {
  const { apiKey, secretKey } = provider.credentials;
  if (!apiKey || !secretKey) {
    throw new Error("iyzico API bilgileri eksik.");
  }
  const randomKey = crypto.randomUUID().replaceAll("-", "");
  const serializedBody = JSON.stringify(body);
  const signature = await hmacSha256(
    `${randomKey}${path}${serializedBody}`,
    secretKey,
    "hex",
  );
  const authorization = utf8ToBase64(
    `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`,
  );
  const response = await fetch(`${iyzicoBaseUrl(provider.testMode)}${path}`, {
    method: "POST",
    headers: {
      authorization: `IYZWSv2 ${authorization}`,
      "content-type": "application/json",
      "x-iyzi-rnd": randomKey,
      "x-iyzi-client-version": "terragolds-2.0.0",
    },
    body: serializedBody,
  });
  const payload = (await response.json()) as T & {
    status?: string;
    errorMessage?: string;
  };
  if (!response.ok || payload.status !== "success") {
    throw new Error(payload.errorMessage || "iyzico isteği tamamlanamadı.");
  }
  return payload;
}

export async function verifyIyzicoResponseSignature(
  values: Array<string | number | undefined>,
  signature: string | undefined,
  secretKey: string,
) {
  if (!signature || values.some((value) => value === undefined)) return false;
  const expected = await hmacSha256(
    values.map((value) => String(value)).join(":"),
    secretKey,
    "hex",
  );
  return constantTimeEquals(expected, signature);
}

export function normalizeIyzicoPrice(value: string | number | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toString() : "";
}

export async function initializeIyzicoPayment(
  request: Request,
  order: CheckoutOrder,
): Promise<GatewayResult> {
  const provider = await getPaymentProvider("iyzico");
  const callbackUrl = new URL(
    "/api/payments/iyzico/callback",
    request.url,
  ).toString();
  const price = moneyValue(order.totalAmount);
  const body = {
    locale: "tr",
    conversationId: order.id,
    price,
    paidPrice: price,
    currency: "TRY",
    basketId: order.id,
    paymentGroup: "PRODUCT",
    paymentChannel: "WEB",
    callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: String(order.customer?.id ?? order.randomNr),
      name: order.customerInput.firstName,
      surname: order.customerInput.lastName,
      identityNumber: order.customerInput.identityNumber,
      email: order.customerInput.email,
      gsmNumber: order.customerInput.phone,
      registrationAddress: order.customerInput.address,
      ip: getRequestIp(request),
      city: order.customerInput.city,
      country: "Turkey",
      zipCode: order.customerInput.postcode || "00000",
    },
    shippingAddress: {
      contactName:
        `${order.customerInput.firstName} ${order.customerInput.lastName}`.trim(),
      city: order.customerInput.city,
      country: "Turkey",
      address: order.customerInput.address,
      zipCode: order.customerInput.postcode || "00000",
    },
    billingAddress: {
      contactName:
        `${order.customerInput.firstName} ${order.customerInput.lastName}`.trim(),
      city: order.customerInput.city,
      country: "Turkey",
      address: order.customerInput.address,
      zipCode: order.customerInput.postcode || "00000",
    },
    basketItems: [{
      id: order.id,
      name: order.items
        .map((item) =>
          item.quantity > 1
            ? `${item.product.name} x${item.quantity}`
            : item.product.name,
        )
        .join(", ")
        .slice(0, 180),
      category1: "Doğal Taş",
      itemType: "PHYSICAL",
      price,
    }],
  };
  const result = await iyzicoRequest<{
    conversationId?: string;
    token?: string;
    paymentPageUrl?: string;
    signature?: string;
  }>(provider, IYZICO_INITIALIZE_PATH, body);
  if (!result.token || !result.paymentPageUrl) {
    throw new Error("iyzico ödeme sayfası oluşturulamadı.");
  }
  const signatureIsValid = await verifyIyzicoResponseSignature(
    [result.conversationId, result.token],
    result.signature,
    provider.credentials.secretKey,
  );
  if (!signatureIsValid || result.conversationId !== order.id) {
    throw new Error("iyzico yanıt imzası doğrulanamadı.");
  }
  await savePaymentReference(order.id, "iyzico", result.token);
  return {
    orderId: order.id,
    redirectUrl: result.paymentPageUrl,
  };
}

export function initializePayment(
  provider: PaymentProviderId,
  request: Request,
  order: CheckoutOrder,
) {
  if (provider === "shopier") return initializeShopierPayment(request, order);
  if (provider === "paytr") return initializePaytrPayment(request, order);
  return initializeIyzicoPayment(request, order);
}

export { IYZICO_RETRIEVE_PATH };
