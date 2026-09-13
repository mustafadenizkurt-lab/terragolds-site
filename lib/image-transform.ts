// Ürün fotoğrafları tedarikçinin kendi sunucusundan (app.ebijuteri.com)
// orijinal boyutunda çekiliyordu - küçük bir kart için bile birkaç MB'lık
// tam çözünürlüklü dosya indirilip decode ediliyordu, bu da özellikle
// telefonlarda kaydırırken (birden fazla kart aynı anda ekrana giriyor)
// ciddi yavaşlığa yol açıyordu. Cloudflare'in bu zone için açılan Image
// Transformations özelliği (dash.cloudflare.com > Transformations, kaynak
// olarak app.ebijuteri.com eklendi) /cdn-cgi/image/... yolu üzerinden
// resmi istenen genişlikte ve tarayıcıya en uygun formatta (format=auto:
// destekleniyorsa WebP/AVIF) kenarda dönüştürüp önbelliğe alıyor - orijinal
// dosyaya hiç dokunmadan.
export function optimizedImageUrl(src: string, width: number, quality = 75): string {
  if (!src || !src.startsWith("http")) return src;
  return `/cdn-cgi/image/width=${width},quality=${quality},format=auto/${src}`;
}
