import { getOptionalEnv } from "./runtime-env";

type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export function getTransactionalEmailConfiguration() {
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = getOptionalEnv(
    "TRANSACTIONAL_EMAIL_FROM",
    getOptionalEnv("PASSWORD_RESET_FROM_EMAIL"),
  );
  return {
    configured: Boolean(apiKey && from),
    apiKey,
    from,
    senderHint: from || "Gönderici adresi ayarlanmamış",
  };
}

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
) {
  const configuration = getTransactionalEmailConfiguration();
  if (!configuration.configured) {
    throw new Error("Resend e-posta servisi henüz yapılandırılmamış.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${configuration.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey.slice(0, 256),
      "user-agent": "terragolds-storefront/1.0",
    },
    body: JSON.stringify({
      from: configuration.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    let message = "E-posta gönderilemedi.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Resend may return an empty body for upstream failures.
    }
    throw new Error(message);
  }

  return (await response.json()) as { id: string };
}
