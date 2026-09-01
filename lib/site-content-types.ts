export type SiteContent = {
  homeHeroEyebrow: string;
  homeHeroTitle: string;
  homeHeroAccent: string;
  homeHeroDescription: string;
  homeHeroPrimaryLabel: string;
  homeHeroSecondaryLabel: string;
  homeHeroNote: string;
  homeIntroEyebrow: string;
  homeIntroTitle: string;
  homeIntroBody: string;
  homeShopEyebrow: string;
  homeShopTitle: string;
  homeShopDescription: string;
  homeGuideEyebrow: string;
  homeGuideTitle: string;
  homeGuideDescription: string;
  homeTileRawStonesImage: string;
  homeTileRawStonesTitle: string;
  homeTileRawStonesTagline: string;
  homeTileRawStonesLink: string;
  homeTileMeditationImage: string;
  homeTileMeditationTitle: string;
  homeTileMeditationTagline: string;
  homeTileMeditationLink: string;
  homeTileCollectionSetsImage: string;
  homeTileCollectionSetsTitle: string;
  homeTileCollectionSetsTagline: string;
  homeTileCollectionSetsLink: string;
  supportEyebrow: string;
  supportTitle: string;
  supportDescription: string;
  supportShippingTitle: string;
  supportShippingBody: string;
  supportReturnsTitle: string;
  supportReturnsBody: string;
  supportCareTitle: string;
  supportCareBody: string;
  navigationProducts: string;
  navigationGuide: string;
  navigationSupport: string;
  footerDescription: string;
  seoHomeTitle: string;
  seoHomeDescription: string;
  seoSupportTitle: string;
  seoSupportDescription: string;
  legalKvkkEyebrow: string;
  legalKvkkTitle: string;
  legalKvkkSummary: string;
  legalKvkkUpdated: string;
  legalKvkkSections: string;
  legalPrivacyEyebrow: string;
  legalPrivacyTitle: string;
  legalPrivacySummary: string;
  legalPrivacyUpdated: string;
  legalPrivacySections: string;
  legalCookiesEyebrow: string;
  legalCookiesTitle: string;
  legalCookiesSummary: string;
  legalCookiesUpdated: string;
  legalCookiesSections: string;
  legalDistanceSalesEyebrow: string;
  legalDistanceSalesTitle: string;
  legalDistanceSalesSummary: string;
  legalDistanceSalesUpdated: string;
  legalDistanceSalesSections: string;
  legalPreInformationEyebrow: string;
  legalPreInformationTitle: string;
  legalPreInformationSummary: string;
  legalPreInformationUpdated: string;
  legalPreInformationSections: string;
  legalDeliveryReturnsEyebrow: string;
  legalDeliveryReturnsTitle: string;
  legalDeliveryReturnsSummary: string;
  legalDeliveryReturnsUpdated: string;
  legalDeliveryReturnsSections: string;
  legalTermsEyebrow: string;
  legalTermsTitle: string;
  legalTermsSummary: string;
  legalTermsUpdated: string;
  legalTermsSections: string;
  legalSecureShoppingEyebrow: string;
  legalSecureShoppingTitle: string;
  legalSecureShoppingSummary: string;
  legalSecureShoppingUpdated: string;
  legalSecureShoppingSections: string;
};

export type SiteContentKey = keyof SiteContent;
export type ContentGroupId = "home" | "support" | "navigation" | "seo" | "legal";

export type LegalDocumentKey =
  | "kvkk"
  | "privacy"
  | "cookies"
  | "distanceSales"
  | "preInformation"
  | "deliveryReturns"
  | "terms"
  | "secureShopping";

export type LegalSectionType = "paragraph" | "bullets";

export type LegalSection = {
  title: string;
  type: LegalSectionType;
  text: string;
};

export type LegalDocumentContent = {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  sections: LegalSection[];
};

export type LegalDocumentMeta = {
  key: LegalDocumentKey;
  label: string;
  previewUrl: string;
  fieldPrefix: string;
};

export const legalDocuments: LegalDocumentMeta[] = [
  { key: "kvkk", label: "KVKK Aydınlatma Metni", previewUrl: "/kvkk", fieldPrefix: "legalKvkk" },
  { key: "privacy", label: "Gizlilik Politikası", previewUrl: "/gizlilik-politikasi", fieldPrefix: "legalPrivacy" },
  { key: "cookies", label: "Çerez Politikası", previewUrl: "/cerez-politikasi", fieldPrefix: "legalCookies" },
  { key: "distanceSales", label: "Mesafeli Satış Sözleşmesi", previewUrl: "/mesafeli-satis-sozlesmesi", fieldPrefix: "legalDistanceSales" },
  { key: "preInformation", label: "Ön Bilgilendirme Formu", previewUrl: "/on-bilgilendirme-formu", fieldPrefix: "legalPreInformation" },
  { key: "deliveryReturns", label: "Teslimat, İptal ve İade Koşulları", previewUrl: "/teslimat-ve-iade", fieldPrefix: "legalDeliveryReturns" },
  { key: "terms", label: "Kullanım Koşulları", previewUrl: "/kullanim-kosullari", fieldPrefix: "legalTerms" },
  { key: "secureShopping", label: "Güvenli Alışveriş", previewUrl: "/guvenli-alisveris", fieldPrefix: "legalSecureShopping" },
];

