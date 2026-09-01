"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import StoreSiteFooter from "../store-site-footer";
import {
  getDiscountedPrice,
  type Product,
} from "../../lib/store-data";

type Profile = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

type Order = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  paymentId: string | null;
  address: string;
  createdAt: string;
  items: {
    productId: number | null;
    name: string;
    unitPrice: number;
    quantity: number;
  }[];
};

type Address = {
  id: string;
  title: string;
  recipient: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  postcode: string;
  isDefault: boolean;
};

type NotificationPrefs = {
  emailCampaigns: boolean;
  whatsappUpdates: boolean;
  stockAlerts: boolean;
};

type SavedPaymentMethod = {
  id: number;
  provider: string;
  tokenPreview: string;
  cardholderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
};

type ProfileSection =
  | "profile-info"
  | "addresses"
  | "orders"
  | "favorites"
  | "payment-methods"
  | "security"
  | "preferences"
  | "extras"
  | "recent"
  | "membership";

const profileSections: { id: ProfileSection; label: string }[] = [
  { id: "profile-info", label: "Bilgilerim" },
  { id: "addresses", label: "Adreslerim" },
  { id: "orders", label: "Siparişlerim" },
  { id: "favorites", label: "Favorilerim" },
  { id: "payment-methods", label: "Kartlarım" },
  { id: "security", label: "Şifre ve güvenlik" },
  { id: "preferences", label: "Bildirimler" },
  { id: "extras", label: "Kupon ve stok" },
  { id: "recent", label: "Son görüntülenenler" },
  { id: "membership", label: "Üyelik" },
];

const money = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const orderStatusLabels: Record<string, string> = {
  pending: "Ödeme bekliyor",
  paid: "Ödendi",
  failed: "Ödeme başarısız",
  shipped: "Kargoya verildi",
  delivered: "Teslim edildi",
  cancelled: "İptal edildi",
};

