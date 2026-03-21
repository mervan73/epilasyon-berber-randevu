// =====================================================
// KULLANICI PANELİ JAVASCRIPT  — v3
// =====================================================

let currentUser   = null;
let allIsletmeler = [];
let allHizmetler  = [];
let rSelectedHizmet = null;

// =====================================================
// BAŞLAT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem('theme') || 'light');
    const savedLang = localStorage.getItem('lang') || 'tr';
    currentLang = savedLang;
    applyLang(savedLang);  // Her zaman uygula (TR dahil)
    checkSession();
    loadPublicIsletmeler();
    loadPublicHizmetler();

    const tarihInput = document.getElementById('rTarih');
    if (tarihInput) {
        const today = new Date().toISOString().split('T')[0];
        tarihInput.setAttribute('min', today);
    }
});

// =====================================================
// OTURUM
// =====================================================
async function checkSession() {
    try {
        const res  = await fetch('/api/oturum');
        const data = await res.json();
        if (data.success) { currentUser = data.user; setLoggedIn(data.user); }
        else              { setLoggedOut(); }
    } catch { setLoggedOut(); }
}

function setLoggedIn(user) {
    const gm = document.getElementById('guestMenu');
    const um = document.getElementById('userMenu');
    if (gm) { gm.classList.add('d-none'); gm.classList.remove('d-flex'); }
    if (um) { um.classList.remove('d-none'); um.classList.add('d-flex'); }
    const el = document.getElementById('userName');
    if (el) el.textContent = user.ad.split(' ')[0];
    const elFull = document.getElementById('userNameFull');
    if (elFull) elFull.textContent = '👤 ' + user.ad;
    const adminLi = document.getElementById('adminMenuLi');
    if (adminLi) adminLi.style.display = user.is_admin ? 'block' : 'none';
    const rAd = document.getElementById('rMusteriAd');
    if (rAd) rAd.value = user.ad || '';
    // Sidebar kullanıcı bilgisi
    const sbInfo = document.getElementById('sbUserInfo');
    if (sbInfo) sbInfo.style.display = 'block';
    const sbName = document.getElementById('sbUserName');
    if (sbName) sbName.textContent = user.ad || '—';
    const sbAv = document.getElementById('sbUserAvatar');
    if (sbAv) sbAv.textContent = (user.ad||'U')[0].toUpperCase();
    const sbLogged = document.getElementById('sbLoggedMenu');
    if (sbLogged) sbLogged.style.display = 'block';
    const sbGuest = document.getElementById('sbGuestMenu');
    if (sbGuest) sbGuest.style.display = 'none';
    const sbAdmin = document.getElementById('sbAdminLink');
    if (sbAdmin) sbAdmin.style.display = user.is_admin ? 'block' : 'none';
}

function setLoggedOut() {
    const gm = document.getElementById('guestMenu');
    const um = document.getElementById('userMenu');
    if (gm) { gm.classList.remove('d-none'); gm.classList.add('d-flex'); }
    if (um) { um.classList.add('d-none'); um.classList.remove('d-flex'); }
    currentUser = null;
    // Sidebar misafir modu
    const sbInfo = document.getElementById('sbUserInfo');
    if (sbInfo) sbInfo.style.display = 'none';
    const sbLogged = document.getElementById('sbLoggedMenu');
    if (sbLogged) sbLogged.style.display = 'none';
    const sbGuest = document.getElementById('sbGuestMenu');
    if (sbGuest) sbGuest.style.display = 'block';
}

// =====================================================
// PUBLIC VERİ YÜKLEME
// =====================================================
async function loadPublicIsletmeler() {
    const grid = document.getElementById('isletmelerGrid');
    if (!grid) return;
    try {
        const res  = await fetch('/api/public/isletmeler');
        const data = await res.json();
        if (data.success && data.isletmeler.length > 0) {
            allIsletmeler = data.isletmeler;
            const promises = allIsletmeler.map(async (isletme) => {
                try {
                    const [hRes, cRes] = await Promise.all([
                        fetch(`/api/public/hizmetler?isletme_id=${isletme.id}`),
                        fetch(`/api/public/calisanlar?isletme_id=${isletme.id}`)
                    ]);
                    const hd = await hRes.json();
                    const cd = await cRes.json();
                    isletme._hizmetSayisi  = hd.success ? hd.hizmetler.length  : 0;
                    isletme._calisanSayisi = cd.success ? cd.calisanlar.length : 0;
                } catch { isletme._hizmetSayisi = 0; isletme._calisanSayisi = 0; }
            });
            await Promise.all(promises);
            renderIsletmeler(allIsletmeler);
            updateHeroStats();
        } else {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <i class="fas fa-store-slash"></i><h3>Henüz işletme eklenmemiş</h3></div>`;
        }
    } catch {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <i class="fas fa-exclamation-circle"></i><h3>Bağlantı hatası</h3></div>`;
    }
}

function renderIsletmeler(list) {
    const grid = document.getElementById('isletmelerGrid');
    if (!grid) return;
    const ld = APP_LANGS[currentLang] || APP_LANGS['tr'];
    if (!list.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <i class="fas fa-search"></i><h3>${ld.sonucBulunamadi}</h3></div>`;
        return;
    }
    grid.innerHTML = list.map(i => `
        <div class="col-md-6 col-lg-4">
          <div class="isletme-card h-100 d-flex flex-column" data-tur="${i.tur}">
            <div class="card-header-strip ${i.tur}"></div>
            <div class="p-3 flex-grow-1 d-flex flex-column">
              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="card-icon ${i.tur}">
                  <i class="fas ${i.tur==='berber'?'fa-cut':'fa-spa'}"></i>
                </div>
                <div>
                  <h5 class="mb-0 fw-bold">${i.ad}</h5>
                  <span class="badge-tur ${i.tur}">${i.tur==='berber'?'✂️ '+ld.detayBerber:'✨ '+ld.detayEpilasyon}</span>
                </div>
              </div>
              ${i.aciklama?`<p class="small text-muted mb-2">${i.aciklama.substring(0,80)}${i.aciklama.length>80?'...':''}</p>`:''}
              <div class="small text-muted mb-2">
                ${i.adres?`<div><i class="fas fa-map-marker-alt me-1"></i>${i.adres}</div>`:''}
                ${i.telefon?`<div><i class="fas fa-phone me-1"></i>${i.telefon}</div>`:''}
              </div>
              <div class="d-flex gap-3 mb-3 mt-auto">
                <div class="text-center"><div class="fw-bold">${i._hizmetSayisi}</div><div class="small text-muted">${ld.kartHizmet}</div></div>
                <div class="text-center"><div class="fw-bold">${i._calisanSayisi}</div><div class="small text-muted">${ld.kartUzman}</div></div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary btn-sm flex-fill" onclick="showIsletmeDetay(${i.id})">
                  <i class="fas fa-info-circle"></i> ${ld.kartDetay}
                </button>
                <button class="btn btn-sm flex-fill fw-bold text-white" style="background:linear-gradient(135deg,#0f2b3d,#1b4a6b)" onclick="openRandevuForIsletme(${i.id})">
                  <i class="fas fa-calendar-plus"></i> ${ld.kartRdvAl}
                </button>
              </div>
            </div>
          </div>
        </div>`).join('');
}

function filterIsletmeler(tur, btn) {
    document.querySelectorAll('.filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderIsletmeler(tur === 'all' ? allIsletmeler : allIsletmeler.filter(i => i.tur === tur));
}

async function loadPublicHizmetler() {
    const grid = document.getElementById('hizmetlerGrid');
    if (!grid) return;
    try {
        const res  = await fetch('/api/public/hizmetler');
        const data = await res.json();
        if (data.success && data.hizmetler.length > 0) {
            allHizmetler = data.hizmetler;
            renderHizmetler(allHizmetler);
        } else {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <i class="fas fa-cut"></i><h3>Henüz hizmet eklenmemiş</h3></div>`;
        }
    } catch {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <i class="fas fa-exclamation-circle"></i><h3>Yüklenemedi</h3></div>`;
    }
}

function renderHizmetler(list) {
    const grid = document.getElementById('hizmetlerGrid');
    if (!grid) return;
    const d = APP_LANGS[currentLang] || APP_LANGS['tr'];
    if (!list.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
            <i class="fas fa-search"></i><h3>${currentLang==='en'?'No results found':'Sonuç bulunamadı'}</h3></div>`;
        return;
    }
    grid.innerHTML = list.map(h => {
        const isletme = allIsletmeler.find(i => i.id === h.isletme_id);
        const badgeTxt = h.kategori==='berber' ? d.kartBerber : d.kartEpilasyon;
        return `
        <div class="col-sm-6 col-lg-4 col-xl-3">
          <div class="hizmet-card h-100 d-flex flex-column" data-kategori="${h.kategori}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="card-icon ${h.kategori}" style="width:44px;height:44px;font-size:18px">
                <i class="fas ${h.kategori==='berber'?'fa-cut':'fa-spa'}"></i>
              </div>
              <span class="fw-bold fs-5" style="color:var(--brand2)">${parseFloat(h.ucret).toLocaleString('tr-TR')} <small class="fs-6">₺</small></span>
            </div>
            <div class="fw-bold mb-1">${(currentLang==='en' && h.ad_en) ? h.ad_en : h.ad}</div>
            <div class="small text-muted mb-2"><i class="fas fa-store me-1"></i>${isletme?isletme.ad:''}</div>
            <div class="d-flex justify-content-between align-items-center mb-3 mt-auto">
              <span class="small text-muted"><i class="far fa-clock me-1"></i>${h.sure} ${d.kartDk}</span>
              <span class="badge-tur ${h.kategori}">${badgeTxt}</span>
            </div>
            <button class="btn btn-sm w-100 fw-bold text-white" style="background:linear-gradient(135deg,#0f2b3d,#1b4a6b)"
              onclick="openRandevuForHizmet(${h.id},${h.isletme_id})">
              <i class="fas fa-calendar-plus me-1"></i>${d.kartRandevuAl}
            </button>
          </div>
        </div>`;
    }).join('');
}

