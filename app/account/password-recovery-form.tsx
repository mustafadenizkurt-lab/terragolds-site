"use client";

import Link from "next/link";
import { useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";

export default function PasswordRecoveryForm({
  mode,
  token = "",
}: {
  mode: "request" | "reset";
  token?: string;
}) {
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
      setError("Yeni şifreler birbiriyle eşleşmiyor.");
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
        throw new Error(body.error ?? "İşlem tamamlanamadı.");
      }
      setSuccess(body.message ?? "İşlem tamamlandı.");
      setDevResetUrl(body.devResetUrl ?? "");
      event.currentTarget.reset();
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
          <p>Hesap güvenliği</p>
          <h1>
            Hesabınıza yeniden
            <br />
            <em>güvenle ulaşın.</em>
          </h1>
          <span>Süreli bağlantı · Tek kullanım · Güvenli şifreleme</span>
        </div>
      </section>

      <section className="account-form-wrap">
        <div className="account-form-card">
          <p className="account-kicker">
            {isRequest ? "Şifre desteği" : "Yeni şifre"}
          </p>
          <h2>{isRequest ? "Şifrenizi yenileyin" : "Yeni şifre oluşturun"}</h2>
          <p className="account-form-copy">
            {isRequest
              ? "Hesabınıza bağlı e-posta adresini yazın. Geçerli bağlantıyı e-posta kutunuza gönderelim."
              : "Hesabınız için daha önce kullanmadığınız, en az 10 karakterli güçlü bir şifre belirleyin."}
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
              Yerel test bağlantısını aç →
            </a>
          )}

          {!success || isRequest ? (
            <form onSubmit={submit}>
              {isRequest ? (
                <label>
                  <span>E-posta</span>
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
                    <span>Yeni şifre</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      required
                    />
                    <small>En az 10 karakter kullanın.</small>
                  </label>
                  <label>
                    <span>Yeni şifre tekrar</span>
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
                {loading
                  ? "Lütfen bekleyin…"
                  : isRequest
                    ? "Sıfırlama bağlantısı gönder"
                    : "Şifremi yenile"}
              </button>
            </form>
          ) : null}

          {!token && !isRequest && (
            <div className="account-error" role="alert">
              Şifre sıfırlama bağlantısı eksik.
            </div>
          )}
          <Link className="account-back" href="/login">
            ← Giriş sayfasına dön
          </Link>
        </div>
      </section>
    </main>
  );
}
