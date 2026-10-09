import { permanentRedirect } from "next/navigation";

// Özel üretim hizmeti artık sunulmuyor - sayfa kaldırıldı. Google bu URL'yi
// daha önce indekslediği için düz bir 404 yerine ana sayfaya 301 ile
// yönlendiriyoruz (bkz. app/iletisim/page.tsx'teki aynı desen).
export default function OzelUretimRedirect(): never {
  permanentRedirect("/");
}
