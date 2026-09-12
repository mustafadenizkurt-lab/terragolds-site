"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import { useLanguage } from "../../lib/language-client";

const copy = {
  tr: {
    membership: "Üyelik",
    heroTitleBefore: "Seçtiğiniz taşların",
    heroTitleAfter: "hikayesini takip edin.",
    heroTagline: "Sipariş geçmişi · Güvenli ödeme · Hızlı teslimat",
    login: "Giriş Yap",
    register: "Üye Ol",
    firstName: "Ad",
    lastName: "Soyad",
    email: "E-posta",
    phone: "Telefon",
    password: "Şifre",
    forgotPassword: "Şifremi unuttum",
    hidePassword: "Şifreyi gizle",
    showPassword: "Şifreyi göster",
    minChars: "En az 10 karakter kullanın.",
    securityCheck: "Güvenlik doğrulaması",
    answerPlaceholder: "Cevabı yazın",
    consentBefore: "",
    kvkk: "KVKK Aydınlatma Metni",
    consentMiddle1: "'ni okudum. ",
    terms: "Kullanım Koşulları",
    consentAnd: " ve ",
    privacy: "Gizlilik Politikası",
    consentMiddle2: "'nı kabul ediyorum.",
    pleaseWait: "Lütfen bekleyin...",
    createAccount: "Hesap oluştur",
    signIn: "Giriş yap",
    forgotPasswordHelp: "Şifrenizi hatırlamıyor musunuz?",
    getNewPasswordLink: "Yeni şifre bağlantısı alın",
    alreadyHaveAccount: "Zaten hesabınız var mı?",
    notMemberYet: "Henüz üye değil misiniz?",
    signInAction: "Giriş yapın",
    backToStore: "← Mağazaya dön",
    genericError: "İşlem tamamlanamadı.",
  },
  en: {
    membership: "Membership",
    heroTitleBefore: "Follow the story",
    heroTitleAfter: "of the stones you choose.",
    heroTagline: "Order history · Secure payment · Fast delivery",
    login: "Sign In",
    register: "Sign Up",
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    password: "Password",
    forgotPassword: "Forgot password",
    hidePassword: "Hide password",
    showPassword: "Show password",
    minChars: "Use at least 10 characters.",
    securityCheck: "Security check",
    answerPlaceholder: "Type the answer",
    consentBefore: "",
    kvkk: "Privacy Notice (KVKK)",
    consentMiddle1: ", ",
    terms: "Terms of Use",
    consentAnd: " and ",
    privacy: "Privacy Policy",
    consentMiddle2: ", I have read and accept.",
    pleaseWait: "Please wait...",
    createAccount: "Create account",
    signIn: "Sign in",
    forgotPasswordHelp: "Don't remember your password?",
    getNewPasswordLink: "Get a new password link",
    alreadyHaveAccount: "Already have an account?",
    notMemberYet: "Not a member yet?",
    signInAction: "Sign in",
    backToStore: "← Back to store",
    genericError: "The request could not be completed.",
  },
} as const;

export default function AuthForm({
  mode,
}: {
  mode: "login" | "register";
}) {
  const [language] = useLanguage();
  const t = copy[language];
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
        user?: { role?: string };
      };
      if (!response.ok) {
        if (body.requiresCaptcha && body.captcha?.question) {
          setCaptchaQuestion(body.captcha.question);
        }
        throw new Error(body.error ?? t.genericError);
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
      window.location.href =
        safeRequestedPath ?? (body.user?.role === "partner" ? "/partner" : "/orders");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t.genericError,
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
          <p>{t.membership}</p>
          <h1>
            {t.heroTitleBefore} <br />
            <em>{t.heroTitleAfter}</em>
          </h1>
          <span>{t.heroTagline}</span>
        </div>
      </section>

      <section className="account-form-wrap">
        <div className="account-form-card">
          <div className="login-card-tabs">
            {isRegister ? (
              <>
                <Link href="/login">{t.login}</Link>
                <strong>{t.register}</strong>
              </>
            ) : (
              <>
                <strong>{t.login}</strong>
                <Link href="/register">{t.register}</Link>
              </>
            )}
          </div>
          <h2>{isRegister ? t.register : t.login}</h2>

          {error && (
            <div className="account-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            {isRegister && (
              <div className="account-field-row">
                <label>
                  <span>{t.firstName}</span>
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
                  <span>{t.lastName}</span>
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
              <span>{t.email}</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </label>
            {isRegister && (
              <label>
                <span>{t.phone}</span>
                <input name="phone" type="tel" autoComplete="tel" />
              </label>
            )}
            <label>
              <span className="account-password-label">
                {t.password}
                {!isRegister && (
                  <Link href="/forgot-password">{t.forgotPassword}</Link>
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
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <span
                    className={`account-eye-icon${showPassword ? " is-open" : ""}`}
                  />
                </button>
              </span>
              {isRegister && <small>{t.minChars}</small>}
            </label>

            {!isRegister && captchaQuestion && (
              <label className="account-captcha-field">
                <span>{t.securityCheck}</span>
                <strong>{captchaQuestion}</strong>
                <input
                  name="captchaAnswer"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t.answerPlaceholder}
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
                    {t.kvkk}
                  </Link>
                  {t.consentMiddle1}
                  <Link href="/kullanim-kosullari" target="_blank">
                    {t.terms}
                  </Link>
                  {t.consentAnd}
                  <Link href="/gizlilik-politikasi" target="_blank">
                    {t.privacy}
                  </Link>
                  {t.consentMiddle2}
                </span>
              </label>
            )}

            <button type="submit" disabled={loading}>
              {loading ? t.pleaseWait : isRegister ? t.createAccount : t.signIn}
            </button>
            {!isRegister && (
              <p className="account-forgot-help">
                {t.forgotPasswordHelp}{" "}
                <Link href="/forgot-password">{t.getNewPasswordLink}</Link>
              </p>
            )}
          </form>

          <p className="account-switch">
            {isRegister ? t.alreadyHaveAccount : t.notMemberYet}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? t.signInAction : t.register}
            </Link>
          </p>
          <Link className="account-back" href="/">
            {t.backToStore}
          </Link>
        </div>
      </section>
    </main>
  );
}
