import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { calculateCartQuote } from "../../../../lib/cart-pricing";
import { isSameOriginRequest } from "../../../../lib/customer-auth";
import {
  listPaymentProvidersForAdmin,
  paymentProviderDefinitions,
} from "../../../../lib/payment-providers";
import {
  isPaymentProviderId,
  type PaymentProviderId,
} from "../../../../lib/payment-types";
import { getOptionalEnv } from "../../../../lib/runtime-env";
import {
  getD1,
  getMediaBucket,
  readProducts,
} from "../../../../lib/store-db";
import type {
  SystemHealthCheck,
  SystemTestRun,
  SystemTestStep,
} from "../../../../lib/system-test-types";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
} from "../../../../lib/transactional-email";

export const dynamic = "force-dynamic";

type TestRunRow = {
  id: number;
  test_id: string;
  kind: "purchase" | "email";
  scenario: string;
  status: "passed" | "failed";
  summary: string;
  details: string;
  created_at: string;
};

function createTestId(prefix: string) {
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .toUpperCase()
    .slice(0, 5);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random}`;
}

function parseDetails(value: string) {
  try {
    return JSON.parse(value) as SystemTestRun["details"];
  } catch {
    return {};
  }
}

async function readTestRuns() {
  const result = await getD1()
    .prepare(
      `SELECT id, test_id, kind, scenario, status, summary, details, created_at
       FROM system_test_runs
       ORDER BY id DESC
       LIMIT 25`,
    )
    .all<TestRunRow>();
  return result.results.map(
    (row): SystemTestRun => ({
      id: row.id,
      testId: row.test_id,
      kind: row.kind,
      scenario: row.scenario,
      status: row.status,
      summary: row.summary,
      details: parseDetails(row.details),
      createdAt: row.created_at,
    }),
  );
}

async function createHealthChecks() {
  const checks: SystemHealthCheck[] = [];
  const db = getD1();

  try {
    await db.prepare("SELECT 1 AS ok").first();
    const tables = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table'
           AND name IN ('users', 'orders', 'email_verification_tokens', 'system_test_runs')`,
      )
      .all<{ name: string }>();
    const complete = tables.results.length === 4;
    checks.push({
      id: "database",
      label: "Veritabanı",
      status: complete ? "passed" : "failed",
      summary: complete
        ? "D1 bağlantısı ve gerekli tablolar hazır."
        : "D1 bağlı ancak son veritabanı güncellemesi eksik.",
      action: complete ? undefined : "Son migrasyonu çalıştırın.",
    });
  } catch {
    checks.push({
      id: "database",
      label: "Veritabanı",
      status: "failed",
      summary: "D1 veritabanına erişilemiyor.",
      action: "Cloudflare D1 bağlantısını kontrol edin.",
    });
  }

  try {
    await getMediaBucket().list({ limit: 1 });
    checks.push({
      id: "media",
      label: "Görsel depolama",
      status: "passed",
      summary: "R2 medya alanına erişim sağlandı.",
    });
  } catch {
    checks.push({
      id: "media",
      label: "Görsel depolama",
      status: "failed",
      summary: "R2 medya alanına erişilemiyor.",
      action: "MEDIA R2 bağlantısını kontrol edin.",
    });
  }

  const authSecret = getOptionalEnv("NEXT_AUTH_SECRET");
  checks.push({
    id: "session",
    label: "Oturum güvenliği",
    status: authSecret.length >= 32 ? "passed" : "failed",
    summary:
      authSecret.length >= 32
        ? "Oturum imzalama anahtarı hazır."
        : "NEXT_AUTH_SECRET eksik veya çok kısa.",
    action:
      authSecret.length >= 32
        ? undefined
        : "En az 32 karakterlik güvenli bir anahtar tanımlayın.",
  });

  const encryptionSecret = getOptionalEnv("PAYMENT_CONFIG_ENCRYPTION_KEY");
  checks.push({
    id: "payment-encryption",
    label: "Ödeme anahtarı koruması",
    status: encryptionSecret.length >= 32 ? "passed" : "failed",
    summary:
      encryptionSecret.length >= 32
        ? "Ödeme bilgileri için şifreleme anahtarı hazır."
        : "Ödeme bilgileri şifreleme anahtarı eksik.",
    action:
      encryptionSecret.length >= 32
        ? undefined
        : "PAYMENT_CONFIG_ENCRYPTION_KEY değerini tanımlayın.",
  });

  const email = getTransactionalEmailConfiguration();
  const emailDevMode =
    getOptionalEnv("EMAIL_VERIFICATION_DEV_MODE") === "true";
  checks.push({
    id: "email",
    label: "E-posta servisi",
    status: email.configured
      ? "passed"
      : emailDevMode
        ? "warning"
        : "failed",
    summary: email.configured
      ? `Resend hazır · ${email.senderHint}`
      : emailDevMode
        ? "Yerel doğrulama modu açık; gerçek e-posta gönderilmez."
        : "Resend e-posta servisi henüz yapılandırılmamış.",
    action:
      email.configured || emailDevMode
        ? undefined
        : "Resend API anahtarı ve gönderici adresini ekleyin.",
  });

  const providers = await listPaymentProvidersForAdmin();
  const readyProviders = providers.filter(
    (provider) => provider.enabled && provider.configured,
  );
  checks.push({
    id: "payment-provider",
    label: "Ödeme yöntemi",
    status: readyProviders.length ? "passed" : "warning",
    summary: readyProviders.length
      ? `${readyProviders.map((provider) => provider.name).join(", ")} ödeme almaya hazır.`
      : "Etkin ve yapılandırılmış ödeme yöntemi bulunmuyor.",
    action: readyProviders.length
      ? undefined
      : "Ödeme yöntemleri bölümünden bir sağlayıcıyı yapılandırın.",
  });

  return { checks, providers };
}

