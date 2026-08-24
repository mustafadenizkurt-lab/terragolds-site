export type Product = {
  id: number;
  name: string;
  stone: string;
  category: string;
  price: number;
  stock: number;
  image: string;
  hoverImage?: string;
  badge?: string;
  campaignLabel?: string;
  discountPercent: number;
  reviewAverage?: number;
  reviewCount?: number;
  description: string;
  status: "published" | "draft";
  shopierUrl?: string;
  shopierProductId?: string;
  shopierSyncStatus: "manual" | "connected" | "pending" | "error";
  featured: boolean;
  sortOrder: number;
  createdAt?: string;
};

export type StoreSettings = {
  businessName: string;
  announcement: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  district: string;
  city: string;
  mapUrl: string;
  facebook: string;
  instagram: string;
  pinterest: string;
  businessHours: string;
  footerNote: string;
  shippingFee: string;
  freeShippingThreshold: string;
};

type DemoProduct = Omit<
  Product,
  "id" | "status" | "shopierSyncStatus" | "sortOrder"
>;

const demoProducts: DemoProduct[] = [
  {
    name: "Ametist Kristal Küme",
    stone: "Ametist",
    category: "Ham Taşlar",
    price: 780,
    stock: 4,
    image: "/stone-amethyst.jpg",
    badge: "Çok sevilen",
    campaignLabel: "Haftanın Fırsatı",
    discountPercent: 20,
    description:
      "Derin mor tonları ve doğal kristal yüzeyiyle çalışma masası, kitaplık ya da dingin bir köşe için karakterli bir parça.",
    featured: true,
  },
  {
    name: "Sitrin Ham Parça",
    stone: "Sitrin",
    category: "Ham Taşlar",
    price: 640,
    stock: 6,
    image: "/hero-stone-citrine.jpg",
    badge: "Yeni",
    discountPercent: 0,
    description:
      "Sıcak sarı tonlarıyla öne çıkan, doğal yüzey formu korunmuş koleksiyonluk sitrin parçası.",
    featured: true,
  },
  {
    name: "Dumanlı Kuvars Kütle",
    stone: "Dumanlı Kuvars",
    category: "Ham Taşlar",
    price: 720,
    stock: 5,
    image: "/hero-stone-smoky-quartz.jpg",
    discountPercent: 0,
    description:
      "Koyu mineral geçişleri ve dengeli formuyla raf, konsol ve çalışma alanlarında güçlü bir doğal vurgu oluşturur.",
    featured: false,
  },
  {
    name: "Pembe Kuvars Ham Taş",
    stone: "Pembe Kuvars",
    category: "Ham Taşlar",
    price: 430,
    stock: 8,
    image: "/stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Yumuşak pembe geçişlere sahip, elde seçilmiş doğal kuvars parçası. Her ürün form ve ton bakımından benzersizdir.",
    featured: false,
  },
  {
    name: "Berrak Kuvars Doğal Uç",
    stone: "Kristal Kuvars",
    category: "Ham Taşlar",
    price: 560,
    stock: 7,
    image: "/stone-clear-quartz.jpg",
    badge: "Sınırlı",
    discountPercent: 0,
    description:
      "Işığı zarifçe kıran doğal kuvars ucu, sade ve modern sunumlar için güçlü bir kristal dokusu verir.",
    featured: false,
  },
  {
    name: "Karışık Mineral Numune",
    stone: "Karışık Mineral",
    category: "Ham Taşlar",
    price: 980,
    stock: 3,
    image: "/hero-crystals.jpg",
    badge: "Koleksiyonluk",
    discountPercent: 10,
    description:
      "Farklı renk, yüzey ve kristal karakterlerini bir arada görmek isteyenler için hazırlanmış doğal mineral seçkisi.",
    featured: false,
  },
  {
    name: "Mini Ametist Druz",
    stone: "Ametist",
    category: "Kristaller",
    price: 360,
    stock: 9,
    image: "/stone-amethyst.jpg",
    discountPercent: 0,
    description:
      "Kompakt boyutuna rağmen güçlü bir görsel doku sunan, doğal yüzeyi korunmuş mini ametist druz.",
    featured: true,
  },
  {
    name: "Şeffaf Kuvars Kule",
    stone: "Kristal Kuvars",
    category: "Kristaller",
    price: 890,
    stock: 5,
    image: "/hero-stone-clear-quartz.jpg",
    badge: "Premium",
    discountPercent: 0,
    description:
      "Berrak yüzeyi ve dikey formuyla vitrin, masa ve meditasyon alanlarında sade bir odak noktası oluşturur.",
    featured: true,
  },
  {
    name: "Gül Kuvars Kristal Parça",
    stone: "Gül Kuvars",
    category: "Kristaller",
    price: 520,
    stock: 8,
    image: "/hero-stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Yumuşak pembe tonlarıyla dekoratif ve hediyelik kullanıma uygun, seçilmiş kuvars kristal parçası.",
    featured: false,
  },
  {
    name: "Sitrin Kristal Küme",
    stone: "Sitrin",
    category: "Kristaller",
    price: 940,
    stock: 4,
    image: "/hero-stone-citrine.jpg",
    campaignLabel: "Altın Seri",
    discountPercent: 12,
    description:
      "Altın tonlarına yakın sıcaklığıyla dikkat çeken sitrin küme, koleksiyon raflarında ışıklı bir etki verir.",
    featured: false,
  },
  {
    name: "Dumanlı Kuvars Uç",
    stone: "Dumanlı Kuvars",
    category: "Kristaller",
    price: 690,
    stock: 6,
    image: "/hero-stone-smoky-quartz.jpg",
    discountPercent: 0,
    description:
      "Koyu kahve ve gri geçişleriyle modern, sakin ve rafine bir kristal görünümü sunar.",
    featured: false,
  },
  {
    name: "Kristal Kuvars Küçük Küme",
    stone: "Kristal Kuvars",
    category: "Kristaller",
    price: 610,
    stock: 7,
    image: "/stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Parlak yüzey kırılımlarıyla küçük alanlara zarif bir doğal taş detayı ekleyen seçilmiş kuvars küme.",
    featured: false,
  },
  {
    name: "Ametist Kolye Ucu",
    stone: "Ametist",
    category: "Takı ve Aksesuar",
    price: 480,
    stock: 10,
    image: "/stone-amethyst.jpg",
    badge: "Hediye",
    discountPercent: 0,
    description:
      "Mor kristal dokusunu günlük kullanıma taşıyan, sade zincirlerle uyumlu doğal taş kolye ucu.",
    featured: true,
  },
  {
    name: "Pembe Kuvars Bileklik",
    stone: "Pembe Kuvars",
    category: "Takı ve Aksesuar",
    price: 390,
    stock: 12,
    image: "/stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Yumuşak ton geçişleriyle sade ve zarif bir kullanım sunan, doğal taş boncuklardan hazırlanmış bileklik.",
    featured: false,
  },
  {
    name: "Sitrin Minimal Kolye",
    stone: "Sitrin",
    category: "Takı ve Aksesuar",
    price: 560,
    stock: 8,
    image: "/hero-stone-citrine.jpg",
    campaignLabel: "Yeni Sezon",
    discountPercent: 8,
    description:
      "Sıcak altın tonlu sitrin taşıyla hazırlanan minimal kolye, günlük ve özel kombinlere kolayca eşlik eder.",
    featured: false,
  },
  {
    name: "Kuvars Anahtarlık",
    stone: "Kristal Kuvars",
    category: "Takı ve Aksesuar",
    price: 240,
    stock: 15,
    image: "/stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Taşınabilir doğal taş detayı isteyenler için hazırlanmış, sade metal aksesuarlı kuvars anahtarlık.",
    featured: false,
  },
  {
    name: "Dumanlı Kuvars Yüzük Taşı",
    stone: "Dumanlı Kuvars",
    category: "Takı ve Aksesuar",
    price: 620,
    stock: 5,
    image: "/hero-stone-smoky-quartz.jpg",
    discountPercent: 0,
    description:
      "Koyu ve rafine tonu sayesinde yüzük tasarımlarına sofistike bir mineral karakter kazandırır.",
    featured: false,
  },
  {
    name: "Gül Kuvars Cep Taşı",
    stone: "Gül Kuvars",
    category: "Takı ve Aksesuar",
    price: 280,
    stock: 16,
    image: "/hero-stone-rose-quartz.jpg",
    badge: "Mini",
    discountPercent: 0,
    description:
      "Cep, çanta veya masa üstünde taşınabilecek pürüzsüz yüzeyli küçük gül kuvars parçası.",
    featured: false,
  },
  {
    name: "Ametist Dekor Objesi",
    stone: "Ametist",
    category: "Dekoratif Parçalar",
    price: 1280,
    stock: 3,
    image: "/hero-stone-amethyst.jpg",
    badge: "Vitrin",
    discountPercent: 0,
    description:
      "Büyük yüzey etkisi ve derin mor rengiyle konsol, kitaplık ve salon köşelerinde dikkat çeken dekoratif parça.",
    featured: true,
  },
  {
    name: "Kuvars Masa Objesi",
    stone: "Kristal Kuvars",
    category: "Dekoratif Parçalar",
    price: 1120,
    stock: 4,
    image: "/hero-stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Şeffaf kristal formu ve parlak kırılımlarıyla masa üstünde hafif, ferah ve premium bir görünüm verir.",
    featured: false,
  },
  {
    name: "Sitrin Raf Parçası",
    stone: "Sitrin",
    category: "Dekoratif Parçalar",
    price: 1040,
    stock: 3,
    image: "/hero-stone-citrine.jpg",
    campaignLabel: "İndirimli",
    discountPercent: 15,
    description:
      "Altın sarısı tonlarıyla sıcak bir atmosfer oluşturan, dekoratif raf ve vitrin kullanımı için seçilmiş parça.",
    featured: false,
  },
  {
    name: "Pembe Kuvars Tabak",
    stone: "Pembe Kuvars",
    category: "Dekoratif Parçalar",
    price: 860,
    stock: 5,
    image: "/stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Takı, mum veya küçük objelerle kullanılabilecek, yumuşak pembe tonlu dekoratif kuvars tabak.",
    featured: false,
  },
  {
    name: "Dumanlı Kuvars Stand",
    stone: "Dumanlı Kuvars",
    category: "Dekoratif Parçalar",
    price: 970,
    stock: 4,
    image: "/hero-stone-smoky-quartz.jpg",
    discountPercent: 0,
    description:
      "Modern koyu tonlarıyla sade iç mekanlarda güçlü ama kontrollü bir doğal taş aksanı oluşturur.",
    featured: false,
  },
  {
    name: "Mineral Vitrin Taşı",
    stone: "Karışık Mineral",
    category: "Dekoratif Parçalar",
    price: 1390,
    stock: 2,
    image: "/terragolds-gold-showcase.png",
    badge: "Özel",
    discountPercent: 0,
    description:
      "Renk ve doku çeşitliliğiyle vitrinde güçlü bir hikaye oluşturan, dekoratif amaçlı seçilmiş mineral kompozisyonu.",
    featured: false,
  },
  {
    name: "Terra Başlangıç Seti",
    stone: "Karışık Doğal Taş",
    category: "Koleksiyon Setleri",
    price: 1250,
    stock: 6,
    image: "/stone-collection.jpg",
    badge: "Editör seçimi",
    discountPercent: 0,
    description:
      "Farklı mineral dokularını bir arada keşfetmek isteyenler için dengeli renk ve form uyumuyla hazırlanmış seçki.",
    featured: true,
  },
  {
    name: "Kristal Enerji Seti",
    stone: "Ametist, Kuvars, Sitrin",
    category: "Koleksiyon Setleri",
    price: 1480,
    stock: 5,
    image: "/hero-crystals.jpg",
    campaignLabel: "Set Avantajı",
    discountPercent: 10,
    description:
      "Ametist, kuvars ve sitrin tonlarını bir araya getiren dengeli, hediyelik ve koleksiyonluk set.",
    featured: true,
  },
  {
    name: "Pembe Tonlar Seti",
    stone: "Pembe Kuvars",
    category: "Koleksiyon Setleri",
    price: 760,
    stock: 8,
    image: "/hero-stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Birbiriyle uyumlu pembe kuvars parçalarından oluşan, sade ve zarif bir masa üstü koleksiyonu.",
    featured: false,
  },
  {
    name: "Kuvars Netlik Seti",
    stone: "Kristal Kuvars",
    category: "Koleksiyon Setleri",
    price: 1180,
    stock: 5,
    image: "/hero-stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Farklı form ve boyutlarda berrak kuvars parçalarıyla hazırlanmış, ferah görünümlü seçki.",
    featured: false,
  },
  {
    name: "Toprak Tonları Seti",
    stone: "Dumanlı Kuvars",
    category: "Koleksiyon Setleri",
    price: 990,
    stock: 6,
    image: "/hero-stone-smoky-quartz.jpg",
    discountPercent: 0,
    description:
      "Dumanlı kuvarsın koyu, sakin ve toprak tonlarını sevenler için hazırlanan uyumlu doğal taş seti.",
    featured: false,
  },
  {
    name: "Altın Işık Seti",
    stone: "Sitrin",
    category: "Koleksiyon Setleri",
    price: 1320,
    stock: 4,
    image: "/hero-stone-citrine.jpg",
    badge: "Yeni",
    discountPercent: 0,
    description:
      "Sitrin ağırlıklı sıcak tonlardan oluşan, hediye ve dekoratif kullanım için güçlü görünümlü koleksiyon.",
    featured: false,
  },
  {
    name: "Kuvars Odak Taşı",
    stone: "Kristal Kuvars",
    category: "Meditasyon",
    price: 690,
    stock: 7,
    image: "/stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Avuç içine oturan dengeli formu ve ışık alan yüzeyiyle günlük ritüellere eşlik eden seçilmiş kuvars.",
    featured: true,
  },
  {
    name: "Ametist Sakinlik Taşı",
    stone: "Ametist",
    category: "Meditasyon",
    price: 540,
    stock: 9,
    image: "/hero-stone-amethyst.jpg",
    discountPercent: 0,
    description:
      "Derin mor tonlarıyla sakin ve odaklı bir atmosfer kurmak isteyenler için seçilmiş küçük ametist parçası.",
    featured: false,
  },
  {
    name: "Dumanlı Kuvars Topraklama",
    stone: "Dumanlı Kuvars",
    category: "Meditasyon",
    price: 620,
    stock: 6,
    image: "/hero-stone-smoky-quartz.jpg",
    campaignLabel: "Ritüel",
    discountPercent: 8,
    description:
      "Koyu mineral tonu ve elde rahat tutulan formuyla nefes, odak ve ritüel çalışmalarına uyum sağlar.",
    featured: false,
  },
  {
    name: "Gül Kuvars Niyet Taşı",
    stone: "Gül Kuvars",
    category: "Meditasyon",
    price: 460,
    stock: 10,
    image: "/hero-stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Yumuşak pembe tonlu, pürüzsüz yüzeyiyle günlük niyet ve masa başı sakinlik ritüellerine eşlik eder.",
    featured: false,
  },
  {
    name: "Sitrin Enerji Taşı",
    stone: "Sitrin",
    category: "Meditasyon",
    price: 580,
    stock: 8,
    image: "/hero-stone-citrine.jpg",
    discountPercent: 0,
    description:
      "Sıcak rengi ve küçük formuyla çalışma alanında canlı, aydınlık ve pozitif bir odak noktası oluşturur.",
    featured: false,
  },
  {
    name: "Mini Meditasyon Seçkisi",
    stone: "Karışık Doğal Taş",
    category: "Meditasyon",
    price: 840,
    stock: 5,
    image: "/stone-collection.jpg",
    badge: "Set",
    discountPercent: 0,
    description:
      "Günlük kullanım için farklı taşlardan oluşan küçük ve dengeli bir meditasyon başlangıç seçkisi.",
    featured: false,
  },
  {
    name: "Terragolds İmza Kutusu",
    stone: "Karışık Doğal Taş",
    category: "Özel Seçkiler",
    price: 1890,
    stock: 3,
    image: "/terragolds-gold-showcase.png",
    badge: "İmza",
    campaignLabel: "Özel Seri",
    discountPercent: 0,
    description:
      "Renk, parlaklık ve form dengesi gözetilerek hazırlanmış, Terragolds sunum kutusuyla gelen özel seçki.",
    featured: true,
  },
  {
    name: "Premium Ametist Seçkisi",
    stone: "Ametist",
    category: "Özel Seçkiler",
    price: 1640,
    stock: 3,
    image: "/hero-stone-amethyst.jpg",
    discountPercent: 0,
    description:
      "Daha yoğun mor ton ve belirgin kristal yüzey arayanlar için ayrılmış premium ametist parçaları.",
    featured: false,
  },
  {
    name: "Altın Tonlu Sitrin Seçkisi",
    stone: "Sitrin",
    category: "Özel Seçkiler",
    price: 1720,
    stock: 2,
    image: "/hero-stone-citrine.jpg",
    campaignLabel: "Nadir",
    discountPercent: 5,
    description:
      "Daha sıcak ve parlak sarı geçişlere sahip sitrin parçalarından oluşan özel vitrin seçkisi.",
    featured: false,
  },
  {
    name: "Berrak Kuvars Premium",
    stone: "Kristal Kuvars",
    category: "Özel Seçkiler",
    price: 1580,
    stock: 4,
    image: "/hero-stone-clear-quartz.jpg",
    discountPercent: 0,
    description:
      "Şeffaflık ve yüzey parlaklığı daha belirgin olan kuvars parçaları arasından hazırlanmış premium seçim.",
    featured: false,
  },
  {
    name: "Yumuşak Pembe Koleksiyon",
    stone: "Gül Kuvars",
    category: "Özel Seçkiler",
    price: 1360,
    stock: 4,
    image: "/hero-stone-rose-quartz.jpg",
    discountPercent: 0,
    description:
      "Pembe kuvarsın sakin ve zarif tonlarını bir araya getiren, hediye sunumuna uygun özel koleksiyon.",
    featured: false,
  },
  {
    name: "Koyu Mineral Seçkisi",
    stone: "Dumanlı Kuvars",
    category: "Özel Seçkiler",
    price: 1490,
    stock: 3,
    image: "/hero-stone-smoky-quartz.jpg",
    badge: "Premium",
    discountPercent: 0,
    description:
      "Modern ve koyu tonlu doğal taş dekorasyonunu sevenler için ayrılmış dumanlı kuvars parçaları.",
    featured: false,
  },
];