const emptyAddress: Address = {
  id: "",
  title: "Ev",
  recipient: "",
  phone: "",
  city: "",
  district: "",
  address: "",
  postcode: "",
  isDefault: false,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function ProfileClient({
  businessName,
  businessAddress,
}: {
  businessName?: string;
  businessAddress?: string;
} = {}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [liked, setLiked] = useState<number[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressDraft, setAddressDraft] = useState<Address>(emptyAddress);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    emailCampaigns: true,
    whatsappUpdates: false,
    stockAlerts: true,
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [activeSection, setActiveSection] =
    useState<ProfileSection>("profile-info");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  const sectionClass = (section: ProfileSection, extra = "") =>
    `${extra ? `${extra} ` : ""}profile-account-section${
      activeSection === section ? " active" : ""
    }`;

  useEffect(() => {
    // Account preferences are intentionally restored from local browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddresses(readJson<Address[]>("terragolds-addresses", []));
    setNotifications(
      readJson<NotificationPrefs>("terragolds-notifications", {
        emailCampaigns: true,
        whatsappUpdates: false,
        stockAlerts: true,
      }),
    );
    setLiked(readJson<number[]>("terragolds-liked", []));
    setRecentIds(readJson<number[]>("terragolds-recent-products", []));

    fetch("/api/account/profile", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = "/login";
          return null;
        }
        const body = (await response.json()) as {
          user?: Profile;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        return body.user ?? null;
      })
      .then((user) => {
        if (user) {
          setProfile(user);
          setAddressDraft((current) => ({
            ...current,
            recipient: `${user.firstName} ${user.lastName}`.trim(),
            phone: user.phone,
          }));
        }
      })
      .catch((loadError) =>
        setError(
          loadError instanceof Error ? loadError.message : "Profil alınamadı.",
        ),
      )
      .finally(() => setLoading(false));

    fetch("/api/account/orders", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return [];
        const body = (await response.json()) as {
          orders?: Order[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        return body.orders ?? [];
      })
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));

    fetch("/api/account/payment-methods", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return [];
        const body = (await response.json()) as {
          paymentMethods?: SavedPaymentMethod[];
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        return body.paymentMethods ?? [];
      })
      .then(setPaymentMethods)
      .catch(() => setPaymentMethods([]));

    fetch("/api/store", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ products?: Product[] }>)
      .then((payload) => setProducts(payload.products ?? []))
      .catch(() => setProducts([]));
  }, []);

  const favorites = useMemo(
    () => products.filter((product) => liked.includes(product.id)),
    [liked, products],
  );

  const recentProducts = useMemo(() => {
    const recent = products.filter((product) => recentIds.includes(product.id));
    return recent.length ? recent.slice(0, 4) : products.slice(0, 4);
  }, [products, recentIds]);

  const stockAlertProducts = useMemo(
    () => products.filter((product) => product.stock <= 3).slice(0, 4),
    [products],
  );

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = (await response.json()) as {
        user?: Profile;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error);
      if (body.user) setProfile(body.user);
      setNotice("Profil bilgileriniz güncellendi.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Profil güncellenemedi.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAddress = {
      ...addressDraft,
      id: addressDraft.id || crypto.randomUUID(),
      isDefault: addresses.length === 0 ? true : addressDraft.isDefault,
    };
    const next = [
      nextAddress,
      ...addresses.filter((address) => address.id !== nextAddress.id),
    ].map((address, index) => ({
      ...address,
      isDefault: nextAddress.isDefault ? address.id === nextAddress.id : index === 0,
    }));
    setAddresses(next);
    saveJson("terragolds-addresses", next);
    setAddressDraft({
      ...emptyAddress,
      recipient: profile ? `${profile.firstName} ${profile.lastName}` : "",
      phone: profile?.phone ?? "",
    });
    setNotice("Teslimat adresi kaydedildi.");
    window.setTimeout(() => setNotice(""), 2400);
  };

  const setDefaultAddress = (addressId: string) => {
    const next = addresses.map((address) => ({
      ...address,
      isDefault: address.id === addressId,
    }));
    setAddresses(next);
    saveJson("terragolds-addresses", next);
  };

  const removeAddress = (addressId: string) => {
    const next = addresses.filter((address) => address.id !== addressId);
    setAddresses(next);
    saveJson("terragolds-addresses", next);
  };

  const removePaymentMethod = async (id: number) => {
    setPaymentSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/account/payment-methods/${id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error);
      setPaymentMethods((current) => current.filter((item) => item.id !== id));
      setNotice("Kart kaydı silindi.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Kart silinemedi.",
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  const saveNotifications = (next: NotificationPrefs) => {
    setNotifications(next);
    saveJson("terragolds-notifications", next);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSaving(true);
    setError("");
    setPasswordError("");
    setPasswordNotice("");
    try {
      if (passwords.newPassword !== passwords.confirmPassword) {
        throw new Error("Yeni şifreler eşleşmiyor.");
      }
      const response = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(passwords),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error);
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setNotice("Şifreniz güncellendi.");
      window.setTimeout(() => setNotice(""), 2600);
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Şifre güncellenemedi.",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const sendVerification = async () => {
    setVerificationSending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/email-verification/send", {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        alreadyVerified?: boolean;
        verification?: { devVerifyUrl?: string };
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Doğrulama bağlantısı gönderilemedi.");
      }
      if (body.alreadyVerified) {
        setProfile((current) =>
          current
            ? { ...current, emailVerifiedAt: new Date().toISOString() }
            : current,
        );
        setNotice("E-posta adresiniz doğrulandı.");
        return;
      }
      if (body.verification?.devVerifyUrl) {
        window.location.assign(body.verification.devVerifyUrl);
        return;
      }
      setNotice("Doğrulama bağlantısı e-posta adresinize gönderildi.");
      window.setTimeout(() => setNotice(""), 3200);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Doğrulama bağlantısı gönderilemedi.",
      );
    } finally {
      setVerificationSending(false);
    }
  };

  return (
    <main className="profile-page">
      <StoreSubpageHeader />
      <section className="profile-content profile-hub">
        <div className="profile-title profile-title-quiet">
          <p>Hesabım</p>
          <h1>Üyelik paneli</h1>
          <span>
            Profil, teslimat, güvenlik ve alışveriş tercihlerinizi tek ekrandan
            yönetin.
          </span>
        </div>

        {loading ? (
          <div className="profile-loading">Hesabınız hazırlanıyor...</div>
        ) : profile ? (
          <>
            <div className="profile-hub-summary">
              <article>
                <span>E-posta durumu</span>
                <strong>{profile.emailVerifiedAt ? "Doğrulandı" : "Bekliyor"}</strong>
                <small>{profile.email}</small>
              </article>
              <article>
                <span>Kayıt tarihi</span>
                <strong>{formatDate(profile.createdAt)}</strong>
                <small>Terragolds üyeliği</small>
              </article>
              <article>
                <span>Siparişler</span>
                <strong>{ordersLoading ? "..." : orders.length}</strong>
                <small>Geçmiş alışveriş</small>
              </article>
              <article>
                <span>Favoriler</span>
                <strong>{favorites.length}</strong>
                <small>Kaydedilen ürün</small>
              </article>
            </div>

            <div className="profile-hub-layout">
              <aside className="profile-hub-nav">
                {profileSections.map((section) => (
                  <button
                    type="button"
                    key={section.id}
                    className={activeSection === section.id ? "active" : ""}
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.label}
                  </button>
                ))}
              </aside>

              <div className="profile-hub-main">
                <form
                  id="profile-info"
                  className={sectionClass(
                    "profile-info",
                    "profile-card profile-settings-card",
                  )}
                  onSubmit={save}
                >
                  <header className="profile-form-head">
                    <div>
                      <h2>Kullanıcı Bilgilerim</h2>
                      <p>Alışveriş ve teslimatta kullanılan temel hesap bilgileri.</p>
                    </div>
                    <Link href="/orders">Tüm siparişler</Link>
                  </header>

                  <div className="account-field-row">
                    <label>
                      <span>Ad *</span>
                      <input
                        value={profile.firstName}
                        onChange={(event) =>
                          setProfile({ ...profile, firstName: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>Soyad *</span>
                      <input
                        value={profile.lastName}
                        onChange={(event) =>
                          setProfile({ ...profile, lastName: event.target.value })
                        }
                        required
                      />
                    </label>
                  </div>

                  <label>
                    <span>E-posta Adresi *</span>
                    <input value={profile.email} readOnly />
                    <small>Güvenlik nedeniyle e-posta bu ekrandan değiştirilemez.</small>
                  </label>

                  <div className="profile-phone-field">
                    <span>Cep Telefonu *</span>
                    <div>
                      <input value="+90" readOnly aria-label="Ülke kodu" />
                      <input
                        type="tel"
                        value={profile.phone}
                        aria-label="Cep telefonu"
                        onChange={(event) =>
                          setProfile({ ...profile, phone: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={`profile-verification profile-verification-inline ${
                      profile.emailVerifiedAt ? "verified" : "pending"
                    }`}
                  >
                    <div>
                      <b aria-hidden="true">{profile.emailVerifiedAt ? "✓" : "@"}</b>
                      <span>
                        <strong>
                          {profile.emailVerifiedAt
                            ? "E-posta doğrulandı"
                            : "E-posta doğrulaması bekleniyor"}
                        </strong>
                        <small>{profile.email}</small>
                      </span>
                    </div>
                    {!profile.emailVerifiedAt && (
                      <button
                        type="button"
                        disabled={verificationSending}
                        onClick={() => void sendVerification()}
                      >
                        {verificationSending
                          ? "Gönderiliyor..."
                          : "Doğrulama bağlantısı gönder"}
                      </button>
                    )}
                  </div>

                  {error && <div className="account-error">{error}</div>}
                  {notice && <div className="profile-success">{notice}</div>}
                  <button type="submit" disabled={saving}>
                    {saving ? "Kaydediliyor..." : "Bilgileri kaydet"}
                  </button>
                </form>

                <section
                  id="addresses"
                  className={sectionClass(
                    "addresses",
                    "profile-panel profile-address-panel",
                  )}
                >
                  <header>
                    <div>
                      <span>Teslimat</span>
                      <h2>Adreslerim</h2>
                    </div>
                    <small>Varsayılan adres ödeme ekranında öne çıkar.</small>
                  </header>
                  <div className="profile-address-grid">
                    <form onSubmit={saveAddress}>
                      <input
                        placeholder="Adres başlığı"
                        value={addressDraft.title}
                        onChange={(event) =>
                          setAddressDraft({ ...addressDraft, title: event.target.value })
                        }
                        required
                      />
                      <input
                        placeholder="Alıcı adı soyadı"
                        value={addressDraft.recipient}
                        onChange={(event) =>
                          setAddressDraft({
                            ...addressDraft,
                            recipient: event.target.value,
                          })
                        }
                        required
                      />
                      <div>
                        <input
                          placeholder="İl"
                          value={addressDraft.city}
                          onChange={(event) =>
                            setAddressDraft({ ...addressDraft, city: event.target.value })
                          }
                          required
                        />
                        <input
                          placeholder="İlçe"
                          value={addressDraft.district}
                          onChange={(event) =>
                            setAddressDraft({
                              ...addressDraft,
                              district: event.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <textarea
                        placeholder="Mahalle, cadde, bina, daire"
                        value={addressDraft.address}
                        onChange={(event) =>
                          setAddressDraft({ ...addressDraft, address: event.target.value })
                        }
                        required
                      />
                      <div>
                        <input
                          placeholder="Telefon"
                          value={addressDraft.phone}
                          onChange={(event) =>
                            setAddressDraft({ ...addressDraft, phone: event.target.value })
                          }
                        />
                        <input
                          placeholder="Posta kodu"
                          value={addressDraft.postcode}
                          onChange={(event) =>
                            setAddressDraft({
                              ...addressDraft,
                              postcode: event.target.value,
                            })
                          }
                        />
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          checked={addressDraft.isDefault}
                          onChange={(event) =>
                            setAddressDraft({
                              ...addressDraft,
                              isDefault: event.target.checked,
                            })
                          }
                        />
                        Varsayılan adres yap
                      </label>
                      <button type="submit">
                        {addressDraft.id ? "Adresi güncelle" : "Adres ekle"}
                      </button>
                    </form>
                    <div className="profile-address-list">
                      {addresses.length === 0 ? (
                        <div className="profile-empty-mini">
                          Henüz kayıtlı teslimat adresi yok.
                        </div>
                      ) : (
                        addresses.map((address) => (
                          <article key={address.id}>
                            <div>
                              <strong>{address.title}</strong>
                              {address.isDefault && <span>Varsayılan</span>}
                            </div>
                            <p>
                              {address.recipient} · {address.phone}
                              <br />
                              {address.address}
                              <br />
                              {address.district} / {address.city} {address.postcode}
                            </p>
                            <footer>
                              <button
                                type="button"
                                onClick={() => setAddressDraft(address)}
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => setDefaultAddress(address.id)}
                              >
                                Varsayılan yap
                              </button>
                              <button
                                type="button"
                                onClick={() => removeAddress(address.id)}
                              >
                                Sil
                              </button>
                            </footer>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section id="orders" className={sectionClass("orders", "profile-panel")}>
                  <header>
                    <div>
                      <span>Alışveriş</span>
                      <h2>Siparişlerim</h2>
                    </div>
                    <Link href="/orders">Detaylı liste</Link>
                  </header>
                  {orders.length === 0 ? (
                    <div className="profile-empty-mini">Henüz siparişiniz yok.</div>
                  ) : (
                    <div className="profile-order-preview">
                      {orders.slice(0, 6).map((order) => (
                        <article key={order.id}>
                          <div>
                            <strong>{order.id}</strong>
                            <span>
                              {orderStatusLabels[order.status] ?? order.status}
                            </span>
                          </div>
                          <p>{order.items.map((item) => item.name).join(", ")}</p>
                          <b>{money.format(order.totalAmount / 100)}</b>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section
                  id="favorites"
                  className={sectionClass("favorites", "profile-panel")}
                >
                  <header>
                    <div>
                      <span>Koleksiyon</span>
                      <h2>Favorilerim</h2>
                    </div>
                    <Link href="/favoriler">Tümünü gör</Link>
                  </header>
                  <ProductRail products={favorites.slice(0, 4)} empty="Favori listeniz henüz boş." />
                </section>

                <section
                  id="payment-methods"
                  className={sectionClass("payment-methods", "profile-panel")}
                >
                  <header>
                    <div>
                      <span>Ödeme</span>
                      <h2>Kartlarım</h2>
                    </div>
                  </header>
                  <div className="profile-payment-method-grid">
                    <div className="profile-payment-note">
                      <span>Güvenli kart altyapısı</span>
                      <strong>Kart bilgileri ödeme kuruluşunda saklanır.</strong>
                      <p>
                        Terragolds tam kart numarası veya CVV tutmaz. Shopier,
                        iyzico ya da PayTR kart saklama desteği bağlandığında,
                        müşteriler ödeme sırasında kartını güvenli şekilde
                        kaydedebilir.
                      </p>
                      <ul>
                        <li>Kart numarası sitede görünmez.</li>
                        <li>Sadece marka, son 4 hane ve son kullanım tutulur.</li>
                        <li>Kayıtlı kartlar buradan silinebilir.</li>
                      </ul>
                    </div>
                    <div className="profile-payment-list">
                      {paymentMethods.length === 0 ? (
                        <div className="profile-empty-mini payment-empty">
                          <strong>Kayıtlı kart yok</strong>
                          <span>
                            Ödeme entegrasyonu aktif olduğunda, müşteri ödeme
                            adımında “kartımı kaydet” seçeneğiyle kartını
                            ekleyebilecek.
                          </span>
                        </div>
                      ) : (
                        paymentMethods.map((method) => (
                          <article key={method.id}>
                            <div>
                              <span>{method.brand}</span>
                              <strong>•••• {method.last4}</strong>
                              <small>
                                {method.expMonth.toString().padStart(2, "0")}/
                                {method.expYear} · {method.provider}
                              </small>
                            </div>
                            {method.isDefault && <b>Varsayılan</b>}
                            <button
                              type="button"
                              disabled={paymentSaving}
                              onClick={() => removePaymentMethod(method.id)}
                            >
                              Sil
                            </button>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section
                  id="security"
                  className={sectionClass(
                    "security",
                    "profile-panel profile-security-grid",
                  )}
                >
                  <div>
                    <header>
                      <div>
                        <span>Güvenlik</span>
                        <h2>Şifre değiştir</h2>
                      </div>
                    </header>
                    <form className="profile-password-form" onSubmit={changePassword}>
                      <input
                        type="password"
                        placeholder="Mevcut şifre"
                        value={passwords.currentPassword}
                        onChange={(event) =>
                          setPasswords({
                            ...passwords,
                            currentPassword: event.target.value,
                          })
                        }
                        required
                      />
                      <input
                        type="password"
                        placeholder="Yeni şifre"
                        value={passwords.newPassword}
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setPasswords({
                            ...passwords,
                            newPassword: event.target.value,
                          })
                        }
                        required
                      />
                      <input
                        type="password"
                        placeholder="Yeni şifre tekrar"
                        value={passwords.confirmPassword}
                        minLength={10}
                        maxLength={128}
                        autoComplete="new-password"
                        onChange={(event) =>
                          setPasswords({
                            ...passwords,
                            confirmPassword: event.target.value,
                          })
                        }
                        required
                      />
                      <button type="submit" disabled={passwordSaving}>
                        {passwordSaving ? "Güncelleniyor..." : "Şifreyi güncelle"}
                      </button>
                      {(passwordError || error) && (
                        <div className="account-error profile-password-message">
                          {passwordError || error}
                        </div>
                      )}
                      {(passwordNotice || notice) && (
                        <div className="profile-success profile-password-message">
                          {passwordNotice || notice}
                        </div>
                      )}
                    </form>
                  </div>
                  <div className="profile-status-card">
                    <span>Telefon doğrulama</span>
                    <strong>Hazır bekliyor</strong>
                    <p>
                      SMS servisi bağlandığında telefon doğrulama kodu bu alandan
                      gönderilir.
                    </p>
                  </div>
                </section>

                <section
                  id="preferences"
                  className={sectionClass("preferences", "profile-panel")}
                >
                  <header>
                    <div>
                      <span>Tercihler</span>
                      <h2>Bildirim tercihleri</h2>
                    </div>
                  </header>
                  <div className="profile-preference-grid">
                    <PreferenceToggle
                      title="Kampanya e-postaları"
                      description="Yeni koleksiyon, indirim ve özel fırsatları gönder."
                      checked={notifications.emailCampaigns}
                      onChange={(checked) =>
                        saveNotifications({
                          ...notifications,
                          emailCampaigns: checked,
                        })
                      }
                    />
                    <PreferenceToggle
                      title="WhatsApp bildirimleri"
                      description="Sipariş ve teslimat gelişmelerini WhatsApp ile bildir."
                      checked={notifications.whatsappUpdates}
                      onChange={(checked) =>
                        saveNotifications({
                          ...notifications,
                          whatsappUpdates: checked,
                        })
                      }
                    />
                    <PreferenceToggle
                      title="Stok uyarıları"
                      description="Favori ürünlerde son parça ve stok bilgisini haber ver."
                      checked={notifications.stockAlerts}
                      onChange={(checked) =>
                        saveNotifications({
                          ...notifications,
                          stockAlerts: checked,
                        })
                      }
                    />
                  </div>
                </section>

                <section
                  id="extras"
                  className={sectionClass(
                    "extras",
                    "profile-panel profile-extras-grid",
                  )}
                >
                  <div>
                    <header>
                      <div>
                        <span>Avantaj</span>
                        <h2>Kuponlarım</h2>
                      </div>
                    </header>
                    <div className="profile-coupon-list">
                      <article>
                        <strong>TERRA10</strong>
                        <span>İlk alışverişe özel %10 indirim</span>
                      </article>
                      <article>
                        <strong>KARGO</strong>
                        <span>Belirli tutar üzeri kargo desteği</span>
                      </article>
                    </div>
                  </div>
                  <div>
                    <header>
                      <div>
                        <span>Stok</span>
                        <h2>Stok bildirimi</h2>
                      </div>
                    </header>
                    <div className="profile-stock-list">
                      {stockAlertProducts.length === 0 ? (
                        <p>Şu an kritik stokta ürün yok.</p>
                      ) : (
                        stockAlertProducts.map((product) => (
                          <Link href={`/products/${product.slug || product.id}`} key={product.id}>
                            <span>{product.name}</span>
                            <b>{product.stock} adet</b>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </section>

                <section
                  id="recent"
                  className={sectionClass("recent", "profile-panel")}
                >
                  <header>
                    <div>
                      <span>Keşif</span>
                      <h2>Son görüntülenen ürünler</h2>
                    </div>
                  </header>
                  <ProductRail products={recentProducts} empty="Henüz ürün görüntülenmedi." />
                </section>

                <section
                  id="membership"
                  className={sectionClass(
                    "membership",
                    "profile-panel profile-danger-zone",
                  )}
                >
                  <header>
                    <div>
                      <span>Üyelik</span>
                      <h2>Hesabı sil / üyelikten çık</h2>
                    </div>
                  </header>
                  <p>
                    Hesap kapatma talebi oluşturulduğunda sipariş ve fatura
                    kayıtları yasal süre boyunca saklanır.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice("Hesap kapatma talebi not edildi.");
                      window.setTimeout(() => setNotice(""), 2600);
                    }}
                  >
                    Hesap kapatma talebi oluştur
                  </button>
                </section>
              </div>
            </div>
          </>
        ) : (
          <div className="profile-loading">{error || "Profil bulunamadı."}</div>
        )}
      </section>
      <StoreSiteFooter businessName={businessName} address={businessAddress} />
    </main>
  );
}

function ProductRail({
  products,
  empty,
}: {
  products: Product[];
  empty: string;
}) {
  if (products.length === 0) {
    return <div className="profile-empty-mini">{empty}</div>;
  }
  return (
    <div className="profile-product-rail">
      {products.map((product, index) => (
        <Link href={`/products/${product.slug || product.id}`} key={product.id}>
          <img
            src={product.image}
            alt={product.name}
            loading={index < 6 ? "eager" : "lazy"}
          />
          <span>{product.stone}</span>
          <strong>{product.name}</strong>
          <b>{money.format(getDiscountedPrice(product))}</b>
        </Link>
      ))}
    </div>
  );
}

function PreferenceToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="profile-toggle-card">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}
