import { readSettings } from "../lib/store-db";
import FloatingSocialVisibility from "./floating-social-visibility";
import WhatsAppChatWidget from "./whatsapp-chat-widget";

export async function FloatingSocialLinks() {
  const settings = await readSettings();

  return (
    <FloatingSocialVisibility>
      {settings.whatsapp ? (
        <WhatsAppChatWidget phone={settings.whatsapp} />
      ) : (
        <a
          className="floating-social-link whatsapp"
          href="/support"
          aria-label="Destek"
        >
          <img
            src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/whatsapp.svg"
            alt=""
            width={18}
            height={18}
          />
        </a>
      )}
      {settings.instagram && (
        <a
          className="floating-social-link instagram"
          href={settings.instagram}
          target="_blank"
          rel="noreferrer"
          aria-label="Instagram"
        >
          <img
            src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/instagram.svg"
            alt=""
            width={18}
            height={18}
          />
        </a>
      )}
      {settings.facebook && (
        <a
          className="floating-social-link facebook"
          href={settings.facebook}
          target="_blank"
          rel="noreferrer"
          aria-label="Facebook"
        >
          <img
            src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/facebook.svg"
            alt=""
            width={18}
            height={18}
          />
        </a>
      )}
      {settings.tiktok && (
        <a
          className="floating-social-link tiktok"
          href={settings.tiktok}
          target="_blank"
          rel="noreferrer"
          aria-label="TikTok"
        >
          <img
            src="https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/tiktok.svg"
            alt=""
            width={18}
            height={18}
          />
        </a>
      )}
    </FloatingSocialVisibility>
  );
}
