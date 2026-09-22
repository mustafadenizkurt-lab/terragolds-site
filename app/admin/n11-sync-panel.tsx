"use client";

import MarketplaceCredentialsPanel from "./marketplace-credentials-panel";

// Faz 1: sadece bağlantı bilgileri. Ürün/stok/sipariş senkronu (Trendyol ve
// Hepsiburada panellerindeki gibi) N11 kategori-özellik eşlemesi ayrı bir
// iş olduğu için henüz yok - bu yüzden burada sahte "senkronla" butonu
// göstermiyoruz.
export default function N11SyncPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  return (
    <div className="admin-marketplace-sync">
      <MarketplaceCredentialsPanel provider="n11" onNotice={onNotice} />

      <div className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-kicker">N11 Marketplace</p>
            <h2>Ürün ve sipariş senkronu</h2>
            <p>
              Bağlantı bilgileriniz yukarıda kaydedilip doğrulandıktan sonra
              ürün gönderme, fiyat/stok güncelleme ve sipariş çekme
              özellikleri (Trendyol ve Hepsiburada panellerindekiyle aynı
              yapıda) bir sonraki adımda eklenecek. N11 kategori bazlı
              zorunlu ürün özellikleri istediği için önce kategori
              eşleştirmesi yapılması gerekiyor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