export function legalFieldKeys(prefix: string) {
  return {
    eyebrow: `${prefix}Eyebrow` as SiteContentKey,
    title: `${prefix}Title` as SiteContentKey,
    summary: `${prefix}Summary` as SiteContentKey,
    updated: `${prefix}Updated` as SiteContentKey,
    sections: `${prefix}Sections` as SiteContentKey,
  };
}

const emptyLegalDocument: LegalDocumentContent = {
  eyebrow: "",
  title: "",
  summary: "",
  updated: "",
  sections: [],
};

export function parseLegalSections(raw: string): LegalSection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LegalSection =>
          Boolean(item) && typeof item === "object",
      )
      .map((item) => ({
        title: String((item as LegalSection).title ?? ""),
        type: (item as LegalSection).type === "bullets" ? "bullets" : "paragraph",
        text: String((item as LegalSection).text ?? ""),
      }));
  } catch {
    return [];
  }
}

export function readLegalDocument(
  content: SiteContent,
  document: LegalDocumentKey,
): LegalDocumentContent {
  const meta = legalDocuments.find((item) => item.key === document);
  if (!meta) return emptyLegalDocument;
  const keys = legalFieldKeys(meta.fieldPrefix);
  return {
    eyebrow: content[keys.eyebrow],
    title: content[keys.title],
    summary: content[keys.summary],
    updated: content[keys.updated],
    sections: parseLegalSections(content[keys.sections]),
  };
}

export type ContentFieldDefinition = {
  key: SiteContentKey;
  label: string;
  help: string;
  multiline?: boolean;
  maximum: number;
};

export type ContentGroupDefinition = {
  id: ContentGroupId;
  label: string;
  description: string;
  previewUrl: string;
  fields: ContentFieldDefinition[];
};