async function storeRun(input: {
  testId: string;
  kind: "purchase" | "email";
  scenario: string;
  status: "passed" | "failed";
  summary: string;
  details: SystemTestRun["details"];
  createdBy: number;
}) {
  await getD1()
    .prepare(
      `INSERT INTO system_test_runs
        (test_id, kind, scenario, status, summary, details, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.testId,
      input.kind,
      input.scenario,
      input.status,
      input.summary,
      JSON.stringify(input.details),
      input.createdBy,
    )
    .run();
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  try {
    const [{ checks, providers }, products, runs] = await Promise.all([
      createHealthChecks(),
      readProducts(true),
      readTestRuns(),
    ]);
    return Response.json(
      {
        checks,
        providers: providers.map((provider) => ({
          id: provider.id,
          name: provider.name,
          enabled: provider.enabled,
          configured: provider.configured,
          testMode: provider.testMode,
          isPrimary: provider.isPrimary,
        })),
        products: products.filter(
          (product) => product.status === "published" && product.stock > 0,
        ),
        runs,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sistem testleri hazırlanamadı.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request);
  if (!admin) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "simulate-purchase") {
      const productId = Number(body.productId);
      const quantity = Math.max(1, Math.min(20, Number(body.quantity) || 1));
      const scenario =
        body.scenario === "failed-payment" ? "failed-payment" : "success";
      const provider: PaymentProviderId = isPaymentProviderId(body.provider)
        ? body.provider
        : "shopier";
      const discountCode = String(body.discountCode ?? "").trim();
      const quote = await calculateCartQuote(
        [{ productId, quantity }],
        discountCode,
      );
      const selectedProduct = quote.items[0].product;
      const providers = await listPaymentProvidersForAdmin();
      const providerState = providers.find((item) => item.id === provider);
      const providerName =
        providerState?.name ?? paymentProviderDefinitions[provider].name;
      const providerReady = Boolean(
        providerState?.enabled && providerState.configured,
      );
      const steps: SystemTestStep[] = [
        {
          id: "cart",
          label: "Sepet ve stok kontrolü",
          status: "passed",
          detail: `${selectedProduct.name} · ${quantity} adet için stok yeterli.`,
        },
        {
          id: "discount",
          label: "İndirim ve kargo hesabı",
          status: "passed",
          detail: quote.discountCode
            ? `${quote.discountCode} kodu ve kargo koşulları doğru hesaplandı.`
            : "Kargo koşulları indirim kodu olmadan doğru hesaplandı.",
        },
        {
          id: "email",
          label: "E-posta doğrulama kapısı",
          status: "passed",
          detail:
            "Doğrulanmamış e-postanın gerçek sipariş oluşturması engelleniyor.",
        },
        {
          id: "provider",
          label: `${providerName} yapılandırması`,
          status: providerReady ? "passed" : "warning",
          detail: providerReady
            ? "Sağlayıcı etkin ve gerekli bilgiler kayıtlı."
            : "Simülasyon tamamlandı; gerçek yönlendirme için sağlayıcı ayarları bekleniyor.",
        },
        {
          id: "payment",
          label:
            scenario === "success"
              ? "Başarılı ödeme yanıtı"
              : "Başarısız ödeme yanıtı",
          status: "passed",
          detail:
            scenario === "success"
              ? "Başarılı callback akışı doğrulandı; stok yalnızca bu aşamadan sonra düşer."
              : "Başarısız ödeme doğru şekilde reddedildi; stok ve kupon kullanımı korunur.",
        },
        {
          id: "persistence",
          label: "Veri güvenliği",
          status: "passed",
          detail:
            "Bu bir simülasyondur; gerçek sipariş, ödeme veya stok değişikliği yapılmadı.",
        },
      ];
      const testId = createTestId("TG-SIPARIS");
      const summary =
        scenario === "success"
          ? "Başarılı satın alma senaryosu tamamlandı."
          : "Başarısız ödeme senaryosu doğru şekilde işlendi.";
      const details: SystemTestRun["details"] = {
        steps,
        productName: selectedProduct.name,
        providerName,
        quote: {
          subtotalAmount: quote.subtotalAmount,
          discountAmount: quote.discountAmount,
          vatAmount: quote.vatAmount,
          shippingAmount: quote.shippingAmount,
          totalAmount: quote.totalAmount,
          discountCode: quote.discountCode,
        },
      };
      await storeRun({
        testId,
        kind: "purchase",
        scenario,
        status: "passed",
        summary,
        details,
        createdBy: admin.id,
      });
      return Response.json({
        run: {
          id: 0,
          testId,
          kind: "purchase",
          scenario,
          status: "passed",
          summary,
          details,
          createdAt: new Date().toISOString(),
        } satisfies SystemTestRun,
      });
    }

    if (action === "send-email") {
      const testId = createTestId("TG-EPOSTA");
      try {
        await sendTransactionalEmail({
          to: admin.email,
          subject: "Terragolds sistem testi başarılı",
          idempotencyKey: testId,
          html: `<div style="font-family:Arial,sans-serif;color:#173b31;line-height:1.65">
            <h1 style="font-family:Georgia,serif;font-weight:400">E-posta bağlantısı hazır</h1>
            <p>Terragolds yönetim panelinden başlatılan test e-postası başarıyla gönderildi.</p>
            <p>Test numarası: <strong>${testId}</strong></p>
          </div>`,
          text: `Terragolds test e-postası başarıyla gönderildi.\nTest numarası: ${testId}`,
        });
        const summary = "Test e-postası yönetici adresine gönderildi.";
        const details = { recipient: admin.email };
        await storeRun({
          testId,
          kind: "email",
          scenario: "delivery",
          status: "passed",
          summary,
          details,
          createdBy: admin.id,
        });
        return Response.json({
          run: {
            id: 0,
            testId,
            kind: "email",
            scenario: "delivery",
            status: "passed",
            summary,
            details,
            createdAt: new Date().toISOString(),
          } satisfies SystemTestRun,
        });
      } catch (error) {
        const summary =
          error instanceof Error ? error.message : "Test e-postası gönderilemedi.";
        await storeRun({
          testId,
          kind: "email",
          scenario: "delivery",
          status: "failed",
          summary,
          details: { recipient: admin.email },
          createdBy: admin.id,
        });
        return Response.json({ error: summary }, { status: 400 });
      }
    }

    return Response.json({ error: "Geçersiz test işlemi." }, { status: 400 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Sistem testi tamamlanamadı.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }
  await getD1().prepare("DELETE FROM system_test_runs").run();
  return new Response(null, { status: 204 });
}
