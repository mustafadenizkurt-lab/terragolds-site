"use client";

import Link from "next/link";
import { useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import { useLanguage } from "../../lib/language-client";

const copy = {
  tr: {
    accountSecurity: "Hesap güvenliği",
    heroTitleBefore: "Hesabınıza yeniden",
    heroTitleAfter: "güvenle ulaşın.",
    heroTagline: "Süreli bağlantı · Tek kullanım · Güvenli şifreleme",
    passwordSupport: "Şifre desteği",
    newPassword: "Yeni şifre",
    renewYourPassword: "Şifrenizi yenileyin",
    createNewPassword: "Yeni şifre oluşturun",
    requestCopy:
      "Hesabınıza bağlı e-posta adresini yazın. Geçerli bağlantıyı e-posta kutunuza gönderelim.",
    resetCopy:
      "Hesabınız için daha önce kullanmadığınız, en az 10 karakterli güçlü bir şifre belirleyin.",
    devLink: "Yerel test bağlantısını aç →",
    email: "E-posta",
    newPasswordLabel: "Yeni şifre",
    minChars: "En az 10 karakter kullanın.",
    newPasswordRepeat: "Yeni şifre tekrar",
    pleaseWait: "Lütfen bekleyin…",
    sendResetLink: "Sıfırlama bağlantısı gönder",
    renewPassword: "Şifremi yenile",
    missingResetLink: "Şifre sıfırlama bağlantısı eksik.",
    backToLogin: "← Giriş sayfasına dön",
    passwordsDontMatch: "Yeni şifreler birbiriyle eşleşmiyor.",
    genericError: "İşlem tamamlanamadı.",
    genericSuccess: "İşlem tamamlandı.",
  },
  en: {
    accountSecurity: "Account security",
    heroTitleBefore: "Get back into",
    heroTitleAfter: "your account securely.",
    heroTagline: "Time-limited link · Single use · Secure encryption",
    passwordSupport: "Password support",
    newPassword: "New password",
    renewYourPassword: "Reset your password",
    createNewPassword: "Create a new password",
    requestCopy:
      "Enter the email address linked to your account. We'll send a valid link to your inbox.",
    resetCopy:
      "Choose a strong password for your account, at least 10 characters, that you haven't used before.",
    devLink: "Open local test link →",
    email: "Email",
    newPasswordLabel: "New password",
    minChars: "Use at least 10 characters.",
    newPasswordRepeat: "Repeat new password",
    pleaseWait: "Please wait…",
    sendResetLink: "Send reset link",
    renewPassword: "Reset my password",
    missingResetLink: "The password reset link is missing.",
    backToLogin: "← Back to sign in",
    passwordsDontMatch: "The new passwords don't match.",
    genericError: "The request could not be completed.",
    genericSuccess: "Done.",
  },
} as const;

export default function PasswordRecoveryForm({
  mode,
  token = "",
}: {
  mode: "request" | "reset";
  token?: string;
}) {
  const [language] = useLanguage();
  const t = copy[language];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setDevResetUrl("");

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    if (
      mode === "reset" &&
      String(payload.password ?? "") !== String(payload.confirmPassword ?? "")
    ) {
      setError(t.passwordsDontMatch);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        mode === "request"
          ? "/api/auth/forgot-password"
          : "/api/auth/reset-password",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            mode === "request"
              ? { email: payload.email }
              : { token, password: payload.password },
          ),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        message?: string;
        devResetUrl?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? t.genericError);
      }
      setSuccess(body.message ?? t.genericSuccess);
      setDevResetUrl(body.devResetUrl ?? "");
      event.currentTarget.reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t.genericError,
      );
    } finally {
      setLoading(false);
    }
  };

  const isRequest = mode === "request";

  return (
    <main className="account-page has-store-header">
      <div className="account-store-header">
        <StoreSubpageHeader />
      </div>
      <section className="account-visual">
        <Link className="account-brand" href="/">
          TERRA<strong>GOLDS</strong>
        </Link>
        <div>
          <p>{t.accountSecurity}</p>
          <h1>
            {t.heroTitleBefore}
            <br />
            <em>{t.heroTitleAfter}</em>
          </h1>
          <span>{t.heroTagline}</span>
        </div>
      </section>

      <section className="account-form-wrap">
        <div className="account-form-card">
          <p className="account-kicker">
            {isRequest ? t.passwordSupport : t.newPassword}
          </p>
          <h2>{isRequest ? t.renewYourPassword : t.createNewPassword}</h2>
          <p className="account-form-copy">
            {isRequest ? t.requestCopy : t.resetCopy}
          </p>

          {error && (
            <div className="account-error" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="profile-success" role="status">
              {success}
            </div>
          )}
          {devResetUrl && (
            <a className="account-dev-link" href={devResetUrl}>
              {t.devLink}
            </a>
          )}

          {!success || isRequest ? (
            <form onSubmit={submit}>
              {isRequest ? (
                <label>
                  <span>{t.email}</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
              ) : (
                <>
                  <label>
                    <span>{t.newPasswordLabel}</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                    />
                    <small>{t.minChars}</small>
                  </label>
                  <label>
                    <span>{t.newPasswordRepeat}</span>
                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                    />
                  </label>
                </>
              )}
              <button type="submit" disabled={loading || (!isRequest && !token)}>
                {loading ? t.pleaseWait : isRequest ? t.sendResetLink : t.renewPassword}
              </button>
            </form>
          ) : null}

          {!token && !isRequest && (
            <div className="account-error" role="alert">
              {t.missingResetLink}
            </div>
          )}
          <Link className="account-back" href="/login">
            {t.backToLogin}
          </Link>
        </div>
      </section>
    </main>
  );
}
