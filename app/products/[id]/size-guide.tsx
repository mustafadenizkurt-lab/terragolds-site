import type { Language } from "../../../lib/i18n";

const RING_KEYWORD = "yüzük";
const BRACELET_KEYWORDS = ["bileklik", "hal hal", "halhal"];

const copy = {
  tr: {
    heading: "Ölçü Rehberi",
    ringP1:
      "Yüzük ölçünüzü evde ölçmek için bir ip veya ince kağıt şerit parmağınızın etrafına sarın, uçların birleştiği noktayı işaretleyip cetvelle milimetre cinsinden ölçün — bu iç çevre ölçünüzdür.",
    ringP2:
      "Türkiye'de yaygın kullanılan yüzük numaralandırması iç çevrenin milimetre karşılığına denk gelir (ör. 52 numara ≈ 52 mm iç çevre). Genel bir referans olarak: küçük beden ≈ 46–50 mm, orta beden ≈ 51–56 mm, büyük beden ≈ 57–62 mm.",
    braceletP:
      "Bileklik/halhal ölçünüz için bir mezura veya ip ile bileğinizin ya da ayak bileğinizin en geniş noktasının çevresini ölçün, rahat bir duruş için 1–1,5 cm ekleyin.",
    adjustable: "Bu ürün ayarlanabilir modeldir",
    adjustableDetail: (part: string) => ` — çoğu ${part} ölçüsüne uyum sağlar, tam ölçü seçimi gerekmez.`,
    hand: "el",
    wrist: "bilek",
  },
  en: {
    heading: "Size Guide",
    ringP1:
      "To measure your ring size at home, wrap a string or thin paper strip around your finger, mark where the ends meet, then measure that length in millimeters with a ruler — that's your inner circumference.",
    ringP2:
      "Common ring-size systems correspond to that inner circumference in millimeters (e.g. size 52 ≈ 52 mm inner circumference). As a general reference: small ≈ 46–50 mm, medium ≈ 51–56 mm, large ≈ 57–62 mm.",
    braceletP:
      "To measure for a bracelet/anklet, use a tape measure or string around the widest point of your wrist or ankle, and add 1–1.5 cm for a comfortable fit.",
    adjustable: "This is an adjustable design",
    adjustableDetail: (part: string) => ` — it fits most ${part} sizes, no exact size needed.`,
    hand: "hand",
    wrist: "wrist",
  },
} as const;

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR");
}

function isRingCategory(category: string) {
  return normalize(category).includes(RING_KEYWORD);
}

function isBraceletCategory(category: string) {
  const normalized = normalize(category);
  return BRACELET_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/** Whether this product's category warrants showing the size guide at all. */
export function hasSizeGuide(category: string) {
  return isRingCategory(category) || isBraceletCategory(category);
}

/**
 * A general measurement guide (string/tape method + a widely-used size
 * reference), not a per-product spec sheet - we don't have per-product
 * dimensions in the database, so this deliberately never claims an exact
 * fit for the specific item, only how to measure yourself and a standard
 * reference range. Reuses the site's existing .faq-list accordion look.
 */
export default function SizeGuide({
  category,
  productName,
  language,
}: {
  category: string;
  productName: string;
  language: Language;
}) {
  if (!hasSizeGuide(category)) return null;

  const isAdjustable = /ayarlan|ayarlam/i.test(productName);
  const ring = isRingCategory(category);
  const t = copy[language];

  return (
    <div className="faq-list product-size-guide">
      <details>
        <summary>
          {t.heading}
          <span aria-hidden="true">+</span>
        </summary>
        {ring ? (
          <>
            <p>{t.ringP1}</p>
            <p>{t.ringP2}</p>
          </>
        ) : (
          <p>{t.braceletP}</p>
        )}
        {isAdjustable && (
          <p>
            <strong>{t.adjustable}</strong>
            {t.adjustableDetail(ring ? t.hand : t.wrist)}
          </p>
        )}
      </details>
    </div>
  );
}
