"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";

export default function AuthForm({
  mode,
}: {
  mode: "login" | "register";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState("");

  useEffect(() => {
    if (mode !== "login") return;
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
  }, [mode]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    if (!captchaQuestion) delete payload.captchaAnswer;

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        error?: string;
        requiresCaptcha?: boolean;
        captcha?: { question?: string };
        verification?: { devVerifyUrl?: string };
      };
      if (!response.ok) {
        if (body.requiresCaptcha && body.captcha?.question) {
          setCaptchaQuestion(body.captcha.question);
        }
        throw new Error(body.error ?? "İşlem tamamlanamadı.");
      }

      setCaptchaQuestion("");
      const requestedPath = new URLSearchParams(window.location.search).get(
        "return_to",
      );
      const safeRequestedPath =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : null;
      if (mode === "register") {
        window.location.href =
          body.verification?.devVerifyUrl ??
          `/verify-email?sent=1${
            safeRequestedPath
              ? `&return_to=${encodeURIComponent(safeRequestedPath)}`
              : ""
          }`;
        return;
      }
      window.location.href = safeRequestedPath ?? "/orders";
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "İşlem tamamlanamadı.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <main
      className={`account-page login-minimal${
        isRegister ? " register-minimal" : ""
      }`}
    >
      <StoreSubpageHeader />
      <section className="account-visual">
        <Link className="account-brand" href="/">
          TERRA<strong>GOLDS</strong>
        </Link>
        <div>
          <p>Üyelik</p>
          <h1>
            Seçtiğiniz taşların{" "}
            <br />
            <em>hikayesini takip edin.</em>
          </h1>
          <span>Sipariş geçmişi · Güvenli ödeme · Hızlı teslimat</span>
        </div>
      </section>

      <section className="account-form-wrap">
        <div className="account-form-card">
          <div className="login-card-tabs">
            {isRegister ? (
              <>
                <Link href="/login">Giriş Yap</Link>
                <strong>Üye Ol</strong>
              </>
            ) : (
              <>
                <strong>Giriş Yap</strong>
                <Link href="/register">Üye Ol</Link>
              </>
            )}
          </div>
          <h2>{isRegister ? "Üye Ol" : "Giriş Yap"}</h2>

          {error && (
            <div className="account-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            {isRegister && (
              <div className="account-field-row">
                <label>
                  <span>Ad</span>
                  <input
                    name="firstName"
                    autoComplete="given-name"
                    onChange={(event) => {
                      event.currentTarget.value =
                        event.currentTarget.value.toLocaleUpperCase("tr-TR");
                    }}
                    required
                  />
                </label>
                <label>
                  <span>Soyad</span>
                  <input
                    name="lastName"
                    autoComplete="family-name"
                    onChange={(event) => {
                      event.currentTarget.value =
                        event.currentTarget.value.toLocaleUpperCase("tr-TR");
                    }}
                    required
                  />
                </label>
              </div>
            )}
            <label>
              <span>E-posta</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            {isRegister && (
              <label>
                <span>Telefon</span>
                <input name="phone" type="tel" autoComplete="tel" />
              </label>
            )}
            <label>
              <span className="account-password-label">
                Şifre
                {!isRegister && (
                  <Link href="/forgot-password">Şifremi unuttum</Link>
                )}
              </span>
              <span className="account-password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={10}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span
                    className={`account-eye-icon${showPassword ? " is-open" : ""}`}
                  />
                </button>
              </span>
              {isRegister && <small>En az 10 karakter kullanın.</small>}
            </label>

            {!isRegister && captchaQuestion && (
              <label className="account-captcha-field">
                <span>Güvenlik doğrulaması</span>
                <strong>{captchaQuestion}</strong>
                <input
                  name="captchaAnswer"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Cevabı yazın"
                  required
                />
              </label>
            )}

            {isRegister && (
              <label className="account-legal-consent">
                <span className="legal-consent-checkbox">
                  <input name="legalConsent" type="checkbox" required />
                </span>
                <span>
                  <Link href="/kvkk" target="_blank">
                    KVKK Aydınlatma Metni
                  </Link>
                  'ni okudum. {" "}
                  <Link href="/kullanim-kosullari" target="_blank">
                    Kullanım Koşulları
                  </Link>{" "}
                  ve {" "}
                  <Link href="/gizlilik-politikasi" target="_blank">
                    Gizlilik Politikası
                  </Link>
                  'nı kabul ediyorum.
                </span>
              </label>
            )}

            <button type="submit" disabled={loading}>
              {loading
                ? "Lütfen bekleyin..."
                : isRegister
                  ? "Hesap oluştur"
                  : "Giriş yap"}
            </button>
            {!isRegister && (
              <p className="account-forgot-help">
                Şifrenizi hatırlamıyor musunuz?{" "}
                <Link href="/forgot-password">
                  Yeni şifre bağlantısı alın
                </Link>
              </p>
            )}
          </form>

          <p className="account-switch">
            {isRegister ? "Zaten hesabınız var mı?" : "Henüz üye değil misiniz?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Giriş yapın" : "Üye Ol"}
            </Link>
          </p>
          <Link className="account-back" href="/">
            ← Mağazaya dön
          </Link>
        </div>
      </section>
    </main>
  );
}
