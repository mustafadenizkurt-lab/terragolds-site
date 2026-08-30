import * as accountOrders from "../app/api/account/orders/route";
import * as accountPassword from "../app/api/account/password/route";
import * as accountPaymentMethods from "../app/api/account/payment-methods/route";
import * as accountPaymentMethodById from "../app/api/account/payment-methods/[id]/route";
import * as accountProfile from "../app/api/account/profile/route";
import * as adminAlerts from "../app/api/admin/alerts/route";
import * as adminCategories from "../app/api/admin/categories/route";
import * as adminCategoryById from "../app/api/admin/categories/[id]/route";
import * as adminContent from "../app/api/admin/content/route";
import * as adminCustomers from "../app/api/admin/customers/route";
import * as adminDashboard from "../app/api/admin/dashboard/route";
import * as adminDiscountCodes from "../app/api/admin/discount-codes/route";
import * as adminDiscountCodeById from "../app/api/admin/discount-codes/[id]/route";
import * as adminPaymentMethods from "../app/api/admin/payment-methods/route";
import * as adminPaymentMethodById from "../app/api/admin/payment-methods/[id]/route";
import * as adminPaymentProviders from "../app/api/admin/payment-providers/route";
import * as adminPaymentProviderById from "../app/api/admin/payment-providers/[provider]/route";
import * as adminProducts from "../app/api/admin/products/route";
import * as adminProductById from "../app/api/admin/products/[id]/route";
import * as adminProductsBulk from "../app/api/admin/products/bulk/route";
import * as adminReturnRequests from "../app/api/admin/return-requests/route";
import * as adminReturnRequestById from "../app/api/admin/return-requests/[id]/route";
import * as adminSettings from "../app/api/admin/settings/route";
import * as adminShipping from "../app/api/admin/shipping/route";
import * as adminShippingSettings from "../app/api/admin/shipping-settings/route";
import * as adminSupplierImportPreview from "../app/api/admin/supplier-import/preview/route";
import * as adminSupplierImportCommit from "../app/api/admin/supplier-import/commit/route";
import * as adminSystemTests from "../app/api/admin/system-tests/route";
import * as adminUpload from "../app/api/admin/upload/route";
import * as adminXmlSuppliers from "../app/api/admin/xml-suppliers/route";
import * as adminXmlSupplierLogs from "../app/api/admin/xml-suppliers/logs/route";
import * as adminXmlSupplierSync from "../app/api/admin/xml-suppliers/sync/route";
import * as adminXmlSupplierById from "../app/api/admin/xml-suppliers/[id]/route";
import * as authEmailVerificationSend from "../app/api/auth/email-verification/send/route";
import * as authEmailVerificationVerify from "../app/api/auth/email-verification/verify/route";
import * as authForgotPassword from "../app/api/auth/forgot-password/route";
import * as authLogin from "../app/api/auth/login/route";
import * as authLogout from "../app/api/auth/logout/route";
import * as authMe from "../app/api/auth/me/route";
import * as authRegister from "../app/api/auth/register/route";
import * as authResetPassword from "../app/api/auth/reset-password/route";
import * as cartQuote from "../app/api/cart/quote/route";
import * as checkoutEmailVerificationSend from "../app/api/checkout/email-verification/send/route";
import * as checkoutEmailVerificationVerify from "../app/api/checkout/email-verification/verify/route";
import * as checkoutPayment from "../app/api/checkout/payment/route";
import * as checkoutShopier from "../app/api/checkout/shopier/route";
import * as content from "../app/api/content/route";
import * as favoritesSync from "../app/api/favorites/sync/route";
import * as mediaByKey from "../app/api/media/[...key]/route";
import * as iyzicoCallback from "../app/api/payments/iyzico/callback/route";
import * as paymentMethods from "../app/api/payments/methods/route";
import * as paytrCallback from "../app/api/payments/paytr/callback/route";
import * as shopierPaymentCallback from "../app/api/payments/shopier/callback/route";
import * as productById from "../app/api/products/[id]/route";
import * as productReviews from "../app/api/products/[id]/reviews/route";
import * as returnsRequest from "../app/api/returns/request/route";
import * as legacyShopierCallback from "../app/api/shopier/callback/route";
import * as store from "../app/api/store/route";

type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

type RouteHandler = (
  request: Request,
  context: RouteContext,
) => Response | Promise<Response>;

type RouteModule = Record<string, unknown>;