function filterHizmetler(kat, btn) {
    btn.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderHizmetler(kat === 'all' ? allHizmetler : allHizmetler.filter(h => h.kategori === kat));
}

function updateHeroStats() {
    const sI = document.getElementById('statIsletme');
    const sH = document.getElementById('statHizmet');
    const sC = document.getElementById('statCalisan');
    if (sI) sI.textContent = allIsletmeler.length;
    if (sH) sH.textContent = allHizmetler.length;
    if (sC) sC.textContent = allIsletmeler.reduce((s,i) => s+(i._calisanSayisi||0), 0);
}

// =====================================================
// İŞLETME DETAY MODALİ
// =====================================================
async function showIsletmeDetay(isletmeId) {
    const isletme = allIsletmeler.find(i => i.id === isletmeId);
    if (!isletme) return;
    const ld = APP_LANGS[currentLang] || APP_LANGS['tr'];

    const [hRes, cRes] = await Promise.all([
        fetch(`/api/public/hizmetler?isletme_id=${isletmeId}`),
        fetch(`/api/public/calisanlar?isletme_id=${isletmeId}`)
    ]);
    const hData = await hRes.json();
    const cData = await cRes.json();
    const hizmetler  = hData.success ? hData.hizmetler  : [];
    const calisanlar = cData.success ? cData.calisanlar : [];

    document.getElementById('isletmeDetayContent').innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            <div class="ic-icon ic-icon-${isletme.tur}" style="width:56px;height:56px;font-size:24px">
                <i class="fas ${isletme.tur === 'berber' ? 'fa-cut' : 'fa-spa'}"></i>
            </div>
            <div>
                <h2 style="font-size:1.3rem;margin-bottom:4px">${isletme.ad}</h2>
                <span class="badge badge-${isletme.tur === 'berber' ? 'berber' : 'epilasyon'}">
                    ${isletme.tur==='berber'?'✂️ '+ld.detayBerber:'✨ '+ld.detayEpilasyon}
                </span>
            </div>
        </div>
        ${isletme.aciklama ? `<p style="color:var(--text-muted);margin-bottom:16px;font-size:14px">${isletme.aciklama}</p>` : ''}
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:20px">
            ${isletme.adres   ? `<span style="font-size:13px;color:var(--text-muted)"><i class="fas fa-map-marker-alt" style="margin-right:5px;color:var(--primary-light)"></i>${isletme.adres}</span>` : ''}
            ${isletme.telefon ? `<span style="font-size:13px;color:var(--text-muted)"><i class="fas fa-phone" style="margin-right:5px;color:var(--primary-light)"></i>${isletme.telefon}</span>` : ''}
        </div>

        <h3 style="color:var(--primary);margin-bottom:12px;font-size:15px">
            <i class="fas fa-cut" style="margin-right:7px"></i>${ld.detayHizmetler} (${hizmetler.length})
        </h3>
        ${hizmetler.length > 0 ? `
            <div style="display:grid;gap:8px;margin-bottom:20px">
                ${hizmetler.map(h => `
                    <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:10px 14px;background:var(--bg);border-radius:var(--radius-md);font-size:13px">
                        <div style="display:flex;align-items:center;gap:8px">
                            <span class="badge badge-${h.kategori==='berber'?'berber':'epilasyon'}">
                                ${h.kategori==='berber'?'✂️':'✨'}
                            </span>
                            <strong>${(currentLang==='en' && h.ad_en) ? h.ad_en : h.ad}</strong>
                            <span style="color:var(--text-muted)">${h.sure} ${ld.detayDk}</span>
                        </div>
                        <strong style="color:var(--primary)">${parseFloat(h.ucret).toLocaleString('tr-TR')} TL</strong>
                    </div>`).join('')}
            </div>` : `<p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">${ld.detayHizmetYok}</p>`}

        <h3 style="color:var(--primary);margin-bottom:12px;font-size:15px">
            <i class="fas fa-users" style="margin-right:7px"></i>${ld.detayUzmanlar} (${calisanlar.length})
        </h3>
        ${calisanlar.length > 0 ? `
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px">
                ${calisanlar.map(c => `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;
                        background:var(--bg);border-radius:var(--radius-md);font-size:13px">
                        <i class="fas fa-user-circle" style="color:var(--primary-light)"></i>
                        <strong>${c.ad}</strong>
                        <span class="badge badge-${c.uzmanlik==='berber'?'berber':'epilasyon'}">${c.uzmanlik==='berber'?ld.detayBerber:ld.detayEpilasyon}</span>
                    </div>`).join('')}
            </div>` : `<p style="color:var(--text-muted);font-size:13px;margin-bottom:16px">${ld.detayUzmanYok}</p>`}

        <button class="btn btn-primary w-full"
            onclick="openRandevuForIsletme(${isletme.id}); bootstrap.Modal.getInstance(document.getElementById('isletmeModal'))?.hide()">
            <i class="fas fa-calendar-plus"></i> ${ld.detayRandevuAl}
        </button>`;
    const isletmeM = bootstrap.Modal.getOrCreateInstance(document.getElementById('isletmeModal'));
    isletmeM.show();
}

// =====================================================
// MODAL YÖNETİMİ
// =====================================================
function openModal(type) {
    // Tüm panelleri gizle
    document.querySelectorAll('.modal-pane').forEach(p => { p.classList.add('d-none'); p.style.display=''; });
    if (type === 'login') {
        document.getElementById('loginForm').classList.remove('d-none');
    } else if (type === 'register') {
        document.getElementById('registerForm').classList.remove('d-none');
    } else if (type === 'randevu') {
        document.getElementById('randevuForm').classList.remove('d-none');
        resetRandevuForm();
    }
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
    modal.show();
}

function closeModal() {
    const m = bootstrap.Modal.getInstance(document.getElementById('mainModal'));
    if (m) m.hide();
}
function closeRandevularimModal() {
    const m = bootstrap.Modal.getInstance(document.getElementById('randevularimModal'));
    if (m) m.hide();
}

function switchPane(id) {
    document.querySelectorAll('.modal-pane').forEach(p => { p.classList.add('d-none'); p.style.display=''; });
    document.getElementById(id).classList.remove('d-none');
}

function overlayClose(event, id) {
    if (event.target.id === id) document.getElementById(id).style.display = 'none';
}

// =====================================================
// KAYIT / GİRİŞ / ÇIKIŞ
// =====================================================
async function handleRegister() {
    const ad      = document.getElementById('registerAd').value.trim();
    const email   = document.getElementById('registerEmail').value.trim();
    const telefon = document.getElementById('registerTelefon').value.trim();
    const sifre   = document.getElementById('registerSifre').value;
    const tekrar  = document.getElementById('registerSifreTekrar').value;

    if (!ad||!email||!sifre)  { showToast('Tüm alanları doldurun!','error'); return; }
    if (sifre.length < 6)     { showToast('Şifre en az 6 karakter!','error'); return; }
    if (sifre !== tekrar)     { showToast('Şifreler eşleşmiyor!','error'); return; }

    try {
        const res  = await fetch('/api/kayit',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ad,email,telefon,sifre})});
        const data = await res.json();
        showToast(data.message, res.ok?'success':'error');
        if (res.ok) setTimeout(()=>switchPane('loginForm'),1200);
    } catch { showToast('Sunucu hatası!','error'); }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const sifre = document.getElementById('loginSifre').value;
    if (!email||!sifre) { showToast('Email ve şifre girin!','error'); return; }
    try {
        const res  = await fetch('/api/giris',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email,sifre})});
        const data = await res.json();
        if (res.ok) {
            showToast('✅ Giriş başarılı!','success');
            closeModal(); currentUser = data.user; setLoggedIn(data.user);
        } else { showToast(data.message,'error'); }
    } catch { showToast('Sunucu hatası!','error'); }
}

async function logout() {
    await fetch('/api/cikis',{method:'POST'});
    setLoggedOut();
    showToast('Çıkış yapıldı','success');
    setTimeout(()=>window.location.href='/',800);
}

// =====================================================
// ═══════════════════════════════════════════════════
//  RANDEVU FORMU — ADIM ADIM AKIŞ
//
//  ADIM 1 ▸ İşletmeyi önceden biliyoruz (openRandevuForIsletme / openRandevuForHizmet)
//           → isletme direkt seçili gelir, hizmetler + çalışanlar yüklenir
//  ADIM 2 ▸ Hizmet seç  → hizmet bilgisi gösterilir
//  ADIM 3 ▸ Çalışan seç → tarih alanı açılır
//  ADIM 4 ▸ Tarih seç   → o çalışanın müsait saatleri gelir
//  ADIM 5 ▸ Saat seç    → özet gösterilir + "Randevuyu Onayla" butonu aktif
// ═══════════════════════════════════════════════════
// =====================================================

// ── Tüm form durumunu tutan nesne ──
let RF = {
    isletme_id  : null,
    isletme_obj : null,
    hizmet      : null,   // seçili hizmet objesi
    calisan_id  : null,
    calisan_adi : '',
    tarih       : '',
    saat        : ''
};

function resetRandevuForm() {
    RF = { isletme_id:null, isletme_obj:null, hizmet:null,
           calisan_id:null, calisan_adi:'', tarih:'', saat:'' };
    rSelectedHizmet = null;

    const rAd  = document.getElementById('rMusteriAd');
    const rTel = document.getElementById('rMusteriTelefon');
    if (rAd)  rAd.value  = currentUser ? currentUser.ad   : '';
    if (rTel) rTel.value = currentUser ? (currentUser.telefon || '') : '';

    const notlar = document.getElementById('rNotlar');
    if (notlar) notlar.value = '';

    // Sıfırla: hizmet select
    const hSel = document.getElementById('rHizmet');
    if (hSel) hSel.innerHTML = '<option value="">-- Hizmet seçiniz --</option>';

    // Sıfırla: çalışan select
    const cSel = document.getElementById('rCalisan');
    if (cSel) cSel.innerHTML = '<option value="">-- Çalışan seçiniz --</option>';

    // Tarih
    const tarih = document.getElementById('rTarih');
    if (tarih) { tarih.value = ''; const today = new Date().toISOString().split('T')[0]; tarih.setAttribute('min',today); }

    // Saat
    document.getElementById('rSaat').value = '';
    const slots = document.getElementById('rSaatSlots');
    if (slots) slots.innerHTML = '';

    // Tüm adım panellerini gizle
    ['rIsletmeBilgi','rHizmetRow','rHizmetBilgi','rCalisanRow',
     'rTarihRow','rSaatRow','rOzet','rSubmitBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('d-none'); el.style.display = ''; }
    });
}

// ─────────────────────────────────────────────────────
// openRandevuForIsletme  — kart veya detay modalından
// ─────────────────────────────────────────────────────
async function openRandevuForIsletme(isletmeId) {
    if (!currentUser) {
        showToast('Randevu almak için giriş yapın!','error');
        openModal('login'); return;
    }
    openModal('randevu');
    await initRandevuWithIsletme(isletmeId);
}

// ─────────────────────────────────────────────────────
// openRandevuForHizmet  — hizmet kartından
// ─────────────────────────────────────────────────────
async function openRandevuForHizmet(hizmetId, isletmeId) {
    if (!currentUser) {
        showToast('Randevu almak için giriş yapın!','error');
        openModal('login'); return;
    }
    openModal('randevu');
    await initRandevuWithIsletme(isletmeId, hizmetId);
}

// ─────────────────────────────────────────────────────
// İşletme bilgisini yükle + hizmet/çalışan dropdown'larını doldur
// ─────────────────────────────────────────────────────
async function initRandevuWithIsletme(isletmeId, preselectedHizmetId = null) {
    RF.isletme_id  = isletmeId;
    RF.isletme_obj = allIsletmeler.find(i => i.id == isletmeId) || null;

    // İşletme bilgi bandını göster
    const bilgiDiv = document.getElementById('rIsletmeBilgi');
    if (bilgiDiv) {
        const obj = RF.isletme_obj;
        bilgiDiv.innerHTML = obj ? `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;
                background:var(--primary-ultra-light,#eff6ff);border-radius:10px;margin-bottom:4px">
                <div style="width:36px;height:36px;border-radius:9px;
                    background:${obj.tur==='berber'?'#1b4a6b':'#6b21a8'};
                    display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px">
                    <i class="fas ${obj.tur==='berber'?'fa-cut':'fa-spa'}"></i>
                </div>
                <div>
                    <strong style="font-size:14px">${obj.ad}</strong>
                    <div style="font-size:11.5px;color:var(--text-muted)">
                        ${obj.tur==='berber'?'✂️ Berber Salonu':'✨ Epilasyon Merkezi'}
                        ${obj.adres?'&nbsp;·&nbsp;<i class="fas fa-map-marker-alt"></i> '+obj.adres:''}
                    </div>
                </div>
            </div>` : '';
        bilgiDiv.style.display = 'block';
    }

    // Hizmetleri yükle
    const hSel = document.getElementById('rHizmet');
    hSel.innerHTML = '<option value="">Yükleniyor...</option>';
    document.getElementById('rHizmetRow').classList.remove('d-none');

    try {
        const res  = await fetch(`/api/public/hizmetler?isletme_id=${isletmeId}`);
        const data = await res.json();
        hSel.innerHTML = '<option value="">-- Hizmet seçiniz --</option>';
        if (data.success && data.hizmetler.length) {
            data.hizmetler.forEach(h => {
                const opt = document.createElement('option');
                opt.value        = h.id;
                opt.textContent  = `${(currentLang==='en' && h.ad_en) ? h.ad_en : h.ad}  —  ${parseFloat(h.ucret).toLocaleString('tr-TR')} TL  (${h.sure} ${(APP_LANGS[currentLang]||APP_LANGS['tr']).kartDk})`;
                opt.dataset.json = JSON.stringify(h);
                hSel.appendChild(opt);
            });
        } else {
            hSel.innerHTML = '<option value="">Bu işletmede henüz hizmet yok</option>';
        }
    } catch {
        hSel.innerHTML = '<option value="">Yüklenemedi</option>';
    }

    // Önceden seçilecek hizmet varsa seç
    if (preselectedHizmetId) {
        hSel.value = preselectedHizmetId;
        await onHizmetSecildi();
    }
}

// ─────────────────────────────────────────────────────
// ADIM 2 — Hizmet seçildi
// ─────────────────────────────────────────────────────
async function onHizmetSecildi() {
    const sel = document.getElementById('rHizmet');
    const opt = sel.options[sel.selectedIndex];

    // Sıfırla alt adımları
    RF.hizmet     = null;
    RF.calisan_id = null;
    RF.calisan_adi= '';
    RF.tarih      = '';
    RF.saat       = '';

    ['rHizmetBilgi','rCalisanRow','rTarihRow','rSaatRow','rOzet'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) { el.classList.add('d-none'); el.style.display=''; }
    });
    document.getElementById('rSubmitBtn').classList.add('d-none');
    document.getElementById('rSaat').value = '';
    const slots = document.getElementById('rSaatSlots');
    if (slots) slots.innerHTML = '';

    if (!opt || !opt.dataset.json) return;

    RF.hizmet      = JSON.parse(opt.dataset.json);
    rSelectedHizmet = RF.hizmet;

    // Hizmet bilgi bandı
    const bilgi = document.getElementById('rHizmetBilgi');
    bilgi.innerHTML = `
        <div class="info-row">
            <span><strong>${(currentLang==='en' && RF.hizmet.ad_en) ? RF.hizmet.ad_en : RF.hizmet.ad}</strong></span>
            <span class="badge badge-${RF.hizmet.kategori==='berber'?'berber':'epilasyon'}">${RF.hizmet.kategori}</span>
        </div>
        <div class="info-row">
            <span><i class="far fa-clock" style="margin-right:5px"></i>${RF.hizmet.sure} dakika</span>
            <strong style="color:var(--primary)">${parseFloat(RF.hizmet.ucret).toLocaleString('tr-TR')} TL</strong>
        </div>`;
    bilgi.classList.remove('d-none'); bilgi.style.display = '';

    // Çalışanları yükle (hizmet kategorisine göre filtrele)
    const cSel = document.getElementById('rCalisan');
    cSel.innerHTML = '<option value="">Yükleniyor...</option>';
    document.getElementById('rCalisanRow').classList.remove('d-none');

    try {
        const kategori = RF.hizmet.kategori;
        const res  = await fetch(`/api/public/calisanlar?isletme_id=${RF.isletme_id}&uzmanlik=${kategori}`);
        const data = await res.json();
        cSel.innerHTML = '<option value="">-- Uzman seçiniz --</option>';
        if (data.success && data.calisanlar.length) {
            // "Fark etmez / İlk müsait" seçeneği
            const anyOpt = document.createElement('option');
            anyOpt.value = '0';
            anyOpt.textContent = '🔄 Herhangi bir uzman (ilk müsait)';
            cSel.appendChild(anyOpt);

            data.calisanlar.forEach(c => {
                const opt     = document.createElement('option');
                opt.value     = c.id;
                opt.textContent = `${c.ad}`;
                cSel.appendChild(opt);
            });
        } else {
            const anyOpt = document.createElement('option');
            anyOpt.value = '0';
            anyOpt.textContent = '🔄 Herhangi bir uzman';
            cSel.appendChild(anyOpt);
        }
    } catch {
        cSel.innerHTML = '<option value="">Yüklenemedi</option>';
    }
}

// ─────────────────────────────────────────────────────
// ADIM 3 — Çalışan seçildi
// ─────────────────────────────────────────────────────
function onCalisanSecildi() {
    const cSel = document.getElementById('rCalisan');
    RF.calisan_id  = cSel.value || null;
    RF.calisan_adi = cSel.options[cSel.selectedIndex]?.text || '';

    // Tarih satırını aç
    document.getElementById('rTarihRow').classList.remove('d-none');

    // Sıfırla tarih/saat
    document.getElementById('rTarih').value = '';
    document.getElementById('rSaat').value  = '';
    const slots = document.getElementById('rSaatSlots');
    if (slots) slots.innerHTML = '';
    const srEl = document.getElementById('rSaatRow'); if(srEl){srEl.classList.add('d-none');srEl.style.display='';}
    const ozEl = document.getElementById('rOzet'); if(ozEl){ozEl.classList.add('d-none');ozEl.style.display='';}  
    document.getElementById('rSubmitBtn').classList.add('d-none');
}

// ─────────────────────────────────────────────────────
// ADIM 4 — Tarih seçildi → müsait saatler
// ─────────────────────────────────────────────────────
async function onTarihSecildi() {
    const tarih    = document.getElementById('rTarih').value;
    if (!tarih) return;
    RF.tarih = tarih;
    RF.saat  = '';

    document.getElementById('rSaat').value  = '';
    const _rOz = document.getElementById('rOzet'); if(_rOz){_rOz.classList.add('d-none');_rOz.style.display='';}
    document.getElementById('rSubmitBtn').classList.add('d-none');

    const slotsDiv = document.getElementById('rSaatSlots');
    slotsDiv.innerHTML = '<div class="spinner" style="margin:10px auto;width:22px;height:22px"></div>';
    document.getElementById('rSaatRow').classList.remove('d-none');

    try {
        let url = `/api/musait-saatler?tarih=${tarih}&isletme_id=${RF.isletme_id}`;
        if (RF.calisan_id && RF.calisan_id !== '0') url += `&calisan_id=${RF.calisan_id}`;
        if (RF.hizmet)                              url += `&hizmet_id=${RF.hizmet.id}`;

        const res  = await fetch(url);
        const data = await res.json();

        if (data.success && (data.tum_saatler || data.musait_saatler).length > 0) {
            const info = data.acilis
                ? `<small style="color:#64748b;display:block;margin-bottom:8px">
                       ⏰ Çalışma saatleri: ${data.acilis} – ${data.kapanis}
                   </small>` : '';

            const saatler = data.tum_saatler || data.musait_saatler.map(s => ({saat: s, dolu: false}));
            slotsDiv.innerHTML = info + saatler.map(item => {
                if (item.dolu) {
                    return `<button type="button" class="saat-slot saat-dolu" disabled title="Bu saat dolu">${item.saat}</button>`;
                }
                return `<button type="button" class="saat-slot" onclick="selectSaat('${item.saat}',this)">${item.saat}</button>`;
            }).join('');
        } else if (data.success && data.tum_saatler && data.tum_saatler.length > 0) {
            // Tüm saatler dolu ama varlar
            const info = data.acilis
                ? `<small style="color:#64748b;display:block;margin-bottom:8px">
                       ⏰ Çalışma saatleri: ${data.acilis} – ${data.kapanis}
                   </small>` : '';
            slotsDiv.innerHTML = info + data.tum_saatler.map(item =>
                `<button type="button" class="saat-slot saat-dolu" disabled title="Bu saat dolu">${item.saat}</button>`
            ).join('') + `<p style="color:var(--red);font-size:12px;margin-top:8px">
                <i class="fas fa-times-circle"></i> Bu tarihte tüm saatler doludur</p>`;
        } else {
            const msg = data.mesaj || 'Bu tarihte müsait saat yok';
            slotsDiv.innerHTML = `<p style="color:var(--red);font-size:13px;padding:8px 0">
                <i class="fas fa-times-circle" style="margin-right:5px"></i>${msg}</p>`;
        }
    } catch {
        slotsDiv.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Saatler yüklenemedi</p>';
    }
}

// ─────────────────────────────────────────────────────
// ADIM 5 — Saat seçildi
// ─────────────────────────────────────────────────────
function selectSaat(saat, btn) {
    document.querySelectorAll('.saat-slot').forEach(s => s.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.getElementById('rSaat').value = saat;
    RF.saat = saat;
    updateOzet();
    document.getElementById('rSubmitBtn').classList.remove('d-none');
}

// ─────────────────────────────────────────────────────
// ÖZET KUTUSU
// ─────────────────────────────────────────────────────
function updateOzet() {
    if (!RF.hizmet || !RF.tarih || !RF.saat) return;

    const ozetDiv = document.getElementById('rOzet');
    ozetDiv.innerHTML = `
        <div class="ozet-box">
            <h4><i class="fas fa-clipboard-list"></i> Randevu Özeti</h4>
            <div class="ozet-row">
                <span>İşletme</span>
                <span>${RF.isletme_obj ? RF.isletme_obj.ad : '-'}</span>
            </div>
            <div class="ozet-row">
                <span>Hizmet</span>
                <span>${RF.hizmet.ad}</span>
            </div>
            <div class="ozet-row">
                <span>Uzman</span>
                <span>${!RF.calisan_id||RF.calisan_id==='0' ? '🔄 İlk müsait uzman' : RF.calisan_adi}</span>
            </div>
            <div class="ozet-row">
                <span>Tarih &amp; Saat</span>
                <span><strong>${RF.tarih} — ${RF.saat}</strong></span>
            </div>
            <div class="ozet-row">
                <span>Süre</span>
                <span>${RF.hizmet.sure} dakika</span>
            </div>
            <div class="ozet-row" style="border-bottom:none;padding-bottom:0">
                <span>Ücret</span>
                <strong style="color:var(--primary);font-size:16px">
                    ${parseFloat(RF.hizmet.ucret).toLocaleString('tr-TR')} TL
                </strong>
            </div>
        </div>`;
    ozetDiv.style.display = 'block';
}

// ─────────────────────────────────────────────────────
// RANDEVU GÖNDER
// ─────────────────────────────────────────────────────
async function submitAppointment() {
    if (!currentUser) {
        showToast('Randevu almak için giriş yapın!','error');
        openModal('login'); return;
    }

    const musteriAd  = (document.getElementById('rMusteriAd')?.value||'').trim();
    const musteriTel = (document.getElementById('rMusteriTelefon')?.value||'').trim();
    const notlar     = (document.getElementById('rNotlar')?.value||'').trim();

    if (!musteriAd)   { showToast('Ad Soyad girin!','error'); return; }
    if (!musteriTel)  { showToast('Telefon numarası girin!','error'); return; }
    if (!RF.isletme_id){ showToast('İşletme seçilmedi!','error'); return; }
    if (!RF.hizmet)   { showToast('Hizmet seçin!','error'); return; }
    if (!RF.tarih)    { showToast('Tarih seçin!','error'); return; }
    if (!RF.saat)     { showToast('Saat seçin!','error'); return; }

    const formData = {
        musteri_adi    : musteriAd,
        musteri_telefon: musteriTel,
        isletme_id     : RF.isletme_id,
        hizmet_id      : RF.hizmet.id,
        calisan_id     : (RF.calisan_id && RF.calisan_id !== '0') ? RF.calisan_id : null,
        tarih          : RF.tarih,
        saat           : RF.saat,
        notlar         : notlar
    };

    const btn = document.getElementById('rSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 4px 0 0"></div> Oluşturuluyor...';

    try {
        const res  = await fetch('/api/randevu-al', {
            method : 'POST',
            headers: {'Content-Type':'application/json'},
            body   : JSON.stringify(formData)
        });
        const data = await res.json();
        if (res.ok) {
            showToast('✅ ' + data.message, 'success');
            closeModal();
            resetRandevuForm();
        } else {
            showToast(data.message, 'error');
        }
    } catch {
        showToast('Sunucu hatası!','error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Randevuyu Onayla';
    }
}

// =====================================================
// RANDEVULARIM
// =====================================================
async function showRandevularim() {
    const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('randevularimModal'));
    m.show();
    document.getElementById('randevularimList').innerHTML =
        '<div class="loading-state"><div class="spinner"></div><p>Yükleniyor...</p></div>';
    try {
        const res  = await fetch('/api/randevularim');
        const data = await res.json();
        if (data.success) {
            renderRandevularim(data.randevular);
        } else if (data.message === 'giris_gerekli') {
            document.getElementById('randevularimList').innerHTML = `
                <div style="text-align:center;padding:24px">
                    <i class="fas fa-phone-alt" style="font-size:2.5rem;color:#1b4a6b;margin-bottom:14px;display:block"></i>
                    <p style="margin-bottom:16px;color:#475569;font-size:15px">
                        Randevularınızı görmek için randevu sırasında kullandığınız
                        <strong>telefon numaranızı</strong> girin.
                    </p>
                    <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
                        <input type="tel" id="randevuTelInput" placeholder="05XX XXX XX XX"
                            style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;
                                   font-size:14px;font-family:inherit"
                            onkeydown="if(event.key==='Enter') sorgulaRandevuTel()">
                        <button onclick="sorgulaRandevuTel()"
                            style="padding:10px 18px;background:linear-gradient(135deg,#0f2b3d,#1b4a6b);
                                   color:#fff;border:none;border-radius:10px;cursor:pointer;
                                   font-weight:600;font-family:inherit">
                            Sorgula
                        </button>
                    </div>
                    <p style="margin-top:12px;font-size:12px;color:#94a3b8">
                        Ya da <a href="#"
                            onclick="closeRandevularimModal();openModal('login')"
                            style="color:#1b4a6b;font-weight:600">giriş yapın</a>
                        tüm randevularınızı görün.
                    </p>
                </div>`;
        } else {
            document.getElementById('randevularimList').innerHTML =
                `<div class="empty-state"><i class="fas fa-exclamation-circle"></i>
                 <p>${data.message}</p></div>`;
        }
    } catch {
        document.getElementById('randevularimList').innerHTML =
            '<div class="empty-state"><i class="fas fa-wifi"></i><p>Bağlantı hatası!</p></div>';
    }
}

async function sorgulaRandevuTel() {
    const tel = document.getElementById('randevuTelInput')?.value?.trim();
    if (!tel) { showToast('Telefon numarası girin!','error'); return; }
    document.getElementById('randevularimList').innerHTML =
        '<div class="loading-state"><div class="spinner"></div><p>Aranıyor...</p></div>';
    try {
        const res  = await fetch(`/api/randevularim?telefon=${encodeURIComponent(tel)}`);
        const data = await res.json();
        if (data.success) renderRandevularim(data.randevular);
        else document.getElementById('randevularimList').innerHTML =
            `<div class="empty-state"><i class="fas fa-exclamation-circle"></i>
             <p>${data.message}</p></div>`;
    } catch { showToast('Bağlantı hatası!','error'); }
}

function renderRandevularim(list) {
    const el = document.getElementById('randevularimList');
    const d = APP_LANGS[currentLang] || APP_LANGS['tr'];
    if (!list.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i>' +
            '<h3>' + d.randevuYok + '</h3><p>' + d.randevuYokAcik + '</p></div>';
        return;
    }
    const durumBadge = {
        bekliyor  : '<span class="badge badge-warning">'  + d.rdvBekliyor   + '</span>',
        onaylandi : '<span class="badge badge-success">'  + d.rdvOnaylandi  + '</span>',
        tamamlandi: '<span class="badge badge-primary">'  + d.rdvTamamlandi + '</span>',
        iptal     : '<span class="badge badge-danger">'   + d.rdvIptal      + '</span>'
    };
    el.innerHTML = `<div class="randevu-list">${list.map(r => `
        <div class="randevu-item st-${r.durum}">
            <div class="ri-header">
                <span class="ri-date"><i class="far fa-calendar-alt"></i>${r.tarih} — ${r.saat}</span>
                ${durumBadge[r.durum] || r.durum}
            </div>
            <div class="ri-body">
                ${r.isletme_adi ? `<p><i class="fas fa-store"></i><strong>${d.rdvIsletme}:</strong>&nbsp;${r.isletme_adi}</p>` : ''}
                ${r.hizmet_adi  ? `<p><i class="fas fa-cut"></i><strong>${d.rdvHizmet}:</strong>&nbsp;${r.hizmet_adi}${r.ucret?' — '+parseFloat(r.ucret).toLocaleString('tr-TR')+' TL':''}</p>` : ''}
                ${r.calisan_adi ? `<p><i class="fas fa-user-tie"></i><strong>${d.rdvUzman}:</strong>&nbsp;${r.calisan_adi}</p>` : ''}
                ${r.notlar      ? `<p><i class="fas fa-sticky-note"></i><strong>${d.rdvNot}:</strong>&nbsp;${r.notlar}</p>` : ''}
            </div>
            ${r.durum === 'bekliyor' ? `
            <div class="ri-footer">
                <button class="btn btn-danger btn-sm" onclick="iptalEt(${r.id})">
                    <i class="fas fa-times"></i> ${d.rdvIptalEt}
                </button>
            </div>` : ''}
        </div>`).join('')}</div>`;
}

async function iptalEt(id) {
    if (!confirm('Randevuyu iptal etmek istediğinize emin misiniz?')) return;
    try {
        const res  = await fetch(`/api/randevu-iptal/${id}`,{method:'POST'});
        const data = await res.json();
        showToast(data.message, res.ok?'success':'error');
        if (res.ok) showRandevularim();
    } catch { showToast('Hata!','error'); }
}

// =====================================================
// TOAST
// =====================================================
function showToast(msg, type='success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const colors = {success:'bg-success', error:'bg-danger', warning:'bg-warning text-dark'};
    const icons  = {success:'fa-check-circle', error:'fa-exclamation-circle', warning:'fa-exclamation-triangle'};
    const id = 'toast_' + Date.now();
    const html = `<div id="${id}" class="toast align-items-center text-white ${colors[type]||colors.success} border-0" role="alert">
        <div class="d-flex">
            <div class="toast-body fw-semibold"><i class="fas ${icons[type]||icons.success} me-2"></i>${msg}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    </div>`;
    container.insertAdjacentHTML('beforeend', html);
    const t = new bootstrap.Toast(document.getElementById(id), {delay:3500});
    t.show();
    document.getElementById(id).addEventListener('hidden.bs.toast', () => document.getElementById(id)?.remove());
}

// =====================================================
// SIDEBAR
// =====================================================
function openSidebar() {
    document.getElementById('appSidebar').style.transform = 'translateX(0)';
    document.getElementById('sidebarOverlay').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('appSidebar').style.transform = 'translateX(-100%)';
    document.getElementById('sidebarOverlay').style.display = 'none';
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

// =====================================================
// ARAMA
// =====================================================
function aramaYap(e) {
    e.preventDefault();
    const q = (document.getElementById('navArama')?.value || '').trim().toLowerCase();
    if (!q) return;

    // İşletme ve hizmet filtrele
    const isletmeSonuclari = allIsletmeler.filter(i =>
        i.ad.toLowerCase().includes(q) ||
        (i.aciklama||'').toLowerCase().includes(q) ||
        (i.adres||'').toLowerCase().includes(q)
    );
    const hizmetSonuclari = allHizmetler.filter(h =>
        h.ad.toLowerCase().includes(q) ||
        (h.isletme_adi||'').toLowerCase().includes(q)
    );

    // Sonuçları göster
    renderIsletmeler(isletmeSonuclari);
    renderHizmetler(hizmetSonuclari);

    // Alt arama kutularını da doldur
    const ia = document.getElementById('isletmeArama');
    if (ia) { ia.value = document.getElementById('navArama').value; }
    const ha = document.getElementById('hizmetArama');
    if (ha) { ha.value = document.getElementById('navArama').value; }

    // Sonuçlara göre doğru bölüme scroll
    if (isletmeSonuclari.length > 0) {
        document.getElementById('isletmeler')?.scrollIntoView({behavior:'smooth', block:'start'});
    } else if (hizmetSonuclari.length > 0) {
        document.getElementById('hizmetler')?.scrollIntoView({behavior:'smooth', block:'start'});
    }

    // Sonuç özeti toast
    const toplam = isletmeSonuclari.length + hizmetSonuclari.length;
    if (toplam === 0) {
        showToast(`"${q}" için sonuç bulunamadı`, 'warning');
    } else {
        const msg = [];
        if (isletmeSonuclari.length) msg.push(isletmeSonuclari.length + ' işletme');
        if (hizmetSonuclari.length)  msg.push(hizmetSonuclari.length  + ' hizmet');
        showToast('🔍 ' + msg.join(', ') + ' bulundu', 'success');
    }
}

function araIsletme(q) {
    q = q.toLowerCase();
    renderIsletmeler(q ? allIsletmeler.filter(i =>
        i.ad.toLowerCase().includes(q) || (i.adres||'').toLowerCase().includes(q)
    ) : allIsletmeler);
}

function araHizmet(q) {
    q = q.toLowerCase();
    renderHizmetler(q ? allHizmetler.filter(h => h.ad.toLowerCase().includes(q)) : allHizmetler);
}

// =====================================================
// PROFİL & AYARLAR
// =====================================================
function showProfil() {
    if (!currentUser) { openModal('login'); return; }
    // Bilgileri doldur
    const ad = currentUser.ad || '—';
    document.getElementById('profilAd').textContent = ad;
    document.getElementById('profilEmail').textContent = currentUser.email || '—';
    document.getElementById('profilAvatar').textContent = (ad[0]||'U').toUpperCase();
    // Form alanları
    const adInp = document.getElementById('profilAdInput');
    const emInp = document.getElementById('profilEmailInput');
    const siInp = document.getElementById('profilSifreInput');
    if (adInp) adInp.value = currentUser.ad || '';
    if (emInp) emInp.value = currentUser.email || '';
    if (siInp) siInp.value = '';
    // Randevu sayısı
    fetch('/api/randevularim').then(r=>r.json()).then(d => {
        if (d.success) {
            document.getElementById('profilRandevuSayi').textContent = d.randevular.length;
            document.getElementById('profilOnaylananSayi').textContent =
                d.randevular.filter(r=>r.durum==='onaylandi').length;
        }
    }).catch(()=>{});
    bootstrap.Modal.getOrCreateInstance(document.getElementById('profilModal')).show();
}

async function profilGuncelle() {
    const ad    = (document.getElementById('profilAdInput')?.value||'').trim();
    const email = (document.getElementById('profilEmailInput')?.value||'').trim();
    const sifre = (document.getElementById('profilSifreInput')?.value||'').trim();
    if (!ad || !email) { showToast('Ad ve e-posta zorunludur!', 'error'); return; }
    if (sifre && sifre.length < 6) { showToast('Şifre en az 6 karakter!', 'error'); return; }
    const payload = { ad, email };
    if (sifre) payload.sifre = sifre;
    try {
        const r = await fetch('/api/kullanici-guncelle', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (d.success) {
            currentUser.ad    = ad;
            currentUser.email = email;
            // Navbar ve sidebar güncelle
            const un = document.getElementById('userName');
            if (un) un.textContent = ad.split(' ')[0];
            const sbName = document.getElementById('sbUserName');
            if (sbName) sbName.textContent = ad;
            const sbAv = document.getElementById('sbUserAvatar');
            if (sbAv) sbAv.textContent = (ad[0]||'U').toUpperCase();
            // Modal güncelle
            document.getElementById('profilAd').textContent = ad;
            document.getElementById('profilEmail').textContent = email;
            document.getElementById('profilAvatar').textContent = (ad[0]||'U').toUpperCase();
            if (sifre) document.getElementById('profilSifreInput').value = '';
            showToast('Profil güncellendi! ✅', 'success');
        } else {
            showToast(d.message || 'Güncelleme başarısız!', 'error');
        }
    } catch { showToast('Sunucu hatası!', 'error'); }
}

async function profilGuncelle() {
    const ad    = (document.getElementById('profilAdInput')?.value||'').trim();
    const email = (document.getElementById('profilEmailInput')?.value||'').trim();
    const sifre = (document.getElementById('profilSifreInput')?.value||'').trim();
    if (!ad || !email) { showToast('Ad ve e-posta zorunludur!', 'error'); return; }
    if (sifre && sifre.length < 6) { showToast('Şifre en az 6 karakter!', 'error'); return; }
    const payload = { ad, email };
    if (sifre) payload.sifre = sifre;

    // Butonu loading yap
    const btn = document.querySelector('#profilModal button[onclick="profilGuncelle()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Güncelleniyor...'; }

    try {
        const r = await fetch('/api/kullanici-guncelle', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        const d = await r.json();
        if (d.success) {
            currentUser.ad    = ad;
            currentUser.email = email;
            // Navbar ve sidebar güncelle
            const un = document.getElementById('userName');
            if (un) un.textContent = ad.split(' ')[0];
            const sbName = document.getElementById('sbUserName');
            if (sbName) sbName.textContent = ad;
            const sbAv = document.getElementById('sbUserAvatar');
            if (sbAv) sbAv.textContent = (ad[0]||'U').toUpperCase();
            // Modal içindeki bilgileri güncelle
            document.getElementById('profilAd').textContent = ad;
            document.getElementById('profilEmail').textContent = email;
            document.getElementById('profilAvatar').textContent = (ad[0]||'U').toUpperCase();
            if (sifre) document.getElementById('profilSifreInput').value = '';
            // Modal içinde başarı mesajı göster
            const msgEl = document.getElementById('profilGuncelMsg');
            if (msgEl) {
                msgEl.style.display = 'flex';
                setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
            }
            showToast('Profil güncellendi! ✅', 'success');
        } else {
            showToast(d.message || 'Güncelleme başarısız!', 'error');
        }
    } catch { showToast('Sunucu hatası!', 'error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save me-2"></i>Güncelle'; }
    }
}

function showAyarlar() {
    const theme = localStorage.getItem('theme') || 'light';
    const lang  = localStorage.getItem('lang')  || 'tr';
    ['light','dark','system'].forEach(t => {
        const el = document.getElementById('theme'+t.charAt(0).toUpperCase()+t.slice(1));
        if (el) el.classList.toggle('active', t === theme);
    });
    const trBtn = document.getElementById('langTR');
    const enBtn = document.getElementById('langEN');
    if (trBtn) trBtn.classList.toggle('active', lang === 'tr');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ayarlarModal')).show();
}

function setTheme(t) {
    localStorage.setItem('theme', t);
    applyTheme(t);
    ['light','dark','system'].forEach(s => {
        const el = document.getElementById('theme'+s.charAt(0).toUpperCase()+s.slice(1));
        if (el) el.classList.toggle('active', s === t);
    });
    // Dark temada hizmetler section background güncelle
    const hizSec = document.querySelector('[data-section="hizmetler"]');
    if (hizSec) {
        const actual = t === 'system' ? (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark':'light') : t;
        hizSec.style.background = actual === 'dark' ? '#0f172a' : '#f1f5f9';
    }
}

function applyTheme(t) {
    const html = document.documentElement;
    let actual = t;
    if (t === 'system') actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    html.setAttribute('data-bs-theme', actual);
    // Body ve section arka planı
    document.body.style.background = actual === 'dark' ? '#0f172a' : '';
    const hizSec = document.querySelector('[data-section="hizmetler"]');
    if (hizSec) hizSec.style.background = actual === 'dark' ? '#0f172a' : '#f1f5f9';
}

// =====================================================
// DİL SİSTEMİ
// =====================================================

const APP_LANGS = {
  tr: {
    navIsletmeler: 'İşletmeler', navHizmetler: 'Hizmetler',
    navGiris: 'Giriş', navKayit: 'Kayıt', navRandevuAl: 'Randevu Al',
    heroBadge: '⭐ Profesyonel Hizmet', heroH1: 'Randevunuzu', heroH1Span: 'Kolayca Alın',
    heroP: 'Berber ve epilasyon merkezlerinde uzman kadromuzla en uygun zamanda randevu alın.',
    heroBtn1: 'Hemen Randevu Al', heroBtn2: 'İşletmeleri Gör',
    heroLbl1: 'İşletme', heroLbl2: 'Hizmet', heroLbl3: 'Uzman',
    secIsletmeler: 'İşletmeler', secIsletmelerH2a: 'Hizmet Veren', secIsletmelerH2b: 'Merkezlerimiz',
    secIsletmelerP: 'Seçtiğiniz işletmede uygun saatte randevu alın',
    secHizmetler: 'Hizmetler', secHizmetlerH2a: 'Sunulan', secHizmetlerH2b: 'Hizmetler',
    secHizmetlerP: 'Tüm merkezlerdeki güncel fiyat ve süre bilgileri',
    filterTumu: 'Tümü', filterBerber: '✂️ Berber', filterEpilasyon: '✨ Epilasyon',
    aramaPlaceholder: 'İşletme veya hizmet ara...',
    isletmeAramaPlaceholder: 'İşletme ara...', hizmetAramaPlaceholder: 'Hizmet ara...',
    kartRandevuAl: 'Randevu Al', kartDk: 'dk', kartBerber: '✂️ Berber', kartEpilasyon: '✨ Epilasyon',
    sbRandevularim: 'Randevularım', sbProfilim: 'Profilim', sbAyarlar: 'Ayarlar',
    sbCikis: 'Çıkış Yap', sbCikisYap: 'Çıkış Yap', sbRandevuAl: 'Randevu Al', sbUye: 'Üye',
    rdvBaslik: 'Randevu Al', rdvAltBaslik: 'Adımları takip edin',
    girisBaslik: 'Hoş Geldiniz', girisAlt: 'Hesabınıza giriş yapın',
    kayitBaslik: 'Yeni Hesap', kayitAlt: 'Hızlıca kayıt olun',
    sbAdminPanel: 'Yönetici Paneli',
    profilRandevuLbl: 'Randevu', profilOnaylananLbl: 'Onaylanan',
    profilSifreAciklama: '(boş = değişmez)',
    sbGirisYap: 'Giriş Yap', sbKayitOl: 'Kayıt Ol',
    randevuYok: 'Henüz randevunuz yok', randevuYokAcik: 'Henüz randevu almadınız.',
    rdvIsletme: 'İşletme', rdvHizmet: 'Hizmet', rdvUzman: 'Uzman', rdvNot: 'Not',
    rdvIptalEt: 'İptal Et', rdvYukleniyor: 'Yükleniyor...',
    rdvBekliyor: '⏳ Bekliyor', rdvOnaylandi: '✅ Onaylandı',
    rdvTamamlandi: '🎉 Tamamlandı', rdvIptal: '❌ İptal',
    rdvTelGir: 'Randevularınızı görmek için telefon numaranızı girin.',
    rdvSorgula: 'Sorgula', rdvGirisYap: 'giriş yapın', rdvBaslik: 'Randevularım',
    profilimBaslik: 'Bilgilerimi Güncelle', profilAdLabel: 'Ad Soyad',
    profilEmailLabel: 'E-posta', profilSifreLabel: 'Yeni Şifre', profilGuncelleBtn: 'Güncelle',
    ayarlarTema: 'Tema', ayarlarDil: 'Dil / Language',
    temaAcik: 'Açık', temaKoyu: 'Koyu', temaSistem: 'Sistem',
    guncelMsg: '✅ Bilgileriniz güncellendi',
    kartHizmet: 'Hizmet', kartUzman: 'Uzman', kartDetay: 'Detay', kartRdvAl: 'Randevu Al',
    detayHizmetler: 'Hizmetler', detayUzmanlar: 'Uzmanlar',
    detayRandevuAl: 'Bu İşletmede Randevu Al',
    detayHizmetYok: 'Henüz hizmet eklenmemiş.', detayUzmanYok: 'Henüz çalışan eklenmemiş.',
    detayDk: 'dk', detayBerber: 'Berber', detayEpilasyon: 'Epilasyon',
    sonucBulunamadi: 'Sonuç bulunamadı',
  },
  en: {
    navIsletmeler: 'Businesses', navHizmetler: 'Services',
    navGiris: 'Login', navKayit: 'Register', navRandevuAl: 'Book Now',
    heroBadge: '⭐ Professional Service', heroH1: 'Book Your', heroH1Span: 'Appointment',
    heroP: 'Book an appointment with our expert team at barber and epilation centers.',
    heroBtn1: 'Book Now', heroBtn2: 'View Businesses',
    heroLbl1: 'Business', heroLbl2: 'Service', heroLbl3: 'Expert',
    secIsletmeler: 'Businesses', secIsletmelerH2a: 'Our Service', secIsletmelerH2b: 'Centers',
    secIsletmelerP: 'Choose a business and book at the right time',
    secHizmetler: 'Services', secHizmetlerH2a: 'Available', secHizmetlerH2b: 'Services',
    secHizmetlerP: 'Current prices and durations across all centers',
    filterTumu: 'All', filterBerber: '✂️ Barber', filterEpilasyon: '✨ Epilation',
    aramaPlaceholder: 'Search business or service...',
    isletmeAramaPlaceholder: 'Search business...', hizmetAramaPlaceholder: 'Search service...',
    kartRandevuAl: 'Book Now', kartDk: 'min', kartBerber: '✂️ Barber', kartEpilasyon: '✨ Epilation',
    sbRandevularim: 'My Appointments', sbProfilim: 'My Profile', sbAyarlar: 'Settings',
    sbCikis: 'Sign Out', sbCikisYap: 'Sign Out', sbRandevuAl: 'Book Now', sbUye: 'Member',
    sbAdminPanel: 'Admin Panel',
    profilRandevuLbl: 'Appointments', profilOnaylananLbl: 'Approved',
    profilSifreAciklama: '(empty = unchanged)',
    rdvBaslik: 'Book Appointment', rdvAltBaslik: 'Follow the steps',
    girisBaslik: 'Welcome Back', girisAlt: 'Sign in to your account',
    kayitBaslik: 'New Account', kayitAlt: 'Register quickly',
    sbGirisYap: 'Login', sbKayitOl: 'Register',
    randevuYok: 'No appointments yet', randevuYokAcik: 'You have no appointments.',
    rdvIsletme: 'Business', rdvHizmet: 'Service', rdvUzman: 'Staff', rdvNot: 'Note',
    rdvIptalEt: 'Cancel', rdvYukleniyor: 'Loading...',
    rdvBekliyor: '⏳ Pending', rdvOnaylandi: '✅ Approved',
    rdvTamamlandi: '🎉 Completed', rdvIptal: '❌ Cancelled',
    rdvTelGir: 'Enter your phone number to view your appointments.',
    rdvSorgula: 'Search', rdvGirisYap: 'log in', rdvBaslik: 'My Appointments',
    profilimBaslik: 'Update My Info', profilAdLabel: 'Full Name',
    profilEmailLabel: 'Email', profilSifreLabel: 'New Password', profilGuncelleBtn: 'Update',
    ayarlarTema: 'Theme', ayarlarDil: 'Language',
    temaAcik: 'Light', temaKoyu: 'Dark', temaSistem: 'System',
    guncelMsg: '✅ Your information has been updated',
    kartHizmet: 'Service', kartUzman: 'Staff', kartDetay: 'Details', kartRdvAl: 'Book Now',
    detayHizmetler: 'Services', detayUzmanlar: 'Staff',
    detayRandevuAl: 'Book at This Business',
    detayHizmetYok: 'No services added yet.', detayUzmanYok: 'No staff added yet.',
    detayDk: 'min', detayBerber: 'Barber', detayEpilasyon: 'Epilation',
    sonucBulunamadi: 'No results found',
  }
};

let currentLang = localStorage.getItem('lang') || 'tr';

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyLang(lang);
    const trBtn = document.getElementById('langTR');
    const enBtn = document.getElementById('langEN');
    if (trBtn) trBtn.classList.toggle('active', lang === 'tr');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    showToast(lang === 'tr' ? '🇹🇷 Türkçe seçildi' : '🇬🇧 English selected', 'success');
}

function applyLang(lang) {
    const d = APP_LANGS[lang] || APP_LANGS['tr'];

    // ── data-lang attribute'u olan TÜM elementleri güncelle ──
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (d[key] !== undefined) el.textContent = d[key];
    });

    // ── Özel durumlar (data-lang ile çözülemeyen HTML içerikli elementler) ──

    // Navbar linkleri (icon + metin)
    document.querySelectorAll('.navbar-nav .nav-link').forEach(a => {
        if (a.href && a.href.includes('#isletmeler')) a.innerHTML = `<i class="fas fa-store me-1"></i>${d.navIsletmeler}`;
        if (a.href && a.href.includes('#hizmetler'))  a.innerHTML = `<i class="fas fa-list me-1"></i>${d.navHizmetler}`;
    });
    // Navbar giriş/kayıt butonları
    const guestBtns = document.querySelectorAll('#guestMenu button');
    if (guestBtns[0]) guestBtns[0].innerHTML = `<i class="fas fa-sign-in-alt me-1"></i>${d.navGiris}`;
    if (guestBtns[1]) guestBtns[1].innerHTML = `<i class="fas fa-user-plus me-1"></i>${d.navKayit}`;
    // Navbar "Randevu Al" butonu (user menu'de)
    const navRdvBtn = document.querySelector('#userMenu button:last-child');
    if (navRdvBtn) navRdvBtn.innerHTML = `<i class="fas fa-calendar-plus me-1"></i>${d.navRandevuAl}`;

    // Arama placeholder'ları
    const el = id => document.getElementById(id);
    if (el('navArama'))     el('navArama').placeholder     = d.aramaPlaceholder;
    if (el('isletmeArama')) el('isletmeArama').placeholder = d.isletmeAramaPlaceholder;
    if (el('hizmetArama'))  el('hizmetArama').placeholder  = d.hizmetAramaPlaceholder;

    // Hero metinleri (HTML içeriyor)
    const heroBadge = document.querySelector('.hero-badge');
    if (heroBadge) heroBadge.innerHTML = d.heroBadge;
    const heroH1 = document.querySelector('.hero h1');
    if (heroH1) heroH1.innerHTML = `${d.heroH1}<br><span>${d.heroH1Span}</span>`;
    const heroP = document.querySelector('.hero p');
    if (heroP) heroP.textContent = d.heroP;
    const heroBtn1 = document.querySelector('.hero .btn-light');
    if (heroBtn1) heroBtn1.innerHTML = `<i class="fas fa-calendar-plus me-2"></i>${d.heroBtn1}`;
    const heroBtn2 = document.querySelector('.hero .btn-outline-light');
    if (heroBtn2) heroBtn2.innerHTML = `<i class="fas fa-store me-2"></i>${d.heroBtn2}`;

    // Hero stat etiketleri
    const statLbls = document.querySelectorAll('.hero-stat .lbl');
    if (statLbls[0]) statLbls[0].textContent = d.heroLbl1;
    if (statLbls[1]) statLbls[1].textContent = d.heroLbl2;
    if (statLbls[2]) statLbls[2].textContent = d.heroLbl3;

    // Section başlıkları (h2 içinde span var)
    const isletmelerH2 = el('isletmelerH2');
    if (isletmelerH2) isletmelerH2.innerHTML = `${d.secIsletmelerH2a} <span style="color:var(--brand2)">${d.secIsletmelerH2b}</span>`;
    const hizmetlerH2 = el('hizmetlerH2');
    if (hizmetlerH2) hizmetlerH2.innerHTML = `${d.secHizmetlerH2a} <span style="color:var(--brand2)">${d.secHizmetlerH2b}</span>`;

    // Filtre butonları (icon içeriyor)
    const iF = document.querySelectorAll('#isletmeler .filter-btn');
    if (iF[0]) iF[0].innerHTML = `<i class="fas fa-th me-1"></i>${d.filterTumu}`;
    if (iF[1]) iF[1].innerHTML = `<i class="fas fa-cut me-1"></i>${d.filterBerber.replace('✂️ ','')}`;
    if (iF[2]) iF[2].innerHTML = `<i class="fas fa-spa me-1"></i>${d.filterEpilasyon.replace('✨ ','')}`;
    const hF = document.querySelectorAll('#hizmetler .filter-btn');
    if (hF[0]) hF[0].textContent = d.filterTumu;
    if (hF[1]) hF[1].textContent = d.filterBerber;
    if (hF[2]) hF[2].textContent = d.filterEpilasyon;

    // Randevularım modal başlığı
    const rdvTitle = document.querySelector('#randevularimModal .modal-title');
    if (rdvTitle) rdvTitle.innerHTML = `<i class="fas fa-calendar-alt me-2 text-primary"></i>${d.sbRandevularim}`;

    // Hizmet kartlarını yeniden render et
    if (allHizmetler.length) renderHizmetler(allHizmetler);
    if (allIsletmeler.length) renderIsletmeler(allIsletmeler);
}