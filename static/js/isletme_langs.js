// =====================================================================
// İŞLETME PANELİ — DİL DOSYASI
// Yeni dil eklemek için bu dosyayı düzenleyin.
// Yeni bir metin anahtarı eklerken hem 'tr' hem 'en' bloğuna ekleyin.
// =====================================================================

var IP_LANGS = {
  tr: {
    // Sayfa / genel
    pageTitle: 'İşletme Yönetim Paneli',
    // Sidebar nav
    dashboard: 'Dashboard', randevular: 'Randevular',
    calisanlar: 'Çalışanlar', hizmetler: 'Hizmetler & Fiyatlar',
    navSaatler: 'Çalışma Saatleri', navIsletme: 'İşletme Bilgileri',
    saatler: 'Çalışma Saatleri', isletme: 'İşletme Bilgileri',
    profil: 'Profilim', ayarlar: 'Ayarlar',
    // Dashboard
    bekleyen: 'Bekleyen', onaylanan: 'Onaylanan', bugun: 'Bugün',
    toplamRandevu: 'Toplam Randevu', hizmet: 'Hizmet', calisan: 'Çalışan',
    bekleyenRandevular: 'Bekleyen Randevular', tumunuGor: 'Tümünü Gör →',
    tumRandevular: 'Tüm Randevular',
    // Genel form
    adSoyad: 'Ad Soyad', uzmanlik: 'Uzmanlık', telefon: 'Telefon',
    kategori: 'Kategori', sureDakika: 'Süre (dakika)', fiyatTL: 'Fiyat (TL)',
    sorumluCalisan: 'Sorumlu Çalışan', opsiyonel: '(opsiyonel)',
    tarih: 'Tarih', aciklama: 'Açıklama', ekle: 'Ekle',
    // Çalışanlar
    yeniCalisanEkle: 'Yeni Çalışan Ekle', kayitliCalisanlar: 'Kayıtlı Çalışanlar',
    calisanEkleBtn: '➕ Çalışan Ekle',
    // Hizmetler
    hizmetAdi: 'Hizmet Adı', yeniHizmetEkle: 'Yeni Hizmet / Fiyat Ekle',
    kayitliHizmetler: 'Kayıtlı Hizmetler', hizmetEkleBtn: '➕ Hizmet Ekle',
    hizliSablon: 'Hızlı Şablon:',
    // Çalışma saatleri
    haftalikSaatler: 'Haftalık Çalışma Saatleri', tumunuKaydet: 'Tümünü Kaydet',
    tatilGunler: 'Tatil / Kapalı Günler', tatilGunuEkle: 'Tatil Günü Ekle',
    acik: 'Açık', kapali: 'Kapalı',
    // İşletme bilgileri
    canliOnizleme: 'Canlı Önizleme', isletmeBilgDuzenle: 'İşletme Bilgilerini Düzenle',
    isletmeAdi: 'İşletme Adı', adres: 'Adres',
    hakkinda: 'Hakkında', musteriGoster: '(müşterilere gösterilir)',
    isletmeAktif: 'İşletme Aktif',
    // Hesap
    hesapBilgileri: 'Hesap Bilgileri',
    // Ayarlar
    cikisYap: 'Çıkış Yap', bilgileriGuncelle: 'Bilgileri Güncelle',
    tema: '🎨 Tema', temaAcik: 'Açık', temaKoyu: 'Koyu', temaSistem: 'Sistem',
    dil: '🌐 Dil',
    // Placeholder'lar
    phAdSoyad: 'ör. Ahmet Yılmaz', phAciklama: 'ör. Kurban Bayramı',
    // Hizmet tablo
    hizmetHeaders: ['#','Hizmet Adı','Kategori','Süre','Fiyat','Sorumlu Uzman','Aktif','İşlem'],
    calisanHeaders: ['#','Ad Soyad','Uzmanlık','Telefon','Aktif','İşlem'],
    randevuHeaders: ['Tarih','Saat','Müşteri','Telefon','Hizmet','Çalışan','Ücret','Durum','İşlem'],
    dashHeaders: ['Tarih / Saat','Müşteri','Telefon','Hizmet','Çalışan','İşlem'],
    veriAlinamadi: 'Veri alınamadı',
    dashTh0:'Tarih / Saat', dashTh1:'Müşteri', dashTh2:'Telefon', dashTh3:'Hizmet', dashTh4:'Çalışan', dashTh5:'İşlem',
    tatilHeaders: ['Tarih','Açıklama','İşlem'],
    // Durum badge'leri
    durumBekliyor: '⏳ Bekliyor', durumOnaylandi: '✅ Onaylandı',
    durumTamamlandi: '🎉 Tamamlandı', durumIptal: '❌ İptal',
    // Günler
    gunler: ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'],
    // Otomatik çeviri
    otoCeviri: 'Otomatik Çeviri', otoCeviriAcik: 'Hizmet adları Google Translate ile otomatik İngilizce\'ye çevrilir. Key veya kayıt gerektirmez.',
    baglantiTest: 'Bağlantı Test Et',
    // Şablon butonları
    berberSablonlar: ['Saç Kesimi','Sakal Tıraşı','Saç + Sakal','Çocuk Saç Kesimi','Bıyık Şekillendirme','Saç Boyama','Fön'],
    epilasyonSablonlar: ['Bacak Epilasyon','Koltuk Altı Epilasyon','Bikini Epilasyon','Yüz Epilasyon','Tam Vücut Epilasyon','Üst Dudak','Kaş Şekillendirme'],
    // Genel
    yenile: 'Yenile', randevuBulunamadi: 'Randevu bulunamadı',
    karakter: 'karakter', sablonYuklendi: 'şablonu yüklendi. Fiyatı düzenleyip ekleyebilirsiniz.',
    // Ayarlar açıklamalar
    gorunumTercihi: 'Görünüm tercihini seç', arayuzDili: 'Arayüz dilini seç',
    // Placeholderlar
    phHakkinda: 'İşletmeniz hakkında kısa bir tanıtım yazısı...',
    phSifreTekrar: 'Şifreyi tekrar girin', phEnAz6: 'En az 6 karakter',
    phIsletmeAdi: 'İşletme adı', phAdres: 'İlçe, Mahalle, Cadde/Sokak No',
    phTarih: 'ör. Kurban Bayramı',
    phHizmetAdi: 'ör. Saç Kesimi',
    // Sidebar tur badge
    berberSalonuBadge: 'Berber Salonu', epilasyonMerkeziBadge: 'Epilasyon Merkezi',
    // Dropdown seçenekleri
    uzmBerber: '✂️ Berber', uzmEpilasyon: '✨ Epilasyon Uzmanı', uzmKasiyer: '💰 Kasiyer', uzmDiger: '👤 Diğer',
    katBerber: '✂️ Berber', katEpilasyon: '✨ Epilasyon',
    uzmanSecOpsiyonel: '— Uzman seç (opsiyonel) —',
    // Boş tablo mesajları
    bekleyenRandevuYok: '🎉 Bekleyen randevu yok!',
    tatilGunuEklenmemis: 'Tatil günü eklenmemiş',
    hizmetEklenmemis: 'Henüz hizmet eklenmemiş. Şablon seçin veya manuel ekleyin.',
    // Validasyon mesajları
    hizmetAdiSureZorunlu: 'Hizmet adı ve süre zorunlu!',
    isletmeSecin: 'İşletme seçin!',
    adZorunlu: 'Ad zorunlu!',
    adZorunludur: 'Ad zorunludur!',
    isletmeAdiZorunlu: 'İşletme adı zorunludur!',
    // Confirm mesajları
    randevuIptalOnayi: 'Randevuyu iptal etmek istiyor musunuz?',
    calisanSilOnayi: 'Çalışanı silmek istiyor musunuz?',
    hizmetSilOnayi: 'Bu hizmeti silmek istiyor musunuz?',
    tatilSilOnayi: 'Tatil gününü silmek istiyor musunuz?',
    hizmetCeviriOnayi: 'Tüm hizmetlerin İngilizce çevirisini otomatik yap? (Sadece çevirisi olmayan hizmetler güncellenir)',
    // Modal başlıkları
    calisanDuzenle: 'Çalışan Düzenle',
    hizmetDuzenle: 'Hizmet Düzenle',
    // Modal etiketler
    adSoyadYildiz: 'Ad Soyad *',
    uzmanlikLabel: 'Uzmanlık',
    telefonLabel: 'Telefon',
    kaydetBtn: '💾 Kaydet',
    iptalBtn: 'İptal',
    // Toast mesajları
    hizmetAktifMesaj: 'Hizmet aktif edildi',
    hizmetPasifMesaj: 'Hizmet pasif edildi',
    // İşletme kaydet butonu
    degisiklikleriKaydetBtn: '💾 Değişiklikleri Kaydet',
    kaydediliyor: 'Kaydediliyor...',
    isletmeGuncellendi: '✅ İşletme bilgileri güncellendi!',
    calisanEklendi: '✅ Çalışan eklendi!',
    calisanGuncellendi: '✅ Çalışan güncellendi!',
    calisanSilindi: '✅ Çalışan silindi!',
    hizmetEklendi: '✅ Hizmet eklendi!',
    hizmetGuncellendi: '✅ Hizmet güncellendi!',
    hizmetSilindi: '✅ Hizmet silindi!',
    saatlerKaydedildi: '✅ Çalışma saatleri kaydedildi!',
    tatilEklendi: '✅ Tatil günü eklendi!',
    tarihZatenEklenmis: 'Bu tarih zaten eklenmiş!',
    silBtn: 'Sil',
    tatilSilindi: '✅ Tatil günü silindi!',
    ceviriTamamlandi: '✅ Çeviri tamamlandı!',
    epostaZorunlu: 'E-posta zorunludur!',
    sifreMinAlti: 'Şifre en az 6 karakter olmalı!',
    sunucuHatasi: 'Sunucu hatası!',
    hesapGuncellendi: '✅ Hesap bilgileri güncellendi!',
    sifrelerEslesmiyor: 'Şifreler eşleşmiyor!',
    kaydedildi: 'kaydedildi',
    tumIsletmeler: 'Tüm İşletmeler', isletmeSecLabel: '-- İşletme Seçin --',
    calisanEklenmemis: 'Henüz çalışan eklenmemiş',
    calisanAktif: 'Çalışan aktif edildi', calisanPasif: 'Çalışan pasif edildi',
    ceviriYapiliyor: 'Çeviri yapılıyor...',
    tarihSecin: 'Tarih seçin!',
    randevuDetayi: 'Randevu Detayı',
    // Temizle
    temizle: 'Temizle',
    // Önizleme badge
    onizBerber: '✂️ Berber', onizEpilasyon: '✨ Epilasyon',
    // boş bırakılırsa değişmez
    bosDeğişmez: '(boş bırakılırsa değişmez)',
    // Otomatik çevir
    otomatikCevir: 'Otomatik Çevir',
    // İşletme formu
    isletmeTuru: 'İşletme Türü', berberSalonu: 'Berber Salonu', epilasyonMerkezi: 'Epilasyon Merkezi',
    degisiklikleriKaydet: 'Değişiklikleri Kaydet', sifirla: 'Sıfırla',
    yoneticiAdSoyad: 'Yönetici Ad Soyad', eposta: 'E-posta',
    yeniSifre: 'Yeni Şifre', sifreTekrar: 'Şifre Tekrar',
    hesapGuncelle: 'Hesap Bilgilerini Güncelle',
    // Randevu dropdown
    tumDurumlar: 'Tüm Durumlar',
  },
  en: {
    pageTitle: 'Business Management Panel',
    dashboard: 'Dashboard', randevular: 'Appointments',
    calisanlar: 'Staff', hizmetler: 'Services & Prices',
    navSaatler: 'Working Hours', navIsletme: 'Business Info',
    saatler: 'Working Hours', isletme: 'Business Info',
    profil: 'My Profile', ayarlar: 'Settings',
    bekleyen: 'Pending', onaylanan: 'Approved', bugun: 'Today',
    toplamRandevu: 'Total Appts', hizmet: 'Service', calisan: 'Staff',
    bekleyenRandevular: 'Pending Appointments', tumunuGor: 'View All →',
    tumRandevular: 'All Appointments',
    adSoyad: 'Full Name', uzmanlik: 'Specialty', telefon: 'Phone',
    kategori: 'Category', sureDakika: 'Duration (min)', fiyatTL: 'Price (TL)',
    sorumluCalisan: 'Responsible Staff', opsiyonel: '(optional)',
    tarih: 'Date', aciklama: 'Description', ekle: 'Add',
    yeniCalisanEkle: 'Add New Staff', kayitliCalisanlar: 'Registered Staff',
    calisanEkleBtn: '➕ Add Staff',
    hizmetAdi: 'Service Name', yeniHizmetEkle: 'Add New Service / Price',
    kayitliHizmetler: 'Registered Services', hizmetEkleBtn: '➕ Add Service',
    hizliSablon: 'Quick Templates:',
    haftalikSaatler: 'Weekly Working Hours', tumunuKaydet: 'Save All',
    tatilGunler: 'Holidays / Closed Days', tatilGunuEkle: 'Add Holiday',
    acik: 'Open', kapali: 'Closed',
    canliOnizleme: 'Live Preview', isletmeBilgDuzenle: 'Edit Business Info',
    isletmeAdi: 'Business Name', adres: 'Address',
    hakkinda: 'About', musteriGoster: '(shown to customers)',
    isletmeAktif: 'Business Active',
    hesapBilgileri: 'Account Settings',
    cikisYap: 'Sign Out', bilgileriGuncelle: 'Update Info',
    tema: '🎨 Theme', temaAcik: 'Light', temaKoyu: 'Dark', temaSistem: 'System',
    dil: '🌐 Language',
    phAdSoyad: 'e.g. John Smith', phAciklama: 'e.g. National Holiday',
    hizmetHeaders: ['#','Service Name','Category','Duration','Price','Specialist','Active','Action'],
    calisanHeaders: ['#','Full Name','Specialty','Phone','Active','Action'],
    randevuHeaders: ['Date','Time','Customer','Phone','Service','Staff','Price','Status','Action'],
    dashHeaders: ['Date / Time','Customer','Phone','Service','Staff','Action'],
    veriAlinamadi: 'Data unavailable',
    dashTh0:'Date / Time', dashTh1:'Customer', dashTh2:'Phone', dashTh3:'Service', dashTh4:'Staff', dashTh5:'Action',
    tatilHeaders: ['Date','Description','Action'],
    durumBekliyor: '⏳ Pending', durumOnaylandi: '✅ Approved',
    durumTamamlandi: '🎉 Completed', durumIptal: '❌ Cancelled',
    gunler: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    otoCeviri: 'Auto Translation', otoCeviriAcik: 'Service names are automatically translated to English via Google Translate. No key or registration required.',
    baglantiTest: 'Test Connection',
    // Template buttons
    berberSablonlar: ['Haircut','Beard Trim','Hair + Beard','Kids Haircut','Mustache Styling','Hair Coloring','Blow Dry'],
    epilasyonSablonlar: ['Leg Epilation','Underarm Epilation','Bikini Epilation','Facial Epilation','Full Body Epilation','Upper Lip','Eyebrow Shaping'],
    // General
    yenile: 'Refresh', randevuBulunamadi: 'No appointments found',
    karakter: 'characters', sablonYuklendi: 'template loaded. Edit the price and add.',
    // Settings descriptions
    gorunumTercihi: 'Choose appearance preference', arayuzDili: 'Select interface language',
    // Placeholders
    phHakkinda: 'A brief introduction about your business...',
    phSifreTekrar: 'Re-enter password', phEnAz6: 'At least 6 characters',
    phIsletmeAdi: 'Business name', phAdres: 'District, Neighborhood, Street No',
    phTarih: 'e.g. National Holiday',
    phHizmetAdi: 'e.g. Haircut',
    // Sidebar tur badge
    berberSalonuBadge: 'Barber Salon', epilasyonMerkeziBadge: 'Epilation Center',
    // Dropdown options
    uzmBerber: '✂️ Barber', uzmEpilasyon: '✨ Epilation Specialist', uzmKasiyer: '💰 Cashier', uzmDiger: '👤 Other',
    katBerber: '✂️ Barber', katEpilasyon: '✨ Epilation',
    uzmanSecOpsiyonel: '— Select Staff (optional) —',
    // Empty table messages
    bekleyenRandevuYok: '🎉 No pending appointments!',
    tatilGunuEklenmemis: 'No holidays added',
    hizmetEklenmemis: 'No services added yet. Choose a template or add manually.',
    // Validation messages
    hizmetAdiSureZorunlu: 'Service name and duration are required!',
    isletmeSecin: 'Select a business!',
    adZorunlu: 'Name is required!',
    adZorunludur: 'Name is required!',
    isletmeAdiZorunlu: 'Business name is required!',
    // Confirm messages
    randevuIptalOnayi: 'Do you want to cancel this appointment?',
    calisanSilOnayi: 'Do you want to delete this staff member?',
    hizmetSilOnayi: 'Do you want to delete this service?',
    tatilSilOnayi: 'Do you want to delete this holiday?',
    hizmetCeviriOnayi: 'Auto-translate all services to English? (Only services without translation will be updated)',
    // Modal titles
    calisanDuzenle: 'Edit Staff',
    hizmetDuzenle: 'Edit Service',
    // Modal labels
    adSoyadYildiz: 'Full Name *',
    uzmanlikLabel: 'Specialty',
    telefonLabel: 'Phone',
    kaydetBtn: '💾 Save',
    iptalBtn: 'Cancel',
    // Toast messages
    hizmetAktifMesaj: 'Service activated',
    hizmetPasifMesaj: 'Service deactivated',
    // Business save button
    degisiklikleriKaydetBtn: '💾 Save Changes',
    kaydediliyor: 'Saving...',
    isletmeGuncellendi: '✅ Business info updated!',
    calisanEklendi: '✅ Staff added!',
    calisanGuncellendi: '✅ Staff updated!',
    calisanSilindi: '✅ Staff deleted!',
    hizmetEklendi: '✅ Service added!',
    hizmetGuncellendi: '✅ Service updated!',
    hizmetSilindi: '✅ Service deleted!',
    saatlerKaydedildi: '✅ Working hours saved!',
    tatilEklendi: '✅ Holiday added!',
    tarihZatenEklenmis: 'This date is already added!',
    silBtn: 'Delete',
    tatilSilindi: '✅ Holiday deleted!',
    ceviriTamamlandi: '✅ Translation completed!',
    epostaZorunlu: 'Email is required!',
    sifreMinAlti: 'Password must be at least 6 characters!',
    sunucuHatasi: 'Server error!',
    hesapGuncellendi: '✅ Account updated!',
    sifrelerEslesmiyor: 'Passwords do not match!',
    kaydedildi: 'saved',
    tumIsletmeler: 'All Businesses', isletmeSecLabel: '-- Select Business --',
    calisanEklenmemis: 'No staff added yet',
    calisanAktif: 'Staff activated', calisanPasif: 'Staff deactivated',
    ceviriYapiliyor: 'Translating...',
    tarihSecin: 'Please select a date!',
    randevuDetayi: 'Appointment Details',
    // Clear
    temizle: 'Clear',
    // Preview badge
    onizBerber: '✂️ Barber', onizEpilasyon: '✨ Epilation',
    // password hint
    bosDeğişmez: '(leave blank to keep unchanged)',
    // Auto translate
    otomatikCevir: 'Auto Translate',
    // İşletme formu
    isletmeTuru: 'Business Type', berberSalonu: 'Barber Salon', epilasyonMerkezi: 'Epilation Center',
    degisiklikleriKaydet: 'Save Changes', sifirla: 'Reset',
    yoneticiAdSoyad: 'Manager Full Name', eposta: 'Email',
    yeniSifre: 'New Password', sifreTekrar: 'Confirm Password',
    hesapGuncelle: 'Update Account',
    // Randevu dropdown
    tumDurumlar: 'All Statuses',
  }
};