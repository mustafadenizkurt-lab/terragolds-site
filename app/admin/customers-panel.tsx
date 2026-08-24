"use client";

import { useEffect, useMemo, useState } from "react";

type CustomerRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  email_verified_at: string | null;
  created_at: string;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
};

type CustomerDraft = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  emailVerified: boolean;
};

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

function formatDate(value: string | null) {
  if (!value) return "Henüz yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

async function readJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error ?? "İşlem tamamlanamadı."));
  return body;
}

export default function CustomersPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(
    null,
  );
  const [draft, setDraft] = useState<CustomerDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const body = await readJson(
        await fetch("/api/admin/customers", { cache: "no-store" }),
      );
      setCustomers((body.customers as CustomerRow[] | undefined) ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Müşteriler alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The protected API hydrates this panel from the durable store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return customers.filter((customer) => {
      const matchesRole = roleFilter === "all" || customer.role === roleFilter;
      const haystack = [
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.phone,
      ]
        .join(" ")
        .toLocaleLowerCase("tr-TR");
      return matchesRole && (!normalized || haystack.includes(normalized));
    });
  }, [customers, query, roleFilter]);

  const totalSpent = customers.reduce(
    (total, customer) => total + Number(customer.total_spent || 0),
    0,
  );
  const verifiedCount = customers.filter(
    (customer) => customer.email_verified_at,
  ).length;
  const adminCount = customers.filter((customer) => customer.role === "admin")
    .length;

  const beginEdit = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setDraft({
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email,
      phone: customer.phone,
      role: customer.role,
      emailVerified: Boolean(customer.email_verified_at),
    });
    setError("");
  };

  const updateRole = async (customer: CustomerRow, role: string) => {
    setSavingId(customer.id);
    setError("");
    try {
      await readJson(
        await fetch("/api/admin/customers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: customer.id, role }),
        }),
      );
      setCustomers((current) =>
        current.map((item) =>
          item.id === customer.id ? { ...item, role } : item,
        ),
      );
      onNotice("Müşteri yetkisi güncellendi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Müşteri güncellenemedi.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const saveCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    setSavingId(draft.id);
    setError("");
    try {
      await readJson(
        await fetch("/api/admin/customers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      await loadCustomers();
      setEditingCustomer(null);
      setDraft(null);
      onNotice("Müşteri profili güncellendi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Müşteri güncellenemedi.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-workbench">
      <section className="admin-stat-grid compact">
        <article>
          <span>Toplam müşteri</span>
          <strong>{customers.length}</strong>
          <small>Kayıtlı hesap</small>
        </article>
        <article>
          <span>Doğrulanmış</span>
          <strong>{verifiedCount}</strong>
          <small>E-posta onaylı</small>
        </article>
        <article>
          <span>Yönetici</span>
          <strong>{adminCount}</strong>
          <small>Panel erişimi</small>
        </article>
        <article>
          <span>Toplam ciro</span>
          <strong>{money.format(totalSpent / 100)}</strong>
          <small>Başarılı siparişlerden</small>
        </article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">Müşteri merkezi</p>
            <h2>Üyeler ve yetkiler</h2>
          </div>
          <button type="button" onClick={loadCustomers}>
            Yenile
          </button>
        </div>

        {error && <div className="admin-inline-error">{error}</div>}

        <div className="admin-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, e-posta veya telefon ara"
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          >
            <option value="all">Tüm roller</option>
            <option value="customer">Müşteri</option>
            <option value="admin">Yönetici</option>
          </select>
        </div>

        {editingCustomer && draft && (
          <form className="admin-customer-editor" onSubmit={saveCustomer}>
            <header>
              <div>
                <p className="admin-kicker">Profil düzenle</p>
                <h3>
                  {editingCustomer.first_name} {editingCustomer.last_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCustomer(null);
                  setDraft(null);
                }}
              >
                Kapat
              </button>
            </header>

            <div className="admin-customer-editor-grid">
              <label>
                <span>Ad</span>
                <input
                  value={draft.firstName}
                  onChange={(event) =>
                    setDraft({ ...draft, firstName: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                <span>Soyad</span>
                <input
                  value={draft.lastName}
                  onChange={(event) =>
                    setDraft({ ...draft, lastName: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                <span>E-posta</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) =>
                    setDraft({ ...draft, email: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                <span>Telefon</span>
                <input
                  value={draft.phone}
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                  placeholder="Telefon yok"
                />
              </label>
              <label>
                <span>Rol</span>
                <select
                  value={draft.role}
                  onChange={(event) =>
                    setDraft({ ...draft, role: event.target.value })
                  }
                >
                  <option value="customer">Müşteri</option>
                  <option value="admin">Yönetici</option>
                </select>
              </label>
              <label className="admin-customer-check">
                <input
                  type="checkbox"
                  checked={draft.emailVerified}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      emailVerified: event.target.checked,
                    })
                  }
                />
                <span>E-posta doğrulandı</span>
              </label>
            </div>

            <footer>
              <button
                type="submit"
                disabled={savingId === draft.id}
                className="admin-primary-button"
              >
                {savingId === draft.id ? "Kaydediliyor" : "Profili kaydet"}
              </button>
            </footer>
          </form>
        )}

        {loading ? (
          <div className="admin-empty small">Müşteriler hazırlanıyor...</div>
        ) : (
          <div className="admin-data-table customers">
            <div className="admin-data-head">
              <span>Müşteri</span>
              <span>Durum</span>
              <span>Sipariş</span>
              <span>Harcamalar</span>
              <span>Son sipariş</span>
              <span>Rol</span>
              <span>İşlem</span>
            </div>
            {filteredCustomers.map((customer) => (
              <div className="admin-data-row" key={customer.id}>
                <span>
                  <strong>
                    {customer.first_name} {customer.last_name}
                  </strong>
                  <small>{customer.email}</small>
                  <small>{customer.phone || "Telefon yok"}</small>
                </span>
                <span>
                  <b
                    className={
                      customer.email_verified_at
                        ? "admin-pill good"
                        : "admin-pill muted"
                    }
                  >
                    {customer.email_verified_at ? "Doğrulandı" : "Bekliyor"}
                  </b>
                </span>
                <span>{customer.total_orders}</span>
                <span>{money.format(Number(customer.total_spent || 0) / 100)}</span>
                <span>{formatDate(customer.last_order_at)}</span>
                <span>
                  <select
                    value={customer.role}
                    disabled={savingId === customer.id}
                    onChange={(event) => updateRole(customer, event.target.value)}
                  >
                    <option value="customer">Müşteri</option>
                    <option value="admin">Yönetici</option>
                  </select>
                </span>
                <span>
                  <button
                    className="admin-row-action"
                    type="button"
                    onClick={() => beginEdit(customer)}
                  >
                    Düzenle
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