const exactRoutes: Record<string, RouteModule> = {
  "/api/account/orders": accountOrders,
  "/api/account/password": accountPassword,
  "/api/account/payment-methods": accountPaymentMethods,
  "/api/account/profile": accountProfile,
  "/api/admin/alerts": adminAlerts,
  "/api/admin/categories": adminCategories,
  "/api/admin/content": adminContent,
  "/api/admin/customers": adminCustomers,
  "/api/admin/dashboard": adminDashboard,
  "/api/admin/discount-codes": adminDiscountCodes,
  "/api/admin/payment-methods": adminPaymentMethods,
  "/api/admin/payment-providers": adminPaymentProviders,
  "/api/admin/products": adminProducts,
  "/api/admin/products/bulk": adminProductsBulk,
  "/api/admin/return-requests": adminReturnRequests,
  "/api/admin/settings": adminSettings,
  "/api/admin/shipping": adminShipping,
  "/api/admin/shipping-settings": adminShippingSettings,
  "/api/admin/supplier-import/preview": adminSupplierImportPreview,
  "/api/admin/supplier-import/commit": adminSupplierImportCommit,
  "/api/admin/system-tests": adminSystemTests,
  "/api/admin/upload": adminUpload,
  "/api/admin/xml-suppliers": adminXmlSuppliers,
  "/api/admin/xml-suppliers/logs": adminXmlSupplierLogs,
  "/api/admin/xml-suppliers/sync": adminXmlSupplierSync,
  "/api/auth/email-verification/send": authEmailVerificationSend,
  "/api/auth/email-verification/verify": authEmailVerificationVerify,
  "/api/auth/forgot-password": authForgotPassword,
  "/api/auth/login": authLogin,
  "/api/auth/logout": authLogout,
  "/api/auth/me": authMe,
  "/api/auth/register": authRegister,
  "/api/auth/reset-password": authResetPassword,
  "/api/cart/quote": cartQuote,
  "/api/checkout/email-verification/send": checkoutEmailVerificationSend,
  "/api/checkout/email-verification/verify": checkoutEmailVerificationVerify,
  "/api/checkout/payment": checkoutPayment,
  "/api/checkout/shopier": checkoutShopier,
  "/api/content": content,
  "/api/favorites/sync": favoritesSync,
  "/api/payments/iyzico/callback": iyzicoCallback,
  "/api/payments/methods": paymentMethods,
  "/api/payments/paytr/callback": paytrCallback,
  "/api/payments/shopier/callback": shopierPaymentCallback,
  "/api/returns/request": returnsRequest,
  "/api/shopier/callback": legacyShopierCallback,
  "/api/store": store,
};

const dynamicRoutes: {
  pattern: RegExp;
  module: RouteModule;
  params(match: RegExpMatchArray): Record<string, string | string[]>;
}[] = [
  {
    pattern: /^\/api\/admin\/xml-suppliers\/([^/]+)$/,
    module: adminXmlSupplierById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/account\/payment-methods\/([^/]+)$/,
    module: accountPaymentMethodById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/categories\/([^/]+)$/,
    module: adminCategoryById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/discount-codes\/([^/]+)$/,
    module: adminDiscountCodeById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/payment-methods\/([^/]+)$/,
    module: adminPaymentMethodById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/payment-providers\/([^/]+)$/,
    module: adminPaymentProviderById,
    params: (match) => ({ provider: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/products\/([^/]+)$/,
    module: adminProductById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/admin\/return-requests\/([^/]+)$/,
    module: adminReturnRequestById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/media\/(.+)$/,
    module: mediaByKey,
    params: (match) => ({
      key: (match[1] ?? "").split("/").map((part) => decodeURIComponent(part)),
    }),
  },
  {
    pattern: /^\/api\/products\/([^/]+)\/reviews$/,
    module: productReviews,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
  {
    pattern: /^\/api\/products\/([^/]+)$/,
    module: productById,
    params: (match) => ({ id: decodeURIComponent(match[1] ?? "") }),
  },
];

function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

async function runRoute(
  routeModule: RouteModule,
  request: Request,
  params: Record<string, string | string[]> = {},
) {
  const handler = routeModule[request.method.toUpperCase()];
  if (!handler) {
    return Response.json(
      { error: "Bu API yöntemi desteklenmiyor." },
      { status: 405 },
    );
  }
  return (handler as RouteHandler)(request, { params: Promise.resolve(params) });
}

export async function dispatchApiRequest(request: Request) {
  const pathname = normalizePath(new URL(request.url).pathname);
  const exactRoute = exactRoutes[pathname];
  if (exactRoute) return runRoute(exactRoute, request);

  for (const route of dynamicRoutes) {
    const match = pathname.match(route.pattern);
    if (match) return runRoute(route.module, request, route.params(match));
  }

  return null;
}
