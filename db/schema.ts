import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const xmlSuppliers = sqliteTable(
  "xml_suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    feedUrl: text("feed_url").notNull(),
    fieldMapping: text("field_mapping").notNull().default("{}"),
    filters: text("filters").notNull().default("{}"),
    defaultMarkupPercent: integer("default_markup_percent").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("xml_suppliers_feed_url_unique").on(table.feedUrl),
    index("xml_suppliers_active_idx").on(table.active),
  ],
);

export const xmlSyncLogs = sqliteTable(
  "xml_sync_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    supplierId: integer("supplier_id").references(() => xmlSuppliers.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(),
    startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
    importedCount: integer("imported_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorMessage: text("error_message"),
    details: text("details").notNull().default("{}"),
  },
  (table) => [
    check(
      "xml_sync_logs_status_check",
      sql`${table.status} IN ('running', 'success', 'failed')`,
    ),
    index("xml_sync_logs_supplier_idx").on(table.supplierId, table.startedAt),
  ],
);

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  stone: text("stone").notNull().default(""),
  category: text("category").notNull().default("Doğal Taşlar"),
  price: integer("price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  image: text("image").notNull().default(""),
  hoverImage: text("hover_image"),
  badge: text("badge"),
  campaignLabel: text("campaign_label"),
  discountPercent: integer("discount_percent").notNull().default(0),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  shopierUrl: text("shopier_url"),
  shopierProductId: text("shopier_product_id"),
  shopierSyncStatus: text("shopier_sync_status").notNull().default("manual"),
  xmlSupplierId: integer("xml_supplier_id").references(() => xmlSuppliers.id, {
    onDelete: "set null",
  }),
  xmlExternalId: text("xml_external_id"),
  xmlSyncStatus: text("xml_sync_status").notNull().default("manual"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("products_xml_source_unique").on(table.xmlSupplierId, table.xmlExternalId),
  index("products_xml_supplier_idx").on(table.xmlSupplierId, table.xmlSyncStatus),
]);

export const productCategories = sqliteTable(
  "product_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("product_categories_name_unique").on(table.name),
    index("product_categories_order_idx").on(table.active, table.sortOrder),
  ],
);

