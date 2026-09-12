// CSS uppercases these via text-transform, which ignores document language
// and turns "i" into a dotless "I" instead of Turkish "İ" (e.g. "Güvenli"
// -> "GÜVENLI" instead of "GÜVENLİ"). Uppercasing with the Turkish locale
// here renders the correct letter; the CSS transform then leaves it alone.
const trUpper = (text: string) => text.toLocaleUpperCase("tr-TR");

export default function StoreTrustBar() {
  return (
    <div className="catalog-trust-strip subpage-trust-strip" aria-label="Magaza guvenceleri">
      <span>{trUpper("Güvenli paketleme")}</span>
      <span>{trUpper("Türkiye geneli gönderim")}</span>
      <span>{trUpper("14 gün destek")}</span>
    </div>
  );
}
