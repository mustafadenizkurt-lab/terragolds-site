"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StoreSubpageHeader from "../store-subpage-header";

type VerificationState = "waiting" | "verifying" | "success" | "error";

export default function VerifyEmailClient() {
  const [state, setState] = useState<VerificationState>("waiting");
  const [message, setMessage] = useState(
    "Doğrulama bağlantısı e-posta adresinize gönderildi.",
  );
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
          throw new Error(body.error || "E-posta doğrulanamadı.");
        }
        setState("success");
        setMessage("E-posta adresiniz doğrulandı. Alışverişe devam edebilirsiniz.");
      })
      .catch((error) => {
        setState("error");
        setMessage(
          error instanceof Error ? error.message : "E-posta doğrulanamadı.",
        );
      });
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
      setMessage("Yeni doğrulama bağlantısı e-posta adresinize gönderildi.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Doğrulama bağlantısı gönderilemedi.",
      );
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
        <p>Hesap güvenliği</p>
        <h1>
          {state === "success"
            ? "E-posta doğrulandı"
            : state === "verifying"
              ? "E-posta doğrulanıyor"
              : "E-posta adresinizi doğrulayın"}
        </h1>
        <span>{message}</span>
        {state === "success" ? (
          <Link className="verification-primary" href="/#shop">
            Alışverişe devam et
          </Link>
        ) : (
          <button
            className="verification-primary"
            type="button"
            disabled={resending || state === "verifying"}
            onClick={() => void resend()}
          >
            {resending ? "Gönderiliyor…" : "Doğrulama bağlantısını tekrar gönder"}
          </button>
        )}
        <Link className="verification-secondary" href="/profile">
          Hesabıma dön
        </Link>
      </section>
    </main>
  );
}
