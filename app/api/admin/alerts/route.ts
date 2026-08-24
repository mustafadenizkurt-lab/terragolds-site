import {
  getAuthorizedAdmin,
  unauthorizedAdminResponse,
} from "../../../../lib/admin-auth";
import { getD1 } from "../../../../lib/store-db";

export const dynamic = "force-dynamic";

type CountRow = {
  total: number;
};

type LowStockRow = {
  id: number;
  name: string;
  stock: number;
};

async function count(statement: string) {
  const row = await getD1().prepare(statement).first<CountRow>();
  return Number(row?.total) || 0;
}

export async function GET(request: Request) {
  if (!(await getAuthorizedAdmin(request))) return unauthorizedAdminResponse();

  try {
    const db = getD1();
    const [
      awaitingShipment,
      pendingPayment,
      delayedShipping,
      oldShipped,
      unverifiedCustomers,
      lowStockRows,
    ] = await Promise.all([
      count("SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'"),
      count("SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'"),
      count(
        `SELECT COUNT(*) AS total
          FROM orders
          WHERE status = 'paid'
            AND datetime(created_at) <= datetime('now', '-2 days')`,
      ),
      count(
        `SELECT COUNT(*) AS total
          FROM orders
          WHERE status = 'shipped'
            AND shipped_at IS NOT NULL
            AND datetime(shipped_at) <= datetime('now', '-5 days')`,
      ),
      count(
        "SELECT COUNT(*) AS total FROM users WHERE email_verified_at IS NULL",
      ),
      db
        .prepare(
          `SELECT id, name, stock
            FROM products
            WHERE stock <= 3
            ORDER BY stock ASC, sort_order ASC
            LIMIT 8`,
        )
        .all<LowStockRow>(),
    ]);

    const alerts = [
      {
        id: "awaiting-shipment",
        tone: awaitingShipment > 0 ? "danger" : "good",
        title: "Kargoya hazırlanacak sipariş",
        value: awaitingShipment,
        description:
          awaitingShipment > 0
            ? "Ödemesi alınmış, kargo bekleyen siparişler var."
            : "Kargo bekleyen sipariş yok.",
        target: "shipping",
      },
      {
        id: "delayed-shipping",
        tone: delayedShipping > 0 ? "warning" : "good",
        title: "Hazırlamada geciken sipariş",
        value: delayedShipping,
        description: "2 günden uzun süredir kargo bekleyen sipariş sayısı.",
        target: "shipping",
      },
      {
        id: "old-shipped",
        tone: oldShipped > 0 ? "warning" : "good",
        title: "Teslim kontrolü gereken kargo",
        value: oldShipped,
        description:
          "5 günü geçen kargolar takip linkinden kontrol edilebilir.",
        target: "shipping",
      },
      {
        id: "low-stock",
        tone: lowStockRows.results.length > 0 ? "warning" : "good",
        title: "Stok kritik ürün",
        value: lowStockRows.results.length,
        description:
          lowStockRows.results.length > 0
            ? lowStockRows.results
                .slice(0, 3)
                .map((product) => `${product.name} (${product.stock})`)
                .join(", ")
            : "Kritik stokta ürün yok.",
        target: "products",
      },
      {
        id: "pending-payment",
        tone: pendingPayment > 0 ? "muted" : "good",
        title: "Ödeme bekleyen sepet",
        value: pendingPayment,
        description: "Başlatılmış fakat tamamlanmamış ödeme akışları.",
        target: "reports",
      },
      {
        id: "unverified-customers",
        tone: unverifiedCustomers > 0 ? "muted" : "good",
        title: "E-posta doğrulamayan üye",
        value: unverifiedCustomers,
        description: "Doğrulama linki bekleyen müşteri hesapları.",
        target: "customers",
      },
    ];

    return Response.json({ alerts });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Operasyon uyarıları alınamadı.",
      },
      { status: 500 },
    );
  }
}