export const defaultSiteContent: SiteContent = {
  homeHeroEyebrow: "Doğanın tek ve tekrarsız imzası",
  homeHeroTitle: "Yeryüzünün",
  homeHeroAccent: "zamansız parçaları.",
  homeHeroDescription:
    "Doku, renk ve doğal oluşum karakterine göre özenle seçilmiş taşlar. Yaşam alanınız için benzersiz, kalıcı ve anlamlı parçalar.",
  homeHeroPrimaryLabel: "Ürünleri keşfet",
  homeHeroSecondaryLabel: "Doğru taşı seçme rehberi",
  homeHeroNote: "Her parça doğal olarak benzersizdir.",
  homeIntroEyebrow: "Seçim yaklaşımımız",
  homeIntroTitle: "Taşa yalnızca bakmayız; karakterini seçeriz.",
  homeIntroBody:
    "Her doğal taş; kesimi, dokusu, rengi ve ışıkla kurduğu ilişki üzerinden değerlendirilir. Mağazamıza yalnızca kendine ait güçlü bir hikâyesi olan parçalar girer.",
  homeShopEyebrow: "Mağaza",
  homeShopTitle: "Tüm ürünler",
  homeShopDescription:
    "Taş türüne göre filtreleyin, size uygun doğal parçayı kolayca bulun.",
  homeGuideEyebrow: "Taş rehberi",
  homeGuideTitle: "Seçerken neye bakmalı?",
  homeGuideDescription:
    "Doğal taş seçimi yalnızca renkle ilgili değildir. Form, yüzey ve kullanım alanı birlikte düşünülmelidir.",
  homeTileRawStonesImage: "/stone-amethyst.jpg",
  homeTileRawStonesTitle: "Ham Taşlar",
  homeTileRawStonesTagline: "İşlenmemiş, doğal halinde",
  homeTileRawStonesLink: "/kategori/kadin-kolye",
  homeTileMeditationImage: "/story-hands.jpg",
  homeTileMeditationTitle: "Meditasyon Serisi",
  homeTileMeditationTagline: "Huzur ve odaklanma için seçilmiş parçalar",
  homeTileMeditationLink: "/#shop",
  homeTileCollectionSetsImage: "/stone-collection.jpg",
  homeTileCollectionSetsTitle: "Koleksiyon Setleri",
  homeTileCollectionSetsTagline: "Bir arada, özenle hazırlanmış taş setleri",
  homeTileCollectionSetsLink: "/#shop",
  supportEyebrow: "Yardım merkezi",
  supportTitle: "Nasıl yardımcı olabiliriz?",
  supportDescription:
    "Siparişinizden taş bakımına kadar ihtiyaç duyduğunuz bilgileri tek yerde bulabilirsiniz.",
  supportShippingTitle: "Teslimat ve kargo",
  supportShippingBody:
    "Siparişiniz hazırlandıktan sonra kargo bilgileri hesabınızdaki sipariş ekranında güncellenir. Paketleme ve teslimat sorularınız için ekibimize ulaşabilirsiniz.",
  supportReturnsTitle: "İade ve değişim",
  supportReturnsBody:
    "Ürünü teslim aldığınız haliyle koruyun ve iade talebiniz için sipariş numaranızla bizimle iletişime geçin. Size izlenecek adımları açıkça iletelim.",
  supportCareTitle: "Taş bakımı",
  supportCareBody:
    "Doğal taşınızı yoğun nemden, kimyasal temizleyicilerden ve uzun süreli doğrudan güneşten koruyun. Yumuşak ve kuru bir bez tercih edin.",
  navigationProducts: "Ürünler",
  navigationGuide: "Taş Rehberi",
  navigationSupport: "Destek",
  footerDescription:
    "Doğanın zamansız parçaları.\nÖzenle seçilmiş doğal taş ürünleri.",
  seoHomeTitle: "Terragolds | Doğal Taşlar ve Kristaller",
  seoHomeDescription:
    "Özenle seçilmiş doğal taşlar, kristaller ve koleksiyon parçaları.",
  seoSupportTitle: "Yardım ve İletişim | Terragolds",
  seoSupportDescription:
    "Terragolds sipariş, teslimat, iade ve doğal taş bakımı hakkında destek alın.",
  legalKvkkEyebrow: "Kişisel verilerin korunması",
  legalKvkkTitle: "KVKK Aydınlatma Metni",
  legalKvkkSummary: "Kişisel verilerinizin hangi kapsamda ve amaçlarla işlendiğine ilişkin bilgilendirme.",
  legalKvkkUpdated: "15 Ağustos 2026",
  legalKvkkSections: "[{\"title\":\"Veri sorumlusu\",\"type\":\"paragraph\",\"text\":\"6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında veri sorumlusu, aşağıda iletişim bilgileri bulunan Terragolds işletmesidir.\"},{\"title\":\"İşlenen kişisel veriler\",\"type\":\"bullets\",\"text\":\"Kimlik ve iletişim bilgileri\\nTeslimat ve fatura bilgileri\\nSipariş, iade ve müşteri işlem bilgileri\\nÜyelik, talep ve şikâyet kayıtları\\nİşlem güvenliği, oturum ve teknik kayıtlar\\nPazarlama izni verilmişse ileti tercihleri\"},{\"title\":\"İşleme amaçları\",\"type\":\"bullets\",\"text\":\"Üyelik ve sipariş süreçlerinin yürütülmesi\\nÖdeme, fatura, teslimat ve iade işlemlerinin tamamlanması\\nMüşteri desteği sunulması ve taleplerin sonuçlandırılması\\nBilgi güvenliği ve kötüye kullanımın önlenmesi\\nHukuki yükümlülüklerin yerine getirilmesi\\nAçık rıza verilmişse kampanya iletişimi yapılması\"},{\"title\":\"Hukuki sebepler ve toplama yöntemi\",\"type\":\"paragraph\",\"text\":\"Veriler; sözleşmenin kurulması veya ifası, hukuki yükümlülüklerin yerine getirilmesi, bir hakkın tesisi ve meşru menfaat hukuki sebeplerine dayanılarak internet sitesi, üyelik ve sipariş formları, destek kanalları ve işlem kayıtları üzerinden elektronik yöntemlerle toplanır. Açık rıza gereken faaliyetlerde ayrıca rıza alınır.\"},{\"title\":\"Aktarım\",\"type\":\"paragraph\",\"text\":\"Veriler yalnızca hizmetin gerektirdiği ölçüde ödeme kuruluşları, bankalar, kargo firmaları, muhasebe ve e-fatura hizmetleri, barındırma ve bilgi teknolojisi tedarikçileri ile yetkili kamu kurumlarına aktarılabilir. Kart bilgileri Terragolds tarafından açık şekilde saklanmaz; ödeme işlemi seçilen ödeme kuruluşunun güvenli altyapısında yürütülür.\"},{\"title\":\"Haklarınız ve başvuru\",\"type\":\"paragraph\",\"text\":\"KVKK’nın 11. maddesi kapsamındaki bilgi alma, düzeltme, silme veya yok etme, aktarılan üçüncü kişileri öğrenme ve itiraz haklarını kullanmak için aşağıdaki iletişim kanallarından yazılı başvuru yapabilirsiniz. Başvuruda kimliğinizi doğrulamaya yeterli bilgi ve talebiniz bulunmalıdır.\"}]",
  legalPrivacyEyebrow: "Güven ve şeffaflık",
  legalPrivacyTitle: "Gizlilik Politikası",
  legalPrivacySummary: "Terragolds mağazasını kullanırken bilgilerinizin korunmasına ilişkin temel ilkeler.",
  legalPrivacyUpdated: "15 Ağustos 2026",
  legalPrivacySections: "[{\"title\":\"Kapsam\",\"type\":\"paragraph\",\"text\":\"Bu politika; web sitesi ziyaretleri, üyelik, sipariş, ödeme yönlendirmesi, teslimat, iade ve müşteri desteği sırasında elde edilen bilgileri kapsar.\"},{\"title\":\"Veri minimizasyonu\",\"type\":\"paragraph\",\"text\":\"Yalnızca hizmetin sunulması, güvenliğin sağlanması ve yasal yükümlülüklerin yerine getirilmesi için gerekli bilgiler talep edilir. Gerekli olmayan hassas kişisel veriler talep edilmez.\"},{\"title\":\"Ödeme güvenliği\",\"type\":\"paragraph\",\"text\":\"Kart numarası, CVV ve benzeri ham kart verileri Terragolds veri tabanında tutulmaz. Ödeme işlemleri PayTR, iyzico veya etkinleştirilen diğer lisanslı ödeme hizmeti sağlayıcılarının güvenli sayfaları üzerinden tamamlanır.\"},{\"title\":\"Paylaşım ve saklama\",\"type\":\"paragraph\",\"text\":\"Bilgiler siparişin ifası için kargo, ödeme, muhasebe ve teknik hizmet sağlayıcılarla sınırlı olarak paylaşılabilir. Veriler ilgili mevzuatta öngörülen süreler ve hukuki uyuşmazlık süreleri boyunca, amaca uygun güvenlik tedbirleriyle saklanır.\"},{\"title\":\"Güvenlik\",\"type\":\"bullets\",\"text\":\"Yetki ve erişim kontrolleri\\nŞifreli bağlantı ve güvenli oturum mekanizmaları\\nKayıt, yedekleme ve olay takibi\\nTedarikçi erişimlerinin sınırlandırılması\"},{\"title\":\"İletişim\",\"type\":\"paragraph\",\"text\":\"Gizlilik ve kişisel verilerinizle ilgili sorularınızı aşağıdaki iletişim bilgileri üzerinden iletebilirsiniz.\"}]",
  legalCookiesEyebrow: "Dijital tercihlerinizi yönetin",
  legalCookiesTitle: "Çerez Politikası",
  legalCookiesSummary: "Sitede kullanılan çerez ve benzeri teknolojilere ilişkin açıklamalar.",
  legalCookiesUpdated: "15 Ağustos 2026",
  legalCookiesSections: "[{\"title\":\"Çerez nedir?\",\"type\":\"paragraph\",\"text\":\"Çerezler, bir internet sitesi ziyaret edildiğinde tarayıcıya kaydedilebilen küçük metin dosyalarıdır. Benzer şekilde tarayıcı yerel depolama alanı da sepet ve favori tercihlerinin hatırlanmasında kullanılabilir.\"},{\"title\":\"Zorunlu teknolojiler\",\"type\":\"bullets\",\"text\":\"Oturumun ve üyelik güvenliğinin korunması\\nSepet ve favori tercihlerinin hatırlanması\\nDil ve arayüz tercihlerinin uygulanması\\nDolandırıcılık ve kötüye kullanımın önlenmesi\"},{\"title\":\"Analitik ve pazarlama\",\"type\":\"paragraph\",\"text\":\"Zorunlu olmayan analitik veya pazarlama çerezleri etkinleştirilirse, bunlar ancak gerekli bilgilendirme yapıldıktan ve mevzuatın gerektirdiği durumlarda tercihiniz alındıktan sonra çalıştırılır.\"},{\"title\":\"Tercihleri yönetme\",\"type\":\"paragraph\",\"text\":\"Tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz. Zorunlu teknolojilerin engellenmesi oturum, sepet ve ödeme öncesi bazı işlevlerin çalışmasını etkileyebilir.\"}]",
  legalDistanceSalesEyebrow: "Satış koşulları",
  legalDistanceSalesTitle: "Mesafeli Satış Sözleşmesi",
  legalDistanceSalesSummary: "Terragolds üzerinden verilen siparişlerde satıcı ve alıcının hak ve yükümlülükleri.",
  legalDistanceSalesUpdated: "15 Ağustos 2026",
  legalDistanceSalesSections: "[{\"title\":\"1. Taraflar\",\"type\":\"paragraph\",\"text\":\"Satıcı Terragolds işletmesidir. Alıcı; sipariş sırasında adı, iletişim ve teslimat bilgilerini bildiren tüketicidir. Alıcıya ait sipariş özelindeki bilgiler ve ürünler, ödeme öncesi sipariş özetinde ve kalıcı veri saklayıcısı ile iletilen belgelerde gösterilir.\"},{\"title\":\"2. Sözleşmenin konusu\",\"type\":\"paragraph\",\"text\":\"Sözleşme, alıcının elektronik ortamda sipariş verdiği ürünlerin satışı ve teslimi ile tarafların 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamındaki hak ve yükümlülüklerini düzenler.\"},{\"title\":\"3. Ürün, fiyat ve ödeme\",\"type\":\"paragraph\",\"text\":\"Ürünün temel özellikleri, adedi, tüm vergiler dâhil satış fiyatı, indirimler, kargo bedeli ve toplam ödeme tutarı sipariş özeti üzerinde gösterilir. Ödeme, sipariş sırasında sunulan yöntemlerden biriyle gerçekleştirilir.\"},{\"title\":\"4. Teslimat\",\"type\":\"paragraph\",\"text\":\"Sipariş, stok ve kişiselleştirme durumu gözetilerek belirtilen süre içinde ve her hâlükârda mevzuattaki azami süre aşılmadan teslim edilir. Teslimata kadar oluşan kayıp veya hasardan, alıcının satıcının belirlediği taşıyıcı dışında başka bir taşıyıcı seçtiği durumlar hariç, satıcı sorumludur.\"},{\"title\":\"5. Cayma hakkı\",\"type\":\"paragraph\",\"text\":\"Alıcı, malı teslim aldığı tarihten itibaren 14 gün içinde gerekçe göstermeksizin cayma hakkını kullanabilir. Bildirim telefon yerine e-posta, site üzerindeki talep kanalı veya diğer kalıcı veri saklayıcılarıyla yapılmalıdır. Alıcı, cayma bildiriminden itibaren 10 gün içinde ürünü iade eder. Satıcı, mevzuattaki süre ve koşullara uygun şekilde geri ödeme yapar.\"},{\"title\":\"6. Cayma hakkının istisnaları\",\"type\":\"paragraph\",\"text\":\"Alıcının istekleri veya kişisel ihtiyaçları doğrultusunda özel olarak hazırlanan ürünler ile mevzuatta cayma hakkı istisnası sayılan diğer ürünlerde cayma hakkı kullanılamayabilir. İstisna varsa ödeme öncesinde açıkça belirtilir.\"},{\"title\":\"7. Uyuşmazlıklar\",\"type\":\"paragraph\",\"text\":\"Uyuşmazlıklarda tüketicinin yerleşim yerindeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri, yürürlükteki parasal sınırlar çerçevesinde yetkilidir.\"}]",
  legalPreInformationEyebrow: "Sipariş öncesi bilgilendirme",
  legalPreInformationTitle: "Ön Bilgilendirme Formu",
  legalPreInformationSummary: "Ödeme onayından önce tüketiciye sunulması gereken temel satış bilgileri.",
  legalPreInformationUpdated: "15 Ağustos 2026",
  legalPreInformationSections: "[{\"title\":\"Satıcı ve iletişim\",\"type\":\"paragraph\",\"text\":\"Satıcının unvanı ve iletişim bilgileri aşağıdaki satıcı bilgi kartında yer alır. Siparişe ilişkin talepler destek ve e-posta kanallarından iletilebilir.\"},{\"title\":\"Ürünün temel nitelikleri\",\"type\":\"paragraph\",\"text\":\"Ürün adı, doğal taş türü, açıklaması, görseli, adedi ve varsa ürünün doğal yapısından kaynaklanan renk, damar ve form farklılıkları ürün detay sayfasında gösterilir.\"},{\"title\":\"Toplam bedel\",\"type\":\"paragraph\",\"text\":\"Tüm vergiler dâhil ürün bedeli, indirim, kargo ve diğer ek masraflar ödeme adımından hemen önce sipariş özetinde ayrı ayrı gösterilir. Alıcı, ödeme yükümlülüğü doğuran siparişi onaylamadan önce bu bilgileri kontrol eder.\"},{\"title\":\"Ödeme ve teslimat\",\"type\":\"paragraph\",\"text\":\"Kullanılabilir ödeme yöntemleri ödeme adımında gösterilir. Tahmini hazırlık ve teslimat süreleri ürün, stok ve teslimat adresine göre değişebilir. Stok sorunu veya ifa imkânsızlığı oluşursa alıcı bilgilendirilir ve tahsil edilen tutar mevzuata uygun şekilde iade edilir.\"},{\"title\":\"Cayma ve iade\",\"type\":\"paragraph\",\"text\":\"Teslimden itibaren 14 günlük cayma hakkı, kullanım şekli, iade taşıyıcısı ve varsa istisnalar Mesafeli Satış Sözleşmesi ile Teslimat ve İade sayfasında açıklanır. Cayma bildirimi kalıcı veri saklayıcısı üzerinden yapılmalıdır.\"},{\"title\":\"Başvuru yolları\",\"type\":\"paragraph\",\"text\":\"Tüketici, şikâyet ve itirazlarını satıcıya iletebilir; ayrıca yürürlükteki parasal sınırlara göre Tüketici Hakem Heyeti veya Tüketici Mahkemesine başvurabilir.\"}]",
  legalDeliveryReturnsEyebrow: "Müşteri hizmetleri",
  legalDeliveryReturnsTitle: "Teslimat, İptal ve İade Koşulları",
  legalDeliveryReturnsSummary: "Sipariş hazırlığı, kargo, cayma bildirimi ve geri ödeme süreci.",
  legalDeliveryReturnsUpdated: "15 Ağustos 2026",
  legalDeliveryReturnsSections: "[{\"title\":\"Sipariş hazırlığı\",\"type\":\"paragraph\",\"text\":\"Stoklu ürünler ödeme onayından sonra hazırlanır. Yoğunluk, resmî tatil, kişiselleştirme veya adres kaynaklı gecikmeler ayrıca bildirilir. Kargoya verilen siparişin takip bilgisi hesap ve iletişim kanallarından paylaşılır.\"},{\"title\":\"Teslimat kontrolü\",\"type\":\"paragraph\",\"text\":\"Paket teslim alınırken dış ambalaj kontrol edilmelidir. Belirgin hasar varsa taşıyıcıya tutanak düzenletilmesi ve durumun mümkün olan en kısa sürede Terragolds’a bildirilmesi incelemeyi hızlandırır. Tüketicinin kanuni hakları saklıdır.\"},{\"title\":\"Cayma bildirimi\",\"type\":\"paragraph\",\"text\":\"Cayma talebi, teslimden itibaren 14 gün içinde e-posta veya site üzerindeki destek kanalıyla yazılı olarak iletilmelidir. Bildirimde sipariş numarası, ürün ve iletişim bilgisi bulunmalıdır.\"},{\"title\":\"İade gönderimi\",\"type\":\"paragraph\",\"text\":\"Cayma bildiriminden sonra ürün, anlaşmalı kargo firmamız Yurtiçi Kargo ve iade yönlendirmesi kullanılarak 10 gün içinde gönderilmelidir. Ürün, mutat inceleme dışında değer kaybına uğratılmamalı; mümkünse faturası, aksesuarları ve koruyucu ambalajıyla iade edilmelidir.\"},{\"title\":\"Geri ödeme\",\"type\":\"paragraph\",\"text\":\"İade koşulları sağlandığında geri ödeme, satın almada kullanılan ödeme aracına uygun ve tüketiciye masraf yüklemeyecek şekilde mevzuattaki süre içinde yapılır. Banka veya ödeme kuruluşunun hesaba yansıtma süresi ayrıca değişebilir.\"},{\"title\":\"Ayıplı veya yanlış ürün\",\"type\":\"paragraph\",\"text\":\"Hasarlı, ayıplı veya siparişten farklı ürünlerde destek ekibiyle iletişime geçilmelidir. 6502 sayılı Kanun kapsamındaki seçimlik haklar saklıdır.\"}]",
  legalTermsEyebrow: "Site kullanımı",
  legalTermsTitle: "Kullanım Koşulları",
  legalTermsSummary: "Terragolds internet sitesinin kullanımı, hesap güvenliği ve içerik koşulları.",
  legalTermsUpdated: "15 Ağustos 2026",
  legalTermsSections: "[{\"title\":\"Site ve hizmet\",\"type\":\"paragraph\",\"text\":\"Site; ürünleri inceleme, üyelik oluşturma, sipariş verme ve destek alma hizmetleri sunar. İçerik ve özellikler, tüketicinin kazanılmış haklarını etkilememek kaydıyla güncellenebilir.\"},{\"title\":\"Hesap güvenliği\",\"type\":\"paragraph\",\"text\":\"Kullanıcı, hesap bilgilerinin doğruluğundan ve şifresinin gizliliğinden sorumludur. Yetkisiz kullanım şüphesi gecikmeden destek ekibine bildirilmelidir.\"},{\"title\":\"Ürün görselleri\",\"type\":\"paragraph\",\"text\":\"Doğal taşlar renk, damar, kristal yoğunluğu ve form bakımından benzersizdir. Ekran ayarları da renk algısını etkileyebilir. Tekil ürünlerde gönderilecek parçanın niteliği ürün açıklamasında belirtilir.\"},{\"title\":\"Fikri mülkiyet\",\"type\":\"paragraph\",\"text\":\"Terragolds markası, tasarım, metin ve görselleri izin olmadan ticari amaçla kopyalanamaz veya yayımlanamaz.\"},{\"title\":\"Uygulanacak hükümler\",\"type\":\"paragraph\",\"text\":\"Bu koşullar Türkiye Cumhuriyeti mevzuatına tabidir. Tüketicinin emredici mevzuattan doğan hakları saklıdır.\"}]",
  legalSecureShoppingEyebrow: "Güven ve şeffaflık",
  legalSecureShoppingTitle: "Güvenli Alışveriş ve Tüketici Hakları",
  legalSecureShoppingSummary: "Ödeme güvenliği, 14 günlük iade hakkınız ve kişisel verilerinizin korunmasına dair bilgiler.",
  legalSecureShoppingUpdated: "22 Ağustos 2026",
  legalSecureShoppingSections: "[{\"title\":\"Ödeme altyapımız\",\"type\":\"paragraph\",\"text\":\"Terragolds üzerindeki tüm ödemeler iyzico, PayTR ve Shopier'in lisanslı ve güvenli ödeme altyapıları üzerinden gerçekleştirilir. Kart numarası, son kullanma tarihi ve CVV gibi ham kart bilgileri Terragolds sunucularında hiçbir şekilde saklanmaz; ödeme işlemi doğrudan seçilen ödeme kuruluşunun güvenli sayfası üzerinden tamamlanır.\"},{\"title\":\"Bağlantı güvenliği\",\"type\":\"paragraph\",\"text\":\"Sitemizdeki tüm sayfalar ve ödeme adımları şifreli (SSL) bağlantı üzerinden sunulur. Tarayıcınızın adres çubuğunda kilit simgesini görerek bağlantının güvenli olduğunu doğrulayabilirsiniz.\"},{\"title\":\"14 gün cayma hakkı\",\"type\":\"paragraph\",\"text\":\"Siparişinizi teslim aldığınız tarihten itibaren 14 gün içinde, herhangi bir gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz. Cayma süreci, iade koşulları ve geri ödeme detayları Mesafeli Satış Sözleşmesi ile Teslimat ve İade sayfamızda ayrıntılı olarak açıklanmıştır.\"},{\"title\":\"Kişisel verilerinizin korunması\",\"type\":\"paragraph\",\"text\":\"Kimlik, iletişim, sipariş ve ödeme sürecine ilişkin bilgileriniz 6698 sayılı KVKK kapsamında işlenir ve yalnızca hizmetin gerektirdiği ölçüde ilgili tedarikçilerle (ödeme kuruluşu, kargo firması vb.) paylaşılır. Ayrıntılar KVKK Aydınlatma Metni ve Gizlilik Politikası sayfalarımızda yer alır.\"},{\"title\":\"Güvenli alışveriş için öneriler\",\"type\":\"bullets\",\"text\":\"Ödeme sayfasında adres çubuğunda kilit simgesini (SSL) kontrol edin.\\nHesap şifrenizi kimseyle paylaşmayın ve düzenli aralıklarla değiştirin.\\nSipariş ve ödeme bildirimlerinin gerçekten Terragolds'tan geldiğinden emin olun.\\nŞüpheli bir durumda hemen destek ekibimizle iletişime geçin.\"},{\"title\":\"Tüketici hakları ve başvuru yolları\",\"type\":\"paragraph\",\"text\":\"Alışverişinizle ilgili herhangi bir uyuşmazlıkta, yürürlükteki parasal sınırlar çerçevesinde yerleşim yerinizdeki veya işlemin yapıldığı yerdeki Tüketici Hakem Heyeti ya da Tüketici Mahkemesine başvurabilirsiniz. Bunun yanı sıra taleplerinizi doğrudan destek ekibimize iletebilirsiniz.\"}]",
};