const demoHoverImages = [
  "/hero-stone-amethyst.jpg",
  "/stone-amethyst.jpg",
  "/hero-stone-smoky-quartz.jpg",
  "/stone-rose-quartz.jpg",
  "/hero-stone-clear-quartz.jpg",
  "/stone-collection.jpg",
  "/hero-crystals.jpg",
  "/hero-stone-citrine.jpg",
];

export const defaultProducts: Product[] = demoProducts.map((product, index) => ({
  ...product,
  id: index + 1,
  status: "published",
  shopierSyncStatus: "manual",
  hoverImage:
    product.hoverImage ??
    demoHoverImages[index % demoHoverImages.length],
  sortOrder: index + 1,
}));

export const defaultSettings: StoreSettings = {
  businessName: "Terragolds",
  announcement:
    "Özenle seçilmiş doğal taşlar • Güvenli paketleme • Türkiye'nin her yerine gönderim",
  email: "merhaba@terragolds.com",
  phone: "",
  whatsapp: "",
  address: "",
  district: "",
  city: "",
  mapUrl: "",
  facebook: "https://www.facebook.com/profile.php?id=61592677166035",
  instagram: "https://www.instagram.com/terragolds/",
  pinterest: "",
  businessHours: "Pazartesi-Cumartesi · 10.00-18.00",
  footerNote: "Doğadan seçildi, özenle sunuldu.",
  shippingFee: "79.90",
  freeShippingThreshold: "1000",
};

export const settingsKeys = Object.keys(
  defaultSettings,
) as (keyof StoreSettings)[];

export function getDiscountedPrice(
  product: Pick<Product, "price" | "discountPercent">,
) {
  const discount = Math.min(90, Math.max(0, product.discountPercent || 0));
  return Math.max(0, Math.round(product.price * ((100 - discount) / 100)));
}
