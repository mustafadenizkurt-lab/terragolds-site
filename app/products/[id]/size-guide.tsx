const RING_KEYWORD = "yüzük";
const BRACELET_KEYWORDS = ["bileklik", "hal hal", "halhal"];

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
}: {
  category: string;
  productName: string;
}) {
  if (!hasSizeGuide(category)) return null;

  const isAdjustable = /ayarlan|ayarlam/i.test(productName);
  const ring = isRingCategory(category);

  return (
    <div className="faq-list product-size-guide">
      <details>
        <summary>
          Ölçü Rehberi
          <span aria-hidden="true">+</span>
        </summary>
        {ring ? (
          <>
            <p>
              Yüzük ölçünüzü evde ölçmek için bir ip veya ince kağıt şerit
              parmağınızın etrafına sarın, uçların birleştiği noktayı
              işaretleyip cetvelle milimetre cinsinden ölçün — bu iç çevre
              ölçünüzdür.
            </p>
            <p>
              Türkiye&apos;de yaygın kullanılan yüzük numaralandırması iç
              çevrenin milimetre karşılığına denk gelir (ör. 52 numara ≈ 52 mm
              iç çevre). Genel bir referans olarak: küçük beden ≈ 46–50 mm,
              orta beden ≈ 51–56 mm, büyük beden ≈ 57–62 mm.
            </p>
          </>
        ) : (
          <p>
            Bileklik/halhal ölçünüz için bir mezura veya ip ile bileğinizin ya
            da ayak bileğinizin en geniş noktasının çevresini ölçün, rahat bir
            duruş için 1–1,5 cm ekleyin.
          </p>
        )}
        {isAdjustable && (
          <p>
            <strong>Bu ürün ayarlanabilir modeldir</strong> — çoğu{" "}
            {ring ? "el" : "bilek"} ölçüsüne uyum sağlar, tam ölçü seçimi
            gerekmez.
          </p>
        )}
      </details>
    </div>
  );
}
