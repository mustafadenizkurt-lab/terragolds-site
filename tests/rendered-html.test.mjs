import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("storefront is connected to managed products and settings", async () => {
  const [page, support, data, storeDb, hosting] = await Promise.all([
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/support/page.tsx", root), "utf8"),
    readFile(new URL("lib/store-data.ts", root), "utf8"),
    readFile(new URL("lib/store-db.ts", root), "utf8"),
    readFile(new URL("config/hosting.json", root), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/store"/);
  assert.match(page, /ÖDEMEYE GEÇ/);
  assert.match(page, /\/api\/payments\/methods/);
  assert.match(page, /className="search-glyph"/);
  assert.match(page, /className="account-dropdown"/);
  assert.match(page, /href="\/support"/);
  assert.match(page, /settings\.facebook/);
  assert.match(page, /Facebook/);
  assert.match(page, /className="announcement-social"/);
  assert.match(page, /simple-icons@v16\/icons\/whatsapp\.svg/);
  assert.match(page, /simple-icons@v16\/icons\/instagram\.svg/);
  assert.match(page, /simple-icons@v16\/icons\/facebook\.svg/);
  assert.match(page, /aria-label="İletişim"/);
  assert.match(support, /settings\.email/);
  assert.match(support, /settings\.mapUrl/);
  assert.match(data, /defaultProducts/);
  assert.match(
    data,
    /https:\/\/www\.facebook\.com\/profile\.php\?id=61592677166035/,
  );
  assert.match(data, /https:\/\/www\.instagram\.com\/terragolds\//);
  assert.match(storeDb, /defaultProducts\.map/);
  assert.match(storeDb, /ON CONFLICT\(id\) DO UPDATE/);
  assert.deepEqual(JSON.parse(hosting), {
    project_id: "appgprj_6a663877a08c819180a57c8c10a929e6",
    d1: "DB",
    r2: "MEDIA",
  });
});

test("admin surface includes product and contact management", async () => {
  const [admin, schema, settingsRoute] = await Promise.all([
    readFile(new URL("app/admin/admin-client.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/admin/settings/route.ts", root), "utf8"),
  ]);

  assert.match(admin, /Yeni ürün/);
  assert.match(admin, /İletişim ve konum bilgileri/);
  assert.match(admin, /Google Maps bağlantısı/);
  assert.match(admin, /settings\.facebook/);
  assert.match(admin, /Facebook/);
  assert.match(schema, /storeSettings/);
  assert.match(settingsRoute, /ON CONFLICT\(key\) DO UPDATE/);
});

test("database schema and generated migration include customer orders", async () => {
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  const migrationDirectory = new URL("drizzle/", root);
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.match(schema, /export const users/);
  assert.match(schema, /export const orders/);
  assert.match(schema, /export const orderItems/);
  assert.match(schema, /pending/);
  assert.match(schema, /paid/);
  assert.match(schema, /failed/);
  assert.match(schema, /shipped/);
  assert.match(schema, /delivered/);
  assert.match(schema, /cancelled/);
  assert.match(schema, /paymentId/);

  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");

  for (const migrationFile of migrationFiles) {
    const sql = await readFile(new URL(migrationFile, migrationDirectory), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) database.exec(statement);
    }
  }

  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map(({ name }) => name);

  assert.ok(tables.includes("users"));
  assert.ok(tables.includes("orders"));
  assert.ok(tables.includes("order_items"));
  assert.ok(tables.includes("product_reviews"));
  assert.ok(tables.includes("product_favorites"));
  assert.ok(tables.includes("shipping_tracking_settings"));
  assert.ok(tables.includes("email_verification_tokens"));
  assert.ok(tables.includes("system_test_runs"));
  const orderColumns = database
    .prepare("PRAGMA table_info(orders)")
    .all()
    .map(({ name }) => name);
  assert.ok(orderColumns.includes("shipping_carrier"));
  assert.ok(orderColumns.includes("tracking_number"));
  assert.ok(orderColumns.includes("shipped_at"));
  assert.ok(orderColumns.includes("delivered_at"));
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  database.close();
});

test("account email verification and the system test center remain available", async () => {
  const [
    schema,
    checkout,
    verification,
    accountSend,
    storefront,
    admin,
    testRoute,
    testCenter,
    migration,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("lib/checkout-order.ts", root), "utf8"),
    readFile(new URL("lib/email-verification.ts", root), "utf8"),
    readFile(
      new URL("app/api/auth/email-verification/send/route.ts", root),
      "utf8",
    ),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/admin/admin-client.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/system-tests/route.ts", root), "utf8"),
    readFile(new URL("app/admin/system-test-center.tsx", root), "utf8"),
    readFile(
      new URL("drizzle/0010_email_verification_tests.sql", root),
      "utf8",
    ),
  ]);

  assert.match(schema, /emailVerificationTokens/);
  assert.match(schema, /systemTestRuns/);
  assert.match(schema, /emailVerifiedAt/);
  assert.doesNotMatch(checkout, /getVerifiedCheckoutEmail/);
  assert.doesNotMatch(checkout, /customer\.emailVerifiedAt/);
  assert.match(verification, /HMAC/);
  assert.match(verification, /30 \* 60 \* 1000/);
  assert.match(verification, /attempts >= 5/);
  assert.match(accountSend, /createEmailVerification/);
  assert.doesNotMatch(storefront, /E-postanızı doğrulayın/);
  assert.match(admin, /SystemTestCenter/);
  assert.match(admin, /Sistem test merkezi/);
  assert.match(testRoute, /simulate-purchase/);
  assert.match(
    testRoute,
    /gerçek sipariş, ödeme veya stok değişikliği yapılmadı/i,
  );
  assert.match(testCenter, /Satın alma simülasyonu/);
  assert.match(testCenter, /Test e-postası gönder/);
  assert.match(migration, /email_verification_tokens/);
  assert.match(migration, /system_test_runs/);
});

test("payment providers use server-side totals, encrypted credentials and signed callbacks", async () => {
  const [checkout, cartPricing, gateways, crypto, shopierCallback, paytrCallback, orderPayment] =
    await Promise.all([
      readFile(new URL("lib/checkout-order.ts", root), "utf8"),
      readFile(new URL("lib/cart-pricing.ts", root), "utf8"),
      readFile(new URL("lib/payment-gateways.ts", root), "utf8"),
      readFile(new URL("lib/payment-crypto.ts", root), "utf8"),
      readFile(new URL("lib/shopier-callback.ts", root), "utf8"),
      readFile(
        new URL("app/api/payments/paytr/callback/route.ts", root),
        "utf8",
      ),
      readFile(new URL("lib/order-payment.ts", root), "utf8"),
    ]);

  assert.match(checkout, /calculateCartQuote/);
  assert.match(cartPricing, /discount_percent AS discountPercent/);
  assert.match(cartPricing, /getDiscountedPrice/);
  assert.match(checkout, /db\.batch/);
  assert.match(gateways, /initializeShopierPayment/);
  assert.match(gateways, /initializePaytrPayment/);
  assert.match(gateways, /initializeIyzicoPayment/);
  assert.match(crypto, /AES-GCM/);
  assert.match(crypto, /PAYMENT_CONFIG_ENCRYPTION_KEY/);
  assert.match(shopierCallback, /invalid signature/i);
  assert.match(paytrCallback, /PAYTR notification failed: bad hash/);
  assert.match(orderPayment, /status = 'paid'/);
  assert.match(orderPayment, /stock = CASE/);
  assert.match(orderPayment, /status IN \('pending', 'failed'\)/);
});

test("password recovery, discounts, shipping and search discovery are connected", async () => {
  const [
    schema,
    forgotPassword,
    resetPassword,
    cartPricing,
    cartQuote,
    adminDiscounts,
    shippingSettings,
    storefront,
    sitemap,
    robots,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/auth/forgot-password/route.ts", root), "utf8"),
    readFile(new URL("app/api/auth/reset-password/route.ts", root), "utf8"),
    readFile(new URL("lib/cart-pricing.ts", root), "utf8"),
    readFile(new URL("app/api/cart/quote/route.ts", root), "utf8"),
    readFile(new URL("app/admin/discount-codes-panel.tsx", root), "utf8"),
    readFile(new URL("app/admin/payment-providers-panel.tsx", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/sitemap.xml/route.ts", root), "utf8"),
    readFile(new URL("app/robots.txt/route.ts", root), "utf8"),
  ]);

  assert.match(schema, /passwordResetTokens/);
  assert.match(schema, /discountCodes/);
  assert.match(schema, /sessionVersion/);
  assert.match(forgotPassword, /SHA-256/);
  assert.match(forgotPassword, /30 \* 60 \* 1000/);
  assert.match(resetPassword, /session_version = session_version \+ 1/);
  assert.match(cartPricing, /freeShippingThreshold/);
  assert.match(cartPricing, /discountedSubtotal >= freeShippingThreshold/);
  assert.match(cartPricing, /CartUnavailableProductError/);
  assert.match(cartQuote, /calculateCartQuote/);
  assert.match(cartQuote, /UNAVAILABLE_PRODUCTS/);
  assert.match(adminDiscounts, /Minimum sepet/);
  assert.match(shippingSettings, /Ücretsiz kargo alt limiti/);
  assert.match(storefront, /Sepet Özeti/);
  assert.match(storefront, /Kargo Tutarı/);
  assert.match(storefront, /reconcileCartWithProducts/);
  assert.match(storefront, /İndirim kodu/);
  assert.match(storefront, /Sipariş açıklaması/);
  assert.match(storefront, /name="note"/);
  assert.match(storefront, /maxLength=\{500\}/);
  assert.match(sitemap, /sitemaps\.org/);
  assert.match(robots, /Sitemap:/);
});

test("product campaigns and quantity-based cart are wired end to end", async () => {
  const [page, admin, schema, productInput, migration] = await Promise.all([
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/admin/admin-client.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("lib/product-input.ts", root), "utf8"),
    readFile(new URL("drizzle/0002_product_campaigns.sql", root), "utf8"),
  ]);

  assert.match(schema, /campaignLabel/);
  assert.match(schema, /discountPercent/);
  assert.match(productInput, /Math\.min\(\s*90/);
  assert.match(migration, /campaign_label/);
  assert.match(migration, /discount_percent/);
  assert.match(admin, /İndirim ve fırsat etiketi/);
  assert.match(admin, /Haftanın Fırsatı/);
  assert.match(page, /type CartEntry/);
  assert.match(page, /addCooldownUntil/);
  assert.match(page, /addCooldownSeconds > 0/);
  assert.match(page, /sn bekleyin/);
  assert.match(page, /className="quantity-picker cart-quantity"/);
  assert.match(page, /className="cart-remove-icon"/);
  assert.match(page, /className="trash-icon"/);
  assert.match(page, /src="\/empty-cart\.png"/);
});

test("minimal login and dedicated support centre are connected", async () => {
  const [authForm, accountHeader, recoveryForm, support, defaultContent, subpageHeader, styles, sitemap] =
    await Promise.all([
      readFile(new URL("app/account/auth-form.tsx", root), "utf8"),
      readFile(new URL("app/account/account-header.tsx", root), "utf8"),
      readFile(new URL("app/account/password-recovery-form.tsx", root), "utf8"),
      readFile(new URL("app/support/page.tsx", root), "utf8"),
      readFile(new URL("lib/site-content-types.ts", root), "utf8"),
      readFile(new URL("app/store-subpage-header.tsx", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
      readFile(new URL("app/sitemap.xml/route.ts", root), "utf8"),
    ]);

  assert.match(authForm, /login-minimal/);
  assert.match(authForm, /register-minimal/);
  assert.match(authForm, /login-card-tabs/);
  assert.match(authForm, /href="\/support"/);
  assert.match(authForm, /TERRA<strong>GOLDS<\/strong>/);
  assert.match(accountHeader, /TERRA<strong>GOLDS<\/strong>/);
  assert.match(recoveryForm, /TERRA<strong>GOLDS<\/strong>/);
  assert.match(support, /content\.supportEyebrow/);
  assert.match(defaultContent, /Yardım merkezi/);
  assert.match(support, /id="shipping"/);
  assert.match(support, /id="returns"/);
  assert.match(support, /id="care"/);
  assert.match(subpageHeader, /className="account-menu-button"/);
  assert.match(styles, /\.cart-remove-icon/);
  assert.match(styles, /\.search-glyph::after/);
  assert.match(sitemap, /\/support/);
});

test("verified reviews, product profiles and favorites are connected", async () => {
  const [schema, reviewRoute, productPage, favoritesPage, storefront, styles] =
    await Promise.all([
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(
        new URL("app/api/products/[id]/reviews/route.ts", root),
        "utf8",
      ),
      readFile(
        new URL("app/products/[id]/product-detail-client.tsx", root),
        "utf8",
      ),
      readFile(new URL("app/favorites/favorites-client.tsx", root), "utf8"),
      readFile(new URL("app/home-client.tsx", root), "utf8"),
      readFile(new URL("app/globals.css", root), "utf8"),
    ]);

  assert.match(schema, /export const productReviews/);
  assert.match(schema, /product_reviews_user_product_unique/);
  assert.match(
    reviewRoute,
    /orders\.status IN \('paid', 'shipped', 'delivered'\)/,
  );
  assert.match(reviewRoute, /Yalnızca bu ürünü satın alan üyeler/);
  assert.match(productPage, /Müşteri yorumları/);
  assert.match(productPage, /Doğrulanmış alışveriş/);
  assert.match(productPage, /profile-heart/);
  assert.match(favoritesPage, /terragolds-liked/);
  assert.match(storefront, /header-favorites/);
  assert.match(storefront, /product-collection-highlight/);
  assert.match(styles, /background-position 720ms/);
  assert.match(styles, /\.product-info \.price-display strong/);
});

test("customer credentials are hashed and account endpoints are protected", async () => {
  const [register, login, profile, orders, customerAuth, customerName, schema, adminAuth, roleMigration] =
    await Promise.all([
      readFile(new URL("app/api/auth/register/route.ts", root), "utf8"),
      readFile(new URL("app/api/auth/login/route.ts", root), "utf8"),
      readFile(new URL("app/api/account/profile/route.ts", root), "utf8"),
      readFile(new URL("app/api/account/orders/route.ts", root), "utf8"),
      readFile(new URL("lib/customer-auth.ts", root), "utf8"),
      readFile(new URL("lib/customer-name.ts", root), "utf8"),
      readFile(new URL("db/schema.ts", root), "utf8"),
      readFile(new URL("lib/admin-auth.ts", root), "utf8"),
      readFile(new URL("drizzle/0004_user_roles.sql", root), "utf8"),
    ]);

  assert.match(register, /hash\(password, 12\)/);
  assert.match(register, /normalizeCustomerName/);
  assert.match(login, /compare\(password, user\.password_hash\)/);
  assert.match(profile, /getCustomerFromRequest/);
  assert.match(profile, /normalizeCustomerName/);
  assert.match(orders, /getCustomerFromRequest/);
  assert.match(customerAuth, /normalizeCustomerName\(user\.first_name\)/);
  assert.match(customerName, /toLocaleUpperCase\("tr-TR"\)/);
  assert.match(schema, /role: text\("role"\)/);
  assert.match(roleMigration, /ADD `role` text DEFAULT 'customer' NOT NULL/);
  assert.match(adminAuth, /databaseRole\?\.role !== "admin"/);
  assert.match(adminAuth, /emailIsAllowed/);
});

test("admin uploads enforce MIME, extension, signature and a 5 MB limit", async () => {
  const upload = await readFile(new URL("app/api/admin/upload/route.ts", root), "utf8");

  assert.match(upload, /5 \* 1024 \* 1024/);
  assert.match(upload, /image\/jpeg/);
  assert.match(upload, /image\/png/);
  assert.match(upload, /image\/webp/);
  assert.doesNotMatch(upload, /image\/avif/);
  assert.match(upload, /hasValidMagicBytes/);
});

test("admin analytics, bulk operations, durable favorites and shipping are connected", async () => {
  const [
    schema,
    dashboardRoute,
    shippingRoute,
    bulkRoute,
    admin,
    dashboard,
    shipping,
    favoriteSync,
    migration,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/admin/dashboard/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/shipping/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/products/bulk/route.ts", root), "utf8"),
    readFile(new URL("app/admin/admin-client.tsx", root), "utf8"),
    readFile(new URL("app/admin/dashboard-overview.tsx", root), "utf8"),
    readFile(new URL("app/admin/shipping-panel.tsx", root), "utf8"),
    readFile(new URL("app/api/favorites/sync/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0007_admin_operations.sql", root), "utf8"),
  ]);

  assert.match(schema, /export const productFavorites/);
  assert.match(schema, /shippingCarrier/);
  assert.match(dashboardRoute, /periodLabels/);
  assert.match(dashboardRoute, /DashboardPeriod/);
  assert.match(dashboardRoute, /discount_amount/);
  assert.match(dashboardRoute, /items_sold/);
  assert.match(dashboardRoute, /percentChange/);
  assert.match(dashboardRoute, /low_stock_products/);
  assert.match(dashboardRoute, /COUNT\(product_favorites\.id\)/);
  assert.match(dashboard, /Günlük/);
  assert.match(dashboard, /Haftalık/);
  assert.match(dashboard, /Aylık/);
  assert.match(dashboard, /Yıllık/);
  assert.match(dashboard, /Sıfırla/);
  assert.match(dashboard, /Başarılı ödeme oranı/);
  assert.match(dashboard, /Satış ve gelir/);
  assert.match(dashboard, /Stok durumu/);
  assert.match(dashboard, /En çok favorilenenler/);
  assert.match(bulkRoute, /increase-stock/);
  assert.match(bulkRoute, /set-discount/);
  assert.match(admin, /Toplu ürün güncelleme/);
  assert.match(admin, /Kargo/);
  assert.match(shippingRoute, /tracking_number/);
  assert.match(shippingRoute, /subtotal_amount/);
  assert.match(shippingRoute, /discount_code/);
  assert.match(shippingRoute, /status === "shipped"/);
  assert.match(shippingRoute, /status === "delivered"/);
  assert.match(shipping, /Hazırlanacak sipariş/);
  assert.match(shipping, /ORDERS_PER_PAGE = 10/);
  assert.match(shipping, /expandedOrderId/);
  assert.match(shipping, /aria-expanded=\{expanded\}/);
  assert.match(shipping, /Ayrıntıları göster/);
  assert.match(shipping, /admin-shipping-pagination/);
  assert.match(shipping, /Takip numarası/);
  assert.match(shipping, /İndirim kodu kullanıldı mı\?/);
  assert.match(shipping, /Birim fiyat:/);
  assert.match(shipping, /Müşteri açıklaması/);
  assert.match(favoriteSync, /product_favorites/);
  assert.match(migration, /CREATE TABLE `product_favorites`/);
  assert.match(migration, /ADD `shipping_carrier`/);
});

test("manual delivery completion and protected carrier API settings are connected", async () => {
  const [
    schema,
    shippingRoute,
    settingsRoute,
    settingsStore,
    settingsPanel,
    shippingPanel,
    ordersPage,
    dashboard,
    migration,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("app/api/admin/shipping/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/shipping-settings/route.ts", root), "utf8"),
    readFile(new URL("lib/shipping-tracking-settings.ts", root), "utf8"),
    readFile(new URL("app/admin/shipping-tracking-settings.tsx", root), "utf8"),
    readFile(new URL("app/admin/shipping-panel.tsx", root), "utf8"),
    readFile(new URL("app/orders/orders-client.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/dashboard/route.ts", root), "utf8"),
    readFile(new URL("drizzle/0008_delivery_tracking.sql", root), "utf8"),
  ]);

  assert.match(schema, /shippingTrackingSettings/);
  assert.match(schema, /deliveredAt/);
  assert.match(schema, /'delivered'/);
  assert.match(shippingRoute, /delivered_at/);
  assert.match(shippingRoute, /current\.status === "shipped"/);
  assert.match(settingsRoute, /isSameOriginRequest/);
  assert.match(settingsStore, /encryptPaymentCredentials/);
  assert.match(settingsStore, /encrypted_credentials/);
  assert.doesNotMatch(settingsRoute, /decryptPaymentCredentials/);
  assert.match(settingsPanel, /Manuel teslimat onayı/);
  assert.match(settingsPanel, /Otomatik kargo takibini hazırla/);
  assert.match(settingsPanel, /API anahtarı/);
  assert.match(shippingPanel, /Teslim edildi/);
  assert.match(shippingPanel, /manualDeliveryEnabled/);
  assert.match(ordersPage, /delivered: "Teslim edildi"/);
  assert.match(dashboard, /'paid', 'shipped', 'delivered'/);
  assert.match(migration, /CREATE TABLE `shipping_tracking_settings`/);
  assert.match(migration, /`delivered_at` text/);
});

test("admin catalog pagination, categories and managed page content are connected", async () => {
  const [
    schema,
    migration,
    admin,
    bulkRoute,
    categoriesRoute,
    contentRoute,
    contentStore,
    storefront,
    supportPage,
  ] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0009_content_catalog.sql", root), "utf8"),
    readFile(new URL("app/admin/admin-client.tsx", root), "utf8"),
    readFile(new URL("app/api/admin/products/bulk/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/categories/route.ts", root), "utf8"),
    readFile(new URL("app/api/admin/content/route.ts", root), "utf8"),
    readFile(new URL("lib/site-content.ts", root), "utf8"),
    readFile(new URL("app/home-client.tsx", root), "utf8"),
    readFile(new URL("app/support/page.tsx", root), "utf8"),
  ]);

  assert.match(schema, /export const productCategories/);
  assert.match(schema, /export const siteContent/);
  assert.match(migration, /CREATE TABLE `product_categories`/);
  assert.match(migration, /CREATE TABLE `site_content`/);
  assert.match(migration, /INSERT OR IGNORE INTO `product_categories`/);
  assert.match(admin, /PRODUCTS_PER_PAGE = 10/);
  assert.match(admin, /admin-product-pagination/);
  assert.match(admin, /Kategoriye taşı/);
  assert.match(admin, /ContentManagementPanel/);
  assert.match(admin, /CategoriesPanel/);
  assert.match(bulkRoute, /set-category/);
  assert.match(categoriesRoute, /isSameOriginRequest/);
  assert.match(contentRoute, /saveSiteContent/);
  assert.match(contentStore, /published_value/);
  assert.match(storefront, /managedContent\.homeHeroTitle/);
  assert.match(storefront, /managedCategories/);
  assert.match(supportPage, /content\.supportShippingBody/);
});

test("environment template documents required payment and session secrets", async () => {
  const envExample = await readFile(new URL(".env.example", root), "utf8");

  assert.match(envExample, /^SHOPIER_API_KEY=/m);
  assert.match(envExample, /^SHOPIER_SECRET_KEY=/m);
  assert.match(envExample, /^SHOPIER_PAYMENT_URL=/m);
  assert.match(envExample, /^PAYMENT_CONFIG_ENCRYPTION_KEY=/m);
  assert.match(envExample, /^NEXT_AUTH_SECRET=/m);
  assert.match(envExample, /^RESEND_API_KEY=/m);
  assert.match(envExample, /^TRANSACTIONAL_EMAIL_FROM=/m);
  assert.match(envExample, /^PASSWORD_RESET_FROM_EMAIL=/m);
  assert.match(envExample, /^EMAIL_VERIFICATION_DEV_MODE=/m);
  assert.match(envExample, /^GOOGLE_SITE_VERIFICATION=/m);
});
