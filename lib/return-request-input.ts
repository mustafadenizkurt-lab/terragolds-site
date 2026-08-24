const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ibanPattern = /^TR\d{2}[0-9]{22}$/;

export type ReturnRequestInput = {
  fullName: string;
  email: string;
  phone: string;
  orderNumber: string;
  productDescription: string;
  trackingNumber: string;
  reason: string;
  iban: string;
};

function required(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim().slice(0, maxLength);
  if (!text) throw new Error(`${label} boş bırakılamaz.`);
  return text;
}

export function parseReturnRequestInput(
  body: Record<string, unknown>,
): ReturnRequestInput {
  const email = required(body.email, "E-posta", 190).toLowerCase();
  if (!emailPattern.test(email)) {
    throw new Error("Geçerli bir e-posta adresi yazın.");
  }

  const iban = String(body.iban ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (iban && !ibanPattern.test(iban)) {
    throw new Error("IBAN, TR ile başlayan 26 karakterlik geçerli bir numara olmalıdır.");
  }

  return {
    fullName: required(body.fullName, "Ad Soyad", 120),
    email,
    phone: required(body.phone, "Telefon", 30),
    orderNumber: required(body.orderNumber, "Sipariş Numarası", 60),
    productDescription: required(
      body.productDescription,
      "İade edilen ürün(ler)",
      600,
    ),
    trackingNumber: String(body.trackingNumber ?? "").trim().slice(0, 60),
    reason: String(body.reason ?? "").trim().slice(0, 600),
    iban,
  };
}