export const contentGroups: ContentGroupDefinition[] = [
  {
    id: "home",
    label: "Anasayfa",
    description: "Vitrin, mağaza, rehber ve hikâye alanları.",
    previewUrl: "/",
    fields: [
      { key: "homeHeroEyebrow", label: "Vitrin üst başlığı", help: "Ana başlığın üstündeki kısa ifade.", maximum: 100 },
      { key: "homeHeroTitle", label: "Vitrin ana başlığı", help: "Başlığın ilk satırı.", maximum: 80 },
      { key: "homeHeroAccent", label: "Vurgulu başlık", help: "İtalik görünen ikinci satır.", maximum: 100 },
      { key: "homeHeroDescription", label: "Vitrin açıklaması", help: "Başlığın altındaki tanıtım metni.", multiline: true, maximum: 320 },
      { key: "homeHeroPrimaryLabel", label: "Ana düğme", help: "Ürünlere yönlendiren düğme.", maximum: 40 },
      { key: "homeHeroSecondaryLabel", label: "İkinci bağlantı", help: "Taş rehberine yönlendiren bağlantı.", maximum: 60 },
      { key: "homeHeroNote", label: "Vitrin alt notu", help: "Görselin altındaki kısa bilgi.", maximum: 100 },
      { key: "homeIntroEyebrow", label: "Yaklaşım üst başlığı", help: "Seçim yaklaşımı alanının etiketi.", maximum: 80 },
      { key: "homeIntroTitle", label: "Yaklaşım başlığı", help: "Seçim yaklaşımının ana başlığı.", maximum: 140 },
      { key: "homeIntroBody", label: "Yaklaşım açıklaması", help: "Seçim yaklaşımı metni.", multiline: true, maximum: 500 },
      { key: "homeShopEyebrow", label: "Mağaza üst başlığı", help: "Ürün listesinin etiketi.", maximum: 50 },
      { key: "homeShopTitle", label: "Mağaza başlığı", help: "Ürün listesinin başlığı.", maximum: 90 },
      { key: "homeShopDescription", label: "Mağaza açıklaması", help: "Filtrelerin üstündeki açıklama.", multiline: true, maximum: 240 },
    ],
  },
  {
    id: "support",
    label: "Yardım ve Destek",
    description: "Destek sayfasının başlık ve açıklamaları.",
    previewUrl: "/support",
    fields: [
      { key: "supportEyebrow", label: "Sayfa üst başlığı", help: "Destek sayfası etiketi.", maximum: 60 },
      { key: "supportTitle", label: "Sayfa başlığı", help: "Destek sayfasının ana başlığı.", maximum: 120 },
      { key: "supportDescription", label: "Sayfa açıklaması", help: "Ana başlığın altındaki açıklama.", multiline: true, maximum: 320 },
      { key: "supportShippingTitle", label: "Teslimat başlığı", help: "Kargo yardım kartının başlığı.", maximum: 100 },
      { key: "supportShippingBody", label: "Teslimat açıklaması", help: "Kargo yardım kartının metni.", multiline: true, maximum: 600 },
      { key: "supportReturnsTitle", label: "İade başlığı", help: "İade yardım kartının başlığı.", maximum: 100 },
      { key: "supportReturnsBody", label: "İade açıklaması", help: "İade yardım kartının metni.", multiline: true, maximum: 600 },
      { key: "supportCareTitle", label: "Bakım başlığı", help: "Taş bakımı kartının başlığı.", maximum: 100 },
      { key: "supportCareBody", label: "Bakım açıklaması", help: "Taş bakımı yardım kartının metni.", multiline: true, maximum: 600 },
    ],
  },
  {
    id: "navigation",
    label: "Menü ve Alt Bölüm",
    description: "Üst menü bağlantıları ve marka açıklaması.",
    previewUrl: "/",
    fields: [
      { key: "navigationProducts", label: "Ürünler bağlantısı", help: "Üst menüdeki ürünler metni.", maximum: 30 },
      { key: "navigationGuide", label: "Rehber bağlantısı", help: "Üst menüdeki rehber metni.", maximum: 30 },
      { key: "navigationSupport", label: "Destek bağlantısı", help: "Sağ üst destek metni.", maximum: 30 },
      { key: "footerDescription", label: "Alt bölüm açıklaması", help: "Logonun altındaki marka açıklaması.", multiline: true, maximum: 240 },
    ],
  },
  {
    id: "seo",
    label: "Google ve SEO",
    description: "Arama sonuçlarında kullanılan sayfa başlıkları.",
    previewUrl: "/",
    fields: [
      { key: "seoHomeTitle", label: "Anasayfa SEO başlığı", help: "Google sonuç başlığı; yaklaşık 60 karakter önerilir.", maximum: 80 },
      { key: "seoHomeDescription", label: "Anasayfa SEO açıklaması", help: "Google sonuç açıklaması; yaklaşık 160 karakter önerilir.", multiline: true, maximum: 180 },
      { key: "seoSupportTitle", label: "Destek SEO başlığı", help: "Destek sayfasının Google başlığı.", maximum: 80 },
      { key: "seoSupportDescription", label: "Destek SEO açıklaması", help: "Destek sayfasının Google açıklaması.", multiline: true, maximum: 180 },
    ],
  },
  {
    id: "legal",
    label: "Hukuki Belgeler",
    description: "KVKK, gizlilik, çerez, mesafeli satış ve diğer yasal metinler.",
    previewUrl: "/kvkk",
    fields: [],
  },
];

export const siteContentKeys = Object.keys(
  defaultSiteContent,
) as SiteContentKey[];
