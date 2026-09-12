"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";
import { useLanguage } from "../../lib/language-client";

type VerificationState = "waiting" | "verifying" | "success" | "error";

const copy = {
  tr: {
    initialMessage: "Doğrulama bağlantısı e-posta adresinize gönderildi.",
    verifyFailed: "E-posta doğrulanamadı.",
    verifiedSuccess: "E-posta adresiniz doğrulandı. Alışverişe devam edebilirsiniz.",
    resendSuccess: "Yeni doğrulama bağlantısı e-posta adresinize gönderildi.",
    resendFailed: "Doğrulama bağlantısı gönderilemedi.",
    accountSecurity: "Hesap güvenliği",
    verifiedTitle: "E-posta doğrulandı",
    verifyingTitle: "E-posta doğrulanıyor",
    verifyTitle: "E-posta adresinizi doğrulayın",
    continueShopping: "Alışverişe devam et",
    sending: "Gönderiliyor…",
    resendLink: "Doğrulama bağlantısını tekrar gönder",
    backToAccount: "Hesabıma dön",
  },
  en: {
    initialMessage: "A verification link has been sent to your email address.",
    verifyFailed: "The email could not be verified.",
    verifiedSuccess: "Your email address has been verified. You can continue shopping.",
    resendSuccess: "A new verification link has been sent to your email address.",
    resendFailed: "The verification link could not be sent.",
    accountSecurity: "Account security",
    verifiedTitle: "Email verified",
    verifyingTitle: "Verifying email",
    verifyTitle: "Verify your email address",
    continueShopping: "Continue shopping",
    sending: "Sending…",
    resendLink: "Resend verification link",
    backToAccount: "Back to my account",
  },
} as const;

export default function VerifyEmailClient() {
  const [language] = useLanguage();
  const t = copy[language];
  const [state, setState] = useState<VerificationState>("waiting");
  const [message, setMessage] = useState<string>(t.initialMessage);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const token = parameters.get("token");
    if (!token) return;

    fetch("/api/auth/email-verification/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { error?: string };
        if (!response.ok) {
          throw new Error(body.error || t.verifyFailed);
        }
        setState("success");
        setMessage(t.verifiedSuccess);
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : t.verifyFailed);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async () => {
    setResending(true);
    try {
      const response = await fetch("/api/auth/email-verification/send", {
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        verification?: { devVerifyUrl?: string };
      };
      if (!response.ok) throw new Error(body.error);
      if (body.verification?.devVerifyUrl) {
        window.location.assign(body.verification.devVerifyUrl);
        return;
      }
      setState("waiting");
      setMessage(t.resendSuccess);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : t.resendFailed);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="verification-page">
      <StoreSubpageHeader />
      <section className={`verification-card ${state}`}>
        <span className="verification-mark" aria-hidden="true">
          {state === "success" ? "✓" : state === "error" ? "!" : "@"}
        </span>
        <p>{t.accountSecurity}</p>
        <h1>
          {state === "success"
            ? t.verifiedTitle
            : state === "verifying"
              ? t.verifyingTitle
              : t.verifyTitle}
        </h1>
        <span>{message}</span>
        {state === "success" ? (
          <Link className="verification-primary" href="/#shop">
            {t.continueShopping}
          </Link>
        ) : (
          <button
            className="verification-primary"
            type="button"
            disabled={resending || state === "verifying"}
            onClick={() => void resend()}
          >
            {resending ? t.sending : t.resendLink}
          </button>
        )}
        <Link className="verification-secondary" href="/profile">
          {t.backToAccount}
        </Link>
      </section>
    </main>
  );
}