export const storeSettings = sqliteTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("customer"),
    sessionVersion: integer("session_version").notNull().default(0),
    emailVerifiedAt: text("email_verified_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const loginAttempts = sqliteTable("login_attempts", {
  email: text("email").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  captchaAnswer: text("captcha_answer"),
  captchaExpiresAt: text("captcha_expires_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const siteContent = sqliteTable("site_content", {
  key: text("key").primaryKey(),
  draftValue: text("draft_value").notNull().default(""),
  publishedValue: text("published_value").notNull().default(""),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  publishedAt: text("published_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
    index("password_reset_tokens_expiry_idx").on(table.expiresAt),
  ],
);

export const emailVerificationTokens = sqliteTable(
  "email_verification_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    kind: text("kind").notNull(),
    tokenHash: text("token_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: text("expires_at").notNull(),
    usedAt: text("used_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "email_verification_tokens_kind_check",
      sql`${table.kind} IN ('account', 'checkout')`,
    ),
    uniqueIndex("email_verification_tokens_hash_unique").on(table.tokenHash),
    index("email_verification_tokens_user_idx").on(table.userId),
    index("email_verification_tokens_email_kind_idx").on(
      table.email,
      table.kind,
    ),
    index("email_verification_tokens_expiry_idx").on(table.expiresAt),
  ],
);

export const systemTestRuns = sqliteTable(
  "system_test_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    testId: text("test_id").notNull(),
    kind: text("kind").notNull(),
    scenario: text("scenario").notNull().default("success"),
    status: text("status").notNull(),
    summary: text("summary").notNull(),
    details: text("details").notNull().default("{}"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("system_test_runs_test_id_unique").on(table.testId),
    check(
      "system_test_runs_status_check",
      sql`${table.status} IN ('passed', 'failed')`,
    ),
    index("system_test_runs_created_idx").on(table.createdAt),
  ],
);

export const discountCodes = sqliteTable(
  "discount_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    discountType: text("discount_type").notNull().default("percent"),
    discountValue: integer("discount_value").notNull(),
    minimumOrderAmount: integer("minimum_order_amount").notNull().default(0),
    usageLimit: integer("usage_limit").notNull().default(0),
    usedCount: integer("used_count").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    startsAt: text("starts_at"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("discount_codes_code_unique").on(table.code),
    index("discount_codes_active_idx").on(table.active),
    check(
      "discount_codes_type_check",
      sql`${table.discountType} IN ('percent', 'fixed')`,
    ),
    check(
      "discount_codes_value_check",
      sql`${table.discountValue} > 0`,
    ),
    check(
      "discount_codes_limits_check",
      sql`${table.minimumOrderAmount} >= 0 AND ${table.usageLimit} >= 0 AND ${table.usedCount} >= 0`,
    ),
  ],
);

export const paymentProviderIds = ["shopier", "paytr", "iyzico"] as const;

export type PaymentProviderId = (typeof paymentProviderIds)[number];

export const paymentProviderSettings = sqliteTable(
  "payment_provider_settings",
  {
    provider: text("provider").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    testMode: integer("test_mode", { mode: "boolean" }).notNull().default(true),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    encryptedCredentials: text("encrypted_credentials").notNull().default(""),
    credentialHint: text("credential_hint").notNull().default(""),
    updatedBy: integer("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "payment_provider_settings_provider_check",
      sql`${table.provider} IN ('shopier', 'paytr', 'iyzico')`,
    ),
    index("payment_provider_settings_enabled_idx").on(
      table.enabled,
      table.isPrimary,
    ),
  ],
);

export const shippingTrackingSettings = sqliteTable(
  "shipping_tracking_settings",
  {
    id: integer("id").primaryKey().default(1),
    manualDeliveryEnabled: integer("manual_delivery_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    automaticTrackingEnabled: integer("automatic_tracking_enabled", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    providerName: text("provider_name").notNull().default(""),
    apiBaseUrl: text("api_base_url").notNull().default(""),
    encryptedCredentials: text("encrypted_credentials").notNull().default(""),
    credentialHint: text("credential_hint").notNull().default(""),
    updatedBy: integer("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("shipping_tracking_settings_singleton_check", sql`${table.id} = 1`),
  ],
);

export const orderStatuses = [
  "pending",
  "paid",
  "failed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("pending"),
    customerFirstName: text("customer_first_name").notNull(),
    customerLastName: text("customer_last_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    shippingDistrict: text("shipping_district").notNull().default(""),
    shippingCity: text("shipping_city").notNull(),
    shippingPostcode: text("shipping_postcode").notNull().default(""),
    shippingCountry: text("shipping_country").notNull().default("Turkey"),
    subtotalAmount: integer("subtotal_amount").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    discountCode: text("discount_code"),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull().default("TRY"),
    paymentProvider: text("payment_provider").notNull().default("shopier"),
    paymentReference: text("payment_reference"),
    paymentId: text("payment_id"),
    shopierRandomNr: text("shopier_random_nr").notNull(),
    customerNote: text("customer_note").notNull().default(""),
    shippingCarrier: text("shipping_carrier").notNull().default(""),
    trackingNumber: text("tracking_number").notNull().default(""),
    shippedAt: text("shipped_at"),
    deliveredAt: text("delivered_at"),
    paidAt: text("paid_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "orders_status_check",
      sql`${table.status} IN ('pending', 'paid', 'failed', 'shipped', 'delivered', 'cancelled')`,
    ),
    check(
      "orders_payment_provider_check",
      sql`${table.paymentProvider} IN ('shopier', 'paytr', 'iyzico')`,
    ),
    index("orders_user_id_idx").on(table.userId),
    index("orders_customer_email_idx").on(table.customerEmail),
    uniqueIndex("orders_payment_id_unique").on(table.paymentId),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("order_items_quantity_check", sql`${table.quantity} > 0`),
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_product_id_idx").on(table.productId),
  ],
);

export const productReviews = sqliteTable(
  "product_reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedOrderId: text("verified_order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    rating: integer("rating").notNull(),
    title: text("title").notNull().default(""),
    comment: text("comment").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "product_reviews_rating_check",
      sql`${table.rating} BETWEEN 1 AND 5`,
    ),
    uniqueIndex("product_reviews_user_product_unique").on(
      table.userId,
      table.productId,
    ),
    index("product_reviews_product_id_idx").on(table.productId),
    index("product_reviews_user_id_idx").on(table.userId),
  ],
);

export const productFavorites = sqliteTable(
  "product_favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    visitorId: text("visitor_id").notNull(),
    userId: integer("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("product_favorites_visitor_product_unique").on(
      table.visitorId,
      table.productId,
    ),
    index("product_favorites_product_idx").on(table.productId),
    index("product_favorites_user_idx").on(table.userId),
    index("product_favorites_created_idx").on(table.createdAt),
  ],
);

export const returnRequestStatuses = [
  "new",
  "reviewing",
  "approved",
  "rejected",
  "completed",
] as const;

export type ReturnRequestStatus = (typeof returnRequestStatuses)[number];

export const returnRequests = sqliteTable(
  "return_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    orderNumber: text("order_number").notNull(),
    productDescription: text("product_description").notNull(),
    trackingNumber: text("tracking_number").notNull().default(""),
    reason: text("reason").notNull().default(""),
    iban: text("iban").notNull().default(""),
    status: text("status").notNull().default("new"),
    adminNote: text("admin_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check(
      "return_requests_status_check",
      sql`${table.status} IN ('new', 'reviewing', 'approved', 'rejected', 'completed')`,
    ),
    index("return_requests_status_idx").on(table.status, table.createdAt),
    index("return_requests_email_idx").on(table.email),
  ],
);

export const savedPaymentMethods = sqliteTable(
  "saved_payment_methods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("manual"),
    providerPaymentMethodId: text("provider_payment_method_id").notNull(),
    cardholderName: text("cardholder_name").notNull().default(""),
    brand: text("brand").notNull().default("other"),
    last4: text("last4").notNull(),
    expMonth: integer("exp_month").notNull(),
    expYear: integer("exp_year").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("saved_payment_methods_user_idx").on(
      table.userId,
      table.isDefault,
      table.createdAt,
    ),
    check(
      "saved_payment_methods_last4_check",
      sql`length(${table.last4}) = 4`,
    ),
    check(
      "saved_payment_methods_exp_month_check",
      sql`${table.expMonth} BETWEEN 1 AND 12`,
    ),
  ],
);
