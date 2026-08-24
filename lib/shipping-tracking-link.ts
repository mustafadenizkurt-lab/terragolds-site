const carrierLinks = [
  {
    match: ["yurtici", "yurtiçi"],
    url: (trackingNumber: string) =>
      `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["aras"],
    url: (trackingNumber: string) =>
      `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["mng"],
    url: (trackingNumber: string) =>
      `https://www.mngkargo.com.tr/gonderi-takip?code=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["surat", "sürat"],
    url: (trackingNumber: string) =>
      `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["ptt"],
    url: (trackingNumber: string) =>
      `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["ups"],
    url: (trackingNumber: string) =>
      `https://www.ups.com/track?loc=tr_TR&tracknum=${encodeURIComponent(trackingNumber)}`,
  },
  {
    match: ["hepsijet"],
    url: (trackingNumber: string) =>
      `https://www.hepsijet.com/gonderi-takibi/${encodeURIComponent(trackingNumber)}`,
  },
];

function normalizeCarrier(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function createShippingTrackingUrl(input: {
  carrier: string;
  trackingNumber: string;
}) {
  const carrier = input.carrier.trim();
  const trackingNumber = input.trackingNumber.trim();
  if (!carrier || !trackingNumber) return "";

  const normalizedCarrier = normalizeCarrier(carrier);
  const carrierMatch = carrierLinks.find((entry) =>
    entry.match.some((name) => normalizedCarrier.includes(name)),
  );
  if (carrierMatch) return carrierMatch.url(trackingNumber);

  const query = `${carrier} kargo takip ${trackingNumber}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function createAutoDeliverAt(shippedAt: string | null) {
  if (!shippedAt) return null;
  const shippedTime = new Date(shippedAt).getTime();
  if (!Number.isFinite(shippedTime)) return null;
  return new Date(shippedTime + 7 * 24 * 60 * 60 * 1000).toISOString();
}
