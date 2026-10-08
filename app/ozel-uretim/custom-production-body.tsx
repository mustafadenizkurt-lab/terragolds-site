"use client";

import { useState } from "react";

type Photo = { imageUrl: string; caption: string };

export default function CustomProductionBody({
  whatsapp,
  photos,
}: {
  whatsapp: string;
  photos: Photo[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!whatsapp) {
      setError(
        "Şu anda WhatsApp üzerinden talep alamıyoruz, lütfen bizi telefonla arayın.",
      );
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    const message = `Merhaba, özel üretim talebim var.\nAd Soyad: ${name}\nTelefon: ${phone}`;
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="about-page-body">
      <section className="about-hero section-shell">
        <div>
          <p className="eyebrow">Özel Üretim</p>
          <h1>Hayalinizdeki takıyı birlikte tasarlayalım.</h1>
          <p>
            Aklınızdaki tasarımı, özel bir günü veya ailenizden kalan bir
            parçayı yeniden yorumlamak istiyorsanız bize ulaşın. Adınızı ve
            telefon numaranızı bırakın, WhatsApp üzerinden size dönüş yapalım.
          </p>
        </div>
      </section>

      <section className="section-shell">
        <div className="return-request-form">
          <h2>Talep Formu</h2>
          <p>
            Formu doldurup gönderdiğinizde WhatsApp uygulaması, talebinizin
            bir kısmı önceden doldurulmuş olarak açılır.
          </p>
          {error && (
            <div className="return-request-error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit}>
            <div className="return-request-fields">
              <label className="return-request-field">
                <span>Ad Soyad *</span>
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="return-request-field">
                <span>Telefon *</span>
                <input
                  required
                  maxLength={30}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="05xx xxx xx xx"
                />
              </label>
            </div>
            <button type="submit" className="button button-dark wide">
              WhatsApp'tan Gönder
            </button>
          </form>
        </div>
      </section>

      <section className="section-shell">
        <h2>Geçmiş özel üretim örnekleri</h2>
        {photos.length ? (
          <div className="custom-production-gallery">
            {photos.map((photo, index) => (
              <figure key={`${photo.imageUrl}-${index}`}>
                <img src={photo.imageUrl} alt={photo.caption || "Özel üretim örneği"} loading="lazy" />
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
              </figure>
            ))}
          </div>
        ) : (
          <p className="custom-production-gallery-empty">
            Özel üretim örnekleri yakında burada yer alacak.
          </p>
        )}
      </section>
    </div>
  );
}
