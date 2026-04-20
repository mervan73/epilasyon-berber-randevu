// =====================================================
// KULLANICI PANELİ JAVASCRIPT  — v3
// =====================================================

let currentUser   = null;
let allIsletmeler = [];
let allHizmetler  = [];
let rSelectedHizmet = null;
let advancedLocationMap = {};
let lastRandevularimList = [];
let appTranslationConfig = null;
const appTranslationCache = {};
let randevuDatePicker = null;

async function loadAppTranslationConfig() {
    if (appTranslationConfig) return appTranslationConfig;
    try {
        const res = await fetch('/api/translation-config', { cache: 'no-store' });
        appTranslationConfig = await res.json();
    } catch (e) {
        appTranslationConfig = { success: false, enabled: false, provider: 'none' };
    }
    return appTranslationConfig;
}

async function translateAppTexts(texts, sourceLang = 'tr', targetLang = 'en') {
    const items = (texts || []).map(t => (t || '').trim()).filter(Boolean);
    if (!items.length || sourceLang === targetLang) return {};

    const cfg = await loadAppTranslationConfig();
    if (!cfg || !cfg.enabled) return {};

    const unique = Array.from(new Set(items));
    const missing = unique.filter(text => !appTranslationCache[`${sourceLang}|${targetLang}|${text}`]);

    if (missing.length) {
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texts: missing,
                    source_lang: sourceLang,
                    target_lang: targetLang,
                    format: 'text'
                })
            });
            const data = await res.json();
            if (data && data.success && Array.isArray(data.translations)) {
                missing.forEach((text, idx) => {
                    appTranslationCache[`${sourceLang}|${targetLang}|${text}`] = data.translations[idx] || text;
                });
            }
        } catch (e) {}
    }

    const out = {};
    unique.forEach(text => {
        out[text] = appTranslationCache[`${sourceLang}|${targetLang}|${text}`] || text;
    });
    return out;
}

async function enrichPublicAppointments(list) {
    if (currentLang !== 'en' || !Array.isArray(list) || !list.length) return list;

    const serviceTexts = list
        .filter(r => r && !(r.hizmet_adi_en || r.hizmet_ad_en || r.hizmet_en) && (r.hizmet_adi || r.hizmet_ad))
        .map(r => r.hizmet_adi || r.hizmet_ad);

    const noteTexts = list
        .filter(r => r && !r.notlar_en && r.notlar)
        .map(r => r.notlar);

    const serviceMap = await translateAppTexts(serviceTexts, 'tr', 'en');
    const noteMap = await translateAppTexts(noteTexts, 'tr', 'en');

    list.forEach(r => {
        const rawService = r.hizmet_adi || r.hizmet_ad || '';
        if (rawService && !r.hizmet_adi_en && serviceMap[rawService]) {
            r.hizmet_adi_en = serviceMap[rawService];
        }
        if (r.notlar && !r.notlar_en && noteMap[r.notlar]) {
            r.notlar_en = noteMap[r.notlar];
        }
    });
    return list;
}

function getTodayIsoDate() {
    return new Date().toISOString().split('T')[0];
}

function setupAppointmentDatePicker(lang) {
    const input = document.getElementById('rTarih');
    if (!input) return;

    const minDate = getTodayIsoDate();
    const placeholder = lang === 'en' ? 'Select date' : 'Tarih seçin';

    if (typeof flatpickr !== 'function') {
        input.type = 'date';
        input.readOnly = false;
        input.placeholder = placeholder;
        input.setAttribute('min', minDate);
        input.setAttribute('lang', lang === 'en' ? 'en' : 'tr');
        return;
    }

    if (randevuDatePicker) {
        randevuDatePicker.destroy();
        randevuDatePicker = null;
    }

    input.type = 'text';
    input.readOnly = true;
    input.placeholder = placeholder;

    randevuDatePicker = flatpickr(input, {
        locale: lang === 'en' ? 'default' : 'tr',
        disableMobile: true,
        allowInput: false,
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: lang === 'en' ? 'F j, Y' : 'd.m.Y',
        minDate: minDate,
        monthSelectorType: 'static',
        onChange: function(selectedDates, dateStr) {
            input.value = dateStr || '';
            onTarihSecildi();
        },
        onReady: function(selectedDates, dateStr, instance) {
            if (instance.altInput) {
                instance.altInput.placeholder = placeholder;
                instance.altInput.setAttribute('aria-label', placeholder);
            }
        }
    });

    if (input.value) {
        randevuDatePicker.setDate(input.value, false, 'Y-m-d');
    }
}

function refreshCurrentUserLabels() {
    if (!currentUser) return;
    const shortName = (currentUser.ad || '').trim().split(' ')[0] || '—';
    const fullName = (currentUser.ad || '').trim() || '—';

    const el = document.getElementById('userName');
    if (el) el.textContent = shortName;

    const elFull = document.getElementById('userNameFull');
    if (elFull) elFull.textContent = fullName;

    const sbName = document.getElementById('sbUserName');
    if (sbName) sbName.textContent = fullName;

    const sbAv = document.getElementById('sbUserAvatar');
    if (sbAv) sbAv.textContent = (fullName[0] || 'U').toUpperCase();
}

function isAppAutoTranslatableText(text) {
    const value = (text || '').trim();
    if (!value || value.length < 2) return false;
    if (/^[\d\s\-–—:/.+₺$€£#()%]+$/.test(value)) return false;
    return true;
}

function collectAppAutoTranslateTargets(root) {
    const scope = root || document.body;
    const textTargets = [];
    const placeholderTargets = [];
    const optionTargets = [];

    scope.querySelectorAll('*').forEach(el => {
        const tag = el.tagName;
        if (!tag) return;
        if (el.hasAttribute('data-lang') || el.hasAttribute('data-no-auto-translate')) return;
        if (el.closest('[data-lang]')) return;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'I', 'SVG', 'PATH'].includes(tag)) return;

        if ((tag === 'INPUT' || tag === 'TEXTAREA') && el.placeholder) {
            if (!el.dataset.trOriginalPlaceholder) el.dataset.trOriginalPlaceholder = el.placeholder;
            if (isAppAutoTranslatableText(el.dataset.trOriginalPlaceholder)) {
                placeholderTargets.push({ el, text: el.dataset.trOriginalPlaceholder });
            }
        }

        if (tag === 'OPTION') {
            if (!el.dataset.trOriginalText) el.dataset.trOriginalText = el.textContent.trim();
            if (isAppAutoTranslatableText(el.dataset.trOriginalText)) {
                optionTargets.push({ el, text: el.dataset.trOriginalText });
            }
            return;
        }

        const hasElementChildren = Array.from(el.childNodes).some(n => n.nodeType === 1);
        if (hasElementChildren) return;

        const text = (el.textContent || '').trim();
        if (!isAppAutoTranslatableText(text)) return;
        if (!el.dataset.trOriginalText) el.dataset.trOriginalText = text;
        textTargets.push({ el, text: el.dataset.trOriginalText });
    });

    return { textTargets, placeholderTargets, optionTargets };
}

async function autoTranslateAppDom(root) {
    const scope = root || document.body;
    const { textTargets, placeholderTargets, optionTargets } = collectAppAutoTranslateTargets(scope);

    if (currentLang === 'tr') {
        textTargets.forEach(item => { item.el.textContent = item.el.dataset.trOriginalText || item.text; });
        placeholderTargets.forEach(item => { item.el.placeholder = item.el.dataset.trOriginalPlaceholder || item.text; });
        optionTargets.forEach(item => { item.el.textContent = item.el.dataset.trOriginalText || item.text; });
        return;
    }

    if (currentLang !== 'en') return;

    const textMap = await translateAppTexts(textTargets.map(item => item.text), 'tr', 'en');
    const placeholderMap = await translateAppTexts(placeholderTargets.map(item => item.text), 'tr', 'en');
    const optionMap = await translateAppTexts(optionTargets.map(item => item.text), 'tr', 'en');

    textTargets.forEach(item => {
        item.el.textContent = textMap[item.text] || item.text;
    });
    placeholderTargets.forEach(item => {
        item.el.placeholder = placeholderMap[item.text] || item.text;
    });
    optionTargets.forEach(item => {
        item.el.textContent = optionMap[item.text] || item.text;
    });
}

const MOJIBAKE_FIXES = [
    ['Ã¼', 'ü'], ['Ãœ', 'Ü'], ['Ä±', 'ı'], ['Ä°', 'İ'],
    ['ÅŸ', 'ş'], ['Åž', 'Ş'], ['Ã§', 'ç'], ['Ã‡', 'Ç'],
    ['Ã¶', 'ö'], ['Ã–', 'Ö'], ['ÄŸ', 'ğ'], ['Äž', 'Ğ'],
    ['â‚º', '₺'], ['â€¢', '•'], ['â€“', '–'], ['â€”', '—'],
    ['âœ…', '✅'], ['âœ¨', '✨'], ['âœ‚ï¸', '✂️'], ['Â', '']
];

function fixText(v) {
    if (v === null || v === undefined) return '';
    let t = String(v);
    for (const [bad, good] of MOJIBAKE_FIXES) t = t.split(bad).join(good);
    return t;
}

function repairMojibakeInDOM() {
    document.querySelectorAll('body *').forEach(el => {
        el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && /[ÃÅÄâ]/.test(node.textContent || '')) {
                node.textContent = fixText(node.textContent);
            }
        });
        ['placeholder', 'title', 'aria-label'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && /[ÃÅÄâ]/.test(val)) el.setAttribute(attr, fixText(val));
        });
    });
}

// =====================================================
// BAÅLAT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    applyTheme('light');
    const savedLang = localStorage.getItem('lang') || 'tr';
    currentLang = savedLang;
    applyLang(savedLang);  // Her zaman uygula (TR dahil)
    repairMojibakeInDOM();
    checkSession();
    loadPublicIsletmeler();
    loadPublicHizmetler();

    const tarihInput = document.getElementById('rTarih');
    if (tarihInput) {
        tarihInput.setAttribute('lang', savedLang === 'en' ? 'en' : 'tr');
    }
    setupAppointmentDatePicker(savedLang);

    setupRandevuServiceSelect();
    setupRandevuStaffSelect();
    setupNavSearchAutoReset();
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
    refreshCurrentUserLabels();
    const rAd = document.getElementById('rMusteriAd');
    if (rAd) rAd.value = user.ad || '';
    // Sidebar kullanıcı bilgisi
    const sbInfo = document.getElementById('sbUserInfo');
    if (sbInfo) sbInfo.style.display = 'block';
    const sbLogged = document.getElementById('sbLoggedMenu');
    if (sbLogged) sbLogged.style.display = 'block';
    const sbGuest = document.getElementById('sbGuestMenu');
    if (sbGuest) sbGuest.style.display = 'none';
    applyTheme(localStorage.getItem('theme') || 'light');
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
    applyTheme('light');
}

// =====================================================
// PUBLIC VERİ YÃƒÅ“KLEME
// =====================================================
async function loadPublicIsletmeler() {
    const grid = document.getElementById('isletmelerGrid');
    if (!grid) return;
    try {
        const res  = await fetch('/api/public/isletmeler');
        const data = await res.json();
        if (data.success && data.isletmeler.length > 0) {
            allIsletmeler = data.isletmeler.map((isletme) => {
                // Backend aggregate count döndürüyor; ek N+1 istek atmayalım.
                isletme._hizmetSayisi = parseInt(isletme._hizmetSayisi || 0, 10);
                isletme._calisanSayisi = parseInt(isletme._calisanSayisi || 0, 10);
                return isletme;
            });
            renderIsletmeler(allIsletmeler);
            updateHeroStats();
            populateNavIsletmeFilter();
            populateNavHizmetFilter();
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
          <div class="isletme-card h-100 d-flex flex-column" data-tur="${i.tur}" data-isletme-id="${i.id}">
            <div class="card-header-strip ${i.tur}"></div>
            <div class="p-3 flex-grow-1 d-flex flex-column">
              <div class="d-flex align-items-center gap-2 mb-2">
                <div class="card-icon ${i.tur}">
                  <i class="fas ${i.tur==='berber'?'fa-cut':'fa-spa'}"></i>
                </div>
                <div>
                  <h5 class="mb-0 fw-bold">${fixText(i.ad)}</h5>
                  <span class="badge-tur ${i.tur}">${i.tur==='berber'?ld.detayBerber:ld.detayEpilasyon}</span>
                </div>
              </div>
              ${i.aciklama?`<p class="small text-muted mb-2">${fixText(i.aciklama.substring(0,80))}${i.aciklama.length>80?'...':''}</p>`:''}
              <div class="small text-muted mb-2">
                ${i.adres?`<div><i class="fas fa-map-marker-alt me-1"></i>${fixText(i.adres)}</div>`:''}
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
                <button class="btn btn-outline-secondary btn-sm flex-fill" onclick="openBusinessMap(${i.id})">
                  <i class="fas fa-map-marker-alt"></i> ${ld.kartHaritadaGoster}
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
            populateNavHizmetFilter();
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
          <div class="hizmet-card h-100 d-flex flex-column" data-kategori="${h.kategori}" data-hizmet-id="${h.id}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="card-icon ${h.kategori}" style="width:44px;height:44px;font-size:18px">
                <i class="fas ${h.kategori==='berber'?'fa-cut':'fa-spa'}"></i>
              </div>
              <span class="fw-bold fs-5" style="color:var(--brand2)">${parseFloat(h.ucret).toLocaleString('tr-TR')} <small class="fs-6">₺</small></span>
            </div>
            <div class="fw-bold mb-1">${fixText((currentLang==='en' && h.ad_en) ? h.ad_en : h.ad)}</div>
            <div class="small text-muted mb-2"><i class="fas fa-store me-1"></i>${isletme ? fixText(isletme.ad) : ''}</div>
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

function getBusinessMapUrl(isletme) {
    if (!isletme) return '';
    if (isletme.latitude && isletme.longitude) {
        return `https://www.google.com/maps?q=${encodeURIComponent(`${isletme.latitude},${isletme.longitude}`)}`;
    }
    const query = [isletme.adres, isletme.ad].filter(Boolean).join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
}

function openBusinessMap(isletmeId) {
    const isletme = allIsletmeler.find(i => i.id === isletmeId);
    const url = getBusinessMapUrl(isletme);
    if (!url) {
        showToast(L('toastLocationMissing', 'Konum bilgisi bulunamadı'), 'warning');
        return;
    }
    window.open(url, '_blank', 'noopener');
}

// =====================================================
// İÅLETME DETAY MODALİ
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
                    ${isletme.tur==='berber'?ld.detayBerber:ld.detayEpilasyon}
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
                                ${h.kategori==='berber'?'':' '}
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

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            <button class="btn btn-outline-secondary" onclick="openBusinessMap(${isletme.id})">
                <i class="fas fa-map-location-dot"></i> ${ld.detayHaritadaGoster}
            </button>
        </div>

        <button class="btn btn-primary w-full"
            onclick="openRandevuForIsletme(${isletme.id}); bootstrap.Modal.getInstance(document.getElementById('isletmeModal'))?.hide()">
            <i class="fas fa-calendar-plus"></i> ${ld.detayRandevuAl}
        </button>`;
    const isletmeM = bootstrap.Modal.getOrCreateInstance(document.getElementById('isletmeModal'));
    isletmeM.show();
}

// =====================================================
// MODAL YÃƒ–NETİMİ
// =====================================================
function openModal(type, options = {}) {
    // Tüm panelleri gizle
    document.querySelectorAll('.modal-pane').forEach(p => { p.classList.add('d-none'); p.style.display=''; });
    if (type === 'login') {
        document.getElementById('loginForm').classList.remove('d-none');
    } else if (type === 'register') {
        document.getElementById('registerForm').classList.remove('d-none');
    } else if (type === 'randevu') {
        document.getElementById('randevuForm').classList.remove('d-none');
        resetRandevuForm();
        if (!options.skipQuickInit) {
            initQuickRandevuForm();
        }
    }
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('mainModal'));
    modal.show();
}

function setupRandevuServiceSelect() {
    const sel = document.getElementById('rHizmet');
    if (!sel || sel.dataset.scrollSetup === '1') return;

    sel.dataset.scrollSetup = '1';
    sel.classList.add('scrollable-select');

    const collapse = () => {
        sel.size = 1;
        sel.classList.remove('select-expanded');
    };
    const expand = () => {
        const count = sel.options ? sel.options.length : 0;
        if (count <= 1) return;
        sel.size = Math.min(count, 7);
        sel.classList.add('select-expanded');
    };

    sel.addEventListener('mousedown', (e) => {
        if (sel.size === 1) {
            e.preventDefault();
            expand();
        }
    });
    sel.addEventListener('focus', expand);
    sel.addEventListener('change', collapse);
    sel.addEventListener('blur', () => setTimeout(collapse, 80));
    sel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') collapse();
    });
}

function setupRandevuStaffSelect() {
    const sel = document.getElementById('rCalisan');
    if (!sel || sel.dataset.scrollSetup === '1') return;

    sel.dataset.scrollSetup = '1';
    sel.classList.add('scrollable-select');

    const collapse = () => {
        sel.size = 1;
        sel.classList.remove('select-expanded');
    };
    const expand = () => {
        const count = sel.options ? sel.options.length : 0;
        if (count <= 1) return;
        sel.size = Math.min(count, 7);
        sel.classList.add('select-expanded');
    };

    sel.addEventListener('mousedown', (e) => {
        if (sel.size === 1) {
            e.preventDefault();
            expand();
        }
    });
    sel.addEventListener('focus', expand);
    sel.addEventListener('change', collapse);
    sel.addEventListener('blur', () => setTimeout(collapse, 80));
    sel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') collapse();
    });
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

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn && btn.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-eye', 'fa-eye-slash');
        icon.classList.add(isPassword ? 'fa-eye-slash' : 'fa-eye');
    }
}

function overlayClose(event, id) {
    if (event.target.id === id) document.getElementById(id).style.display = 'none';
}

// =====================================================
// KAYIT / GİRİÅ / Ãƒâ€¡IKIÅ
// =====================================================
async function handleRegister() {
    const ad      = document.getElementById('registerAd').value.trim();
    const email   = document.getElementById('registerEmail').value.trim();
    const telefon = document.getElementById('registerTelefon').value.trim();
    const sifre   = document.getElementById('registerSifre').value;
    const tekrar  = document.getElementById('registerSifreTekrar').value;

    if (!ad||!email||!sifre)  { toast('toastFillAll','error'); return; }
    if (sifre.length < 6)     { toast('toastPasswordMin','error'); return; }
    if (sifre !== tekrar)     { toast('toastPasswordMismatch','error'); return; }

    try {
        const res  = await fetch('/api/kayit',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ad,email,telefon,sifre})});
        const data = await res.json();
        showToast(data.message, res.ok?'success':'error');
        if (res.ok) setTimeout(()=>switchPane('loginForm'),1200);
    } catch { toast('toastServerError','error'); }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const sifre = document.getElementById('loginSifre').value;
    if (!email||!sifre) { toast('toastEnterCredentials','error'); return; }
    try {
        const res  = await fetch('/api/giris',{method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email,sifre})});
        const data = await res.json();
        if (res.ok) {
            toast('toastLoginSuccess','success');
            closeModal(); currentUser = data.user; setLoggedIn(data.user);
        } else { showToast(data.message,'error'); }
    } catch { toast('toastServerError','error'); }
}

async function logout() {
    await fetch('/api/cikis',{method:'POST'});
    setLoggedOut();
    toast('toastLogout','success');
    setTimeout(()=>window.location.href='/',800);
}

// =====================================================
// Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•
//  RANDEVU FORMU — ADIM ADIM AKIÅ
//
//  ADIM 1 Ã¢–¸ İşletmeyi önceden biliyoruz (openRandevuForIsletme / openRandevuForHizmet)
//           Ã¢â€ â€™ isletme direkt seçili gelir, hizmetler + çalışanlar yüklenir
//  ADIM 2 Ã¢–¸ Hizmet seç  Ã¢â€ â€™ hizmet bilgisi gösterilir
//  ADIM 3 Ã¢–¸ Ãƒâ€¡alışan seç Ã¢â€ â€™ tarih alanı açılır
//  ADIM 4 Ã¢–¸ Tarih seç   Ã¢â€ â€™ o çalışanın müsait saatleri gelir
//  ADIM 5 Ã¢–¸ Saat seç    Ã¢â€ â€™ özet gösterilir + "Randevuyu Onayla" butonu aktif
// Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•Ã¢•
// =====================================================

// Ã¢â€â‚¬Ã¢â€â‚¬ Tüm form durumunu tutan nesne Ã¢â€â‚¬Ã¢â€â‚¬
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
    if (hSel) {
        hSel.innerHTML = `<option value="">-- ${L('rdvServiceChoose','Hizmet seçiniz')} --</option>`;
        hSel.size = 1;
        hSel.classList.remove('select-expanded');
    }

    // Sıfırla: çalışan select
    const cSel = document.getElementById('rCalisan');
    if (cSel) {
        cSel.innerHTML = `<option value="">-- ${L('rdvStaffChoose','Uzman seçiniz')} --</option>`;
        cSel.size = 1;
        cSel.classList.remove('select-expanded');
    }

    // Tarih
    const tarih = document.getElementById('rTarih');
    if (tarih) {
        tarih.value = '';
        const today = getTodayIsoDate();
        tarih.setAttribute('min', today);
        if (randevuDatePicker) {
            randevuDatePicker.clear();
            randevuDatePicker.set('minDate', today);
        }
    }

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

async function initQuickRandevuForm() {
    setupRandevuServiceSelect();
    setupRandevuStaffSelect();
    const hSel = document.getElementById('rHizmet');
    const row = document.getElementById('rHizmetRow');
    if (!hSel || !row) return;

    row.classList.remove('d-none');
    hSel.innerHTML = `<option value="">-- ${L('rdvServiceChoose','Hizmet seçiniz')} --</option>`;

    let hizmetler = Array.isArray(allHizmetler) ? allHizmetler : [];
    if (!hizmetler.length) {
        try {
            const res = await fetch('/api/public/hizmetler');
            const data = await res.json();
            if (data.success && Array.isArray(data.hizmetler)) {
                hizmetler = data.hizmetler;
                allHizmetler = data.hizmetler;
            }
        } catch {
            // Liste yüklenemezse varsayılan seçenek kalsın.
        }
    }

    if (!hizmetler.length) {
        hSel.innerHTML = `<option value="">${L('rdvNoServiceInBusiness','Henüz hizmet bulunamadı')}</option>`;
        return;
    }

    hizmetler.forEach(h => {
        const opt = document.createElement('option');
        const serviceName = (currentLang === 'en' && h.ad_en) ? h.ad_en : h.ad;
        const isletme = allIsletmeler.find(i => i.id == h.isletme_id);
        const isletmeAd = isletme ? fixText(isletme.ad) : '';
        const sureText = `${h.sure} ${(APP_LANGS[currentLang] || APP_LANGS['tr']).kartDk}`;
        opt.value = h.id;
        opt.textContent = `${fixText(serviceName)} — ${parseFloat(h.ucret).toLocaleString('tr-TR')} TL (${sureText})${isletmeAd ? ` · ${isletmeAd}` : ''}`;
        opt.dataset.json = JSON.stringify(h);
        hSel.appendChild(opt);
    });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// openRandevuForIsletme  — kart veya detay modalından
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function openRandevuForIsletme(isletmeId) {
    if (!currentUser) {
        toast('toastLoginRequired','error');
        openModal('login'); return;
    }
    openModal('randevu', { skipQuickInit: true });
    await initRandevuWithIsletme(isletmeId);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// openRandevuForHizmet  — hizmet kartından
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function openRandevuForHizmet(hizmetId, isletmeId) {
    if (!currentUser) {
        toast('toastLoginRequired','error');
        openModal('login'); return;
    }
    openModal('randevu', { skipQuickInit: true });
    await initRandevuWithIsletme(isletmeId, hizmetId);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// İşletme bilgisini yükle + hizmet/çalışan dropdown'larını doldur
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function initRandevuWithIsletme(isletmeId, preselectedHizmetId = null) {
    setupRandevuServiceSelect();
    setupRandevuStaffSelect();
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
                        ${obj.tur==='berber'?'Berber Salonu':'Epilasyon Merkezi'}
                        ${obj.adres?'&nbsp;·&nbsp;<i class="fas fa-map-marker-alt"></i> '+obj.adres:''}
                    </div>
                </div>
            </div>` : '';
        bilgiDiv.style.display = 'block';
    }

    // Hizmetleri yükle
    const hSel = document.getElementById('rHizmet');
    hSel.innerHTML = `<option value="">${L('rdvYukleniyor','Yükleniyor...')}</option>`;
    document.getElementById('rHizmetRow').classList.remove('d-none');

    try {
        const res  = await fetch(`/api/public/hizmetler?isletme_id=${isletmeId}`);
        const data = await res.json();
        hSel.innerHTML = `<option value="">-- ${L('rdvServiceChoose','Hizmet seçiniz')} --</option>`;
        if (data.success && data.hizmetler.length) {
            data.hizmetler.forEach(h => {
                const opt = document.createElement('option');
                opt.value        = h.id;
                opt.textContent  = `${(currentLang==='en' && h.ad_en) ? h.ad_en : h.ad}  —  ${parseFloat(h.ucret).toLocaleString('tr-TR')} TL  (${h.sure} ${(APP_LANGS[currentLang]||APP_LANGS['tr']).kartDk})`;
                opt.dataset.json = JSON.stringify(h);
                hSel.appendChild(opt);
            });
        } else {
            hSel.innerHTML = `<option value="">${L('rdvNoServiceInBusiness','Bu işletmede henüz hizmet yok')}</option>`;
        }
    } catch {
        hSel.innerHTML = `<option value="">${L('rdvLoadFailed','Yüklenemedi')}</option>`;
    }

    // Ãƒ–nceden seçilecek hizmet varsa seç
    if (preselectedHizmetId) {
        hSel.value = preselectedHizmetId;
        await onHizmetSecildi();
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ADIM 2 — Hizmet seçildi
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
    if (RF.hizmet && RF.hizmet.isletme_id) {
        RF.isletme_id = RF.hizmet.isletme_id;
        RF.isletme_obj = allIsletmeler.find(i => i.id == RF.hizmet.isletme_id) || null;
    }

    // Hizmet bilgi bandı
    const bilgi = document.getElementById('rHizmetBilgi');
    bilgi.innerHTML = `
        <div class="info-row">
            <span><strong>${(currentLang==='en' && RF.hizmet.ad_en) ? RF.hizmet.ad_en : RF.hizmet.ad}</strong></span>
            <span class="badge badge-${RF.hizmet.kategori==='berber'?'berber':'epilasyon'}">${RF.hizmet.kategori}</span>
        </div>
        <div class="info-row">
            <span><i class="far fa-clock" style="margin-right:5px"></i>${RF.hizmet.sure} ${(APP_LANGS[currentLang] || APP_LANGS['tr']).kartDk}</span>
            <strong style="color:var(--primary)">${parseFloat(RF.hizmet.ucret).toLocaleString('tr-TR')} TL</strong>
        </div>`;
    bilgi.classList.remove('d-none'); bilgi.style.display = '';

    // Ãƒâ€¡alışanları yükle (hizmet kategorisine göre filtrele)
    const cSel = document.getElementById('rCalisan');
    cSel.innerHTML = `<option value="">${L('rdvYukleniyor','Yükleniyor...')}</option>`;
    document.getElementById('rCalisanRow').classList.remove('d-none');

    try {
        const kategori = RF.hizmet.kategori;
        const res  = await fetch(`/api/public/calisanlar?isletme_id=${RF.isletme_id}&uzmanlik=${kategori}`);
        const data = await res.json();
        cSel.innerHTML = `<option value="">-- ${L('rdvStaffChoose','Uzman seçiniz')} --</option>`;
        if (data.success && data.calisanlar.length) {
            // "Fark etmez / İlk müsait" seçeneği
            const anyOpt = document.createElement('option');
            anyOpt.value = '0';
            anyOpt.textContent = L('rdvAnyStaffFirstAvailable','Herhangi bir uzman (ilk müsait)');
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
            anyOpt.textContent = 'Herhangi bir uzman';
            cSel.appendChild(anyOpt);
        }
    } catch {
        cSel.innerHTML = `<option value="">${L('rdvLoadFailed','Yüklenemedi')}</option>`;
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ADIM 3 — Ãƒâ€¡alışan seçildi
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function onCalisanSecildi() {
    const cSel = document.getElementById('rCalisan');
    RF.calisan_id  = cSel.value || null;
    RF.calisan_adi = cSel.options[cSel.selectedIndex]?.text || '';

    // Tarih satırını aç
    document.getElementById('rTarihRow').classList.remove('d-none');

    // Sıfırla tarih/saat
    document.getElementById('rTarih').value = '';
    if (randevuDatePicker) {
        randevuDatePicker.clear();
        randevuDatePicker.set('minDate', getTodayIsoDate());
    }
    document.getElementById('rSaat').value  = '';
    const slots = document.getElementById('rSaatSlots');
    if (slots) slots.innerHTML = '';
    const srEl = document.getElementById('rSaatRow'); if(srEl){srEl.classList.add('d-none');srEl.style.display='';}
    const ozEl = document.getElementById('rOzet'); if(ozEl){ozEl.classList.add('d-none');ozEl.style.display='';}  
    document.getElementById('rSubmitBtn').classList.add('d-none');
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ADIM 4 — Tarih seçildi Ã¢â€ â€™ müsait saatler
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
                       ${currentLang === 'en' ? 'Working hours' : 'Çalışma saatleri'}: ${data.acilis} – ${data.kapanis}
                   </small>` : '';

            const saatler = data.tum_saatler || data.musait_saatler.map(s => ({saat: s, dolu: false}));
            slotsDiv.innerHTML = info + saatler.map(item => {
                if (item.dolu) {
                    return `<button type="button" class="saat-slot saat-dolu" disabled title="${currentLang === 'en' ? 'This time slot is unavailable' : 'Bu saat dolu'}">${item.saat}</button>`;
                }
                return `<button type="button" class="saat-slot" onclick="selectSaat('${item.saat}',this)">${item.saat}</button>`;
            }).join('');
        } else if (data.success && data.tum_saatler && data.tum_saatler.length > 0) {
            // Tüm saatler dolu ama varlar
            const info = data.acilis
                ? `<small style="color:#64748b;display:block;margin-bottom:8px">
                       ${currentLang === 'en' ? 'Working hours' : 'Çalışma saatleri'}: ${data.acilis} – ${data.kapanis}
                   </small>` : '';
            slotsDiv.innerHTML = info + data.tum_saatler.map(item =>
                `<button type="button" class="saat-slot saat-dolu" disabled title="${currentLang === 'en' ? 'This time slot is unavailable' : 'Bu saat dolu'}">${item.saat}</button>`
            ).join('') + `<p style="color:var(--red);font-size:12px;margin-top:8px">
                <i class="fas fa-times-circle"></i> ${currentLang === 'en' ? 'All time slots are full on this date' : 'Bu tarihte tüm saatler doludur'}</p>`;
        } else {
            const msg = getLocalizedAvailabilityMessage(data.mesaj || (currentLang === 'en' ? 'No available time slots on this date.' : 'Bu tarihte müsait saat yok'));
            slotsDiv.innerHTML = `<p style="color:var(--red);font-size:13px;padding:8px 0">
                <i class="fas fa-times-circle" style="margin-right:5px"></i>${msg}</p>`;
        }
    } catch {
        slotsDiv.innerHTML = `<p style="color:var(--text-muted);font-size:13px">${currentLang === 'en' ? 'Time slots could not be loaded' : 'Saatler yüklenemedi'}</p>`;
    }
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// ADIM 5 — Saat seçildi
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function selectSaat(saat, btn) {
    document.querySelectorAll('.saat-slot').forEach(s => s.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.getElementById('rSaat').value = saat;
    RF.saat = saat;
    updateOzet();
    document.getElementById('rSubmitBtn').classList.remove('d-none');
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// Ãƒ–ZET KUTUSU
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
                <span>${!RF.calisan_id||RF.calisan_id==='0' ? 'İlk müsait uzman' : RF.calisan_adi}</span>
            </div>
            <div class="ozet-row">
                <span>Tarih &amp; Saat</span>
                <span><strong>${RF.tarih} — ${RF.saat}</strong></span>
            </div>
            <div class="ozet-row">
                <span>Süre</span>
                <span>${RF.hizmet.sure} ${(APP_LANGS[currentLang] || APP_LANGS['tr']).kartDk}</span>
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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// RANDEVU GÃƒ–NDER
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
async function submitAppointment() {
    if (!currentUser) {
        toast('toastLoginRequired','error');
        openModal('login'); return;
    }

    const musteriAd  = (document.getElementById('rMusteriAd')?.value||'').trim();
    const musteriTel = (document.getElementById('rMusteriTelefon')?.value||'').trim();
    const notlar     = (document.getElementById('rNotlar')?.value||'').trim();

    if (!musteriAd)   { toast('toastEnterName','error'); return; }
    if (!musteriTel)  { toast('toastEnterPhone','error'); return; }
    if (!RF.isletme_id){ toast('toastSelectBusiness','error'); return; }
    if (!RF.hizmet)   { toast('toastSelectService','error'); return; }
    if (!RF.tarih)    { toast('toastSelectDate','error'); return; }
    if (!RF.saat)     { toast('toastSelectTime','error'); return; }

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
    btn.innerHTML = `<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0 4px 0 0"></div> ${L('toastAppointmentCreating','Oluşturuluyor...')}`;

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
        toast('toastServerError','error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-check-circle"></i> ${L('rdvConfirmBtn','Randevuyu Onayla')}`;
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
            lastRandevularimList = Array.isArray(data.randevular) ? data.randevular : [];
            await enrichPublicAppointments(lastRandevularimList);
            renderRandevularim(data.randevular);
        } else if (data.message === 'giris_gerekli') {
            lastRandevularimList = [];
            const d = APP_LANGS[currentLang] || APP_LANGS['tr'];
            document.getElementById('randevularimList').innerHTML = `
                <div style="text-align:center;padding:24px">
                    <i class="fas fa-phone-alt" style="font-size:2.5rem;color:#1b4a6b;margin-bottom:14px;display:block"></i>
                    <p style="margin-bottom:16px;color:#475569;font-size:15px">
                        ${d.rdvTelGir}
                    </p>
                    <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
                        <input type="tel" id="randevuTelInput" placeholder="${d.rdvTelefonPlaceholder || '05XX XXX XX XX'}"
                            style="flex:1;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;
                                   font-size:14px;font-family:inherit"
                            onkeydown="if(event.key==='Enter') sorgulaRandevuTel()">
                        <button onclick="sorgulaRandevuTel()"
                            style="padding:10px 18px;background:linear-gradient(135deg,#0f2b3d,#1b4a6b);
                                   color:#fff;border:none;border-radius:10px;cursor:pointer;
                                   font-weight:600;font-family:inherit">
                            ${d.rdvSorgula}
                        </button>
                    </div>
                    <p style="margin-top:12px;font-size:12px;color:#94a3b8">
                        ${d.rdvAltYada || 'Ya da'} <a href="#"
                            onclick="closeRandevularimModal();openModal('login')"
                            style="color:#1b4a6b;font-weight:600">${d.rdvGirisYap}</a>
                        ${d.rdvAltTumunuGor || 'tüm randevularınızı görün.'}
                    </p>
                </div>`;
        } else {
            lastRandevularimList = [];
            document.getElementById('randevularimList').innerHTML =
                `<div class="empty-state"><i class="fas fa-exclamation-circle"></i>
                 <p>${data.message}</p></div>`;
        }
    } catch {
        lastRandevularimList = [];
        document.getElementById('randevularimList').innerHTML =
            '<div class="empty-state"><i class="fas fa-wifi"></i><p>Bağlantı hatası!</p></div>';
    }
}

async function sorgulaRandevuTel() {
    const tel = document.getElementById('randevuTelInput')?.value?.trim();
    if (!tel) { toast('toastPhoneRequired','error'); return; }
    document.getElementById('randevularimList').innerHTML =
        '<div class="loading-state"><div class="spinner"></div><p>Aranıyor...</p></div>';
    try {
        const res  = await fetch(`/api/randevularim?telefon=${encodeURIComponent(tel)}`);
        const data = await res.json();
        if (data.success) {
            lastRandevularimList = Array.isArray(data.randevular) ? data.randevular : [];
            await enrichPublicAppointments(lastRandevularimList);
            renderRandevularim(data.randevular);
        } else {
            lastRandevularimList = [];
            document.getElementById('randevularimList').innerHTML =
                `<div class="empty-state"><i class="fas fa-exclamation-circle"></i>
                 <p>${data.message}</p></div>`;
        }
    } catch { toast('toastConnectionError','error'); }
}

function getLocalizedRandevuServiceName(r) {
    const directName = currentLang === 'en'
        ? (r.hizmet_adi_en || r.hizmet_ad_en || r.hizmet_en || '')
        : (r.hizmet_adi || r.hizmet_ad || '');
    if (directName) return directName;

    const matchedService = allHizmetler.find(h =>
        String(h.id) === String(r.hizmet_id || '') ||
        (
            String(h.isletme_id) === String(r.isletme_id || '') &&
            fixText(h.ad || '').toLowerCase() === fixText(r.hizmet_adi || r.hizmet_ad || '').toLowerCase()
        )
    );
    if (!matchedService) return r.hizmet_adi || r.hizmet_ad || '';

    return currentLang === 'en'
        ? (matchedService.ad_en || matchedService.ad || r.hizmet_adi || r.hizmet_ad || '')
        : (matchedService.ad || r.hizmet_adi || r.hizmet_ad || '');
}

function getLocalizedAppointmentNote(r) {
    const raw = currentLang === 'en' ? (r.notlar_en || r.notlar || '') : (r.notlar || '');
    if (currentLang !== 'en') return raw;

    const noteMap = {
        'randevu onaylandı': 'appointment approved',
        'randevu onaylandi': 'appointment approved',
        'randevu tamamlandı': 'appointment completed',
        'randevu tamamlandi': 'appointment completed',
        'randevu iptal edildi': 'appointment cancelled',
        'tamam her şey oldu': 'everything is okay',
        'tamam her sey oldu': 'everything is okay'
    };

    const key = fixText(raw).trim().toLocaleLowerCase('tr-TR');
    return noteMap[key] || raw;
}

function getLocalizedAvailabilityMessage(message) {
    const raw = fixText(message || '').trim();
    if (currentLang !== 'en') return raw;

    const map = {
        'işletme bugün kapalıdır.': 'The business is closed today.',
        'isletme bugun kapalidir.': 'The business is closed today.',
        'bu tarihte müsait saat yok': 'No available time slots on this date.',
        'bu tarihte musait saat yok': 'No available time slots on this date.',
        'bu saat dolu': 'This time slot is unavailable',
        'çalışma saatleri': 'Working hours'
    };

    const key = raw.toLocaleLowerCase('tr-TR');
    return map[key] || raw;
}

function renderRandevularim(list) {
    const el = document.getElementById('randevularimList');
    const d = APP_LANGS[currentLang] || APP_LANGS['tr'];
    lastRandevularimList = Array.isArray(list) ? list : [];
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
    const now = new Date();
    el.innerHTML = `<div class="randevu-list">${list.map(r => {
        const serviceName = getLocalizedRandevuServiceName(r);
        const appointmentNote = getLocalizedAppointmentNote(r);
        const appointmentTime = r.tarih && r.saat ? new Date(`${r.tarih}T${r.saat}:00`) : null;
        const isPastAppointment = appointmentTime ? appointmentTime < now : false;
        const canCancel = r.durum === 'bekliyor' && !isPastAppointment;
        const footer = canCancel
            ? `<div class="ri-footer">
                <button class="btn btn-danger btn-sm" onclick="iptalEt(${r.id})">
                    <i class="fas fa-times"></i> ${d.rdvIptalEt}
                </button>
            </div>`
            : (r.durum === 'bekliyor' && isPastAppointment
                ? `<div class="ri-footer">
                    <span class="badge badge-info">${d.rdvPast}</span>
                </div>`
                : '');
        return `
        <div class="randevu-item st-${r.durum}">
            <div class="ri-header">
                <span class="ri-date"><i class="far fa-calendar-alt"></i>${r.tarih} — ${r.saat}</span>
                ${durumBadge[r.durum] || r.durum}
            </div>
            <div class="ri-body">
                ${r.isletme_adi ? `<p><i class="fas fa-store"></i><strong>${d.rdvIsletme}:</strong>&nbsp;${r.isletme_adi}</p>` : ''}
                ${serviceName ? `<p><i class="fas fa-cut"></i><strong>${d.rdvHizmet}:</strong>&nbsp;${serviceName}${r.ucret?' — '+parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺':''}</p>` : ''}
                ${r.calisan_adi ? `<p><i class="fas fa-user-tie"></i><strong>${d.rdvUzman}:</strong>&nbsp;${r.calisan_adi}</p>` : ''}
                ${appointmentNote ? `<p><i class="fas fa-sticky-note"></i><strong>${d.rdvNot}:</strong>&nbsp;${appointmentNote}</p>` : ''}
            </div>
            ${footer}
        </div>`;
    }).join('')}</div>`;
    autoTranslateAppDom(el);
}

async function iptalEt(id) {
    if (!confirm(L('toastCancelConfirm','Randevuyu iptal etmek istediğinize emin misiniz?'))) return;
    try {
        const res  = await fetch(`/api/randevu-iptal/${id}`,{method:'POST'});
        const data = await res.json();
        showToast(data.message, res.ok?'success':'error');
        if (res.ok) showRandevularim();
    } catch { toast('toastGeneralError','error'); }
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
            <div class="toast-body fw-semibold"><i class="fas ${icons[type]||icons.success} me-2"></i>${fixText(msg)}</div>
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
function toggleSidebar() {
    const isOpen = document.body.classList.contains('sidebar-open');
    if (isOpen) closeSidebar();
    else openSidebar();
}

function syncSidebarLayout() {
    const main = document.getElementById('appMain');
    const sidebar = document.getElementById('appSidebar');
    if (!main || !sidebar) return;
    const isOpen = document.body.classList.contains('sidebar-open');
    const desktop = window.innerWidth >= 992;
    if (isOpen && desktop) {
        const w = sidebar.offsetWidth || 280;
        main.style.marginLeft = `${w}px`;
        main.style.width = `calc(100% - ${w}px)`;
    } else {
        main.style.marginLeft = '';
        main.style.width = '';
    }
}

function openSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (!sidebar) return;
    sidebar.style.transform = 'translateX(0)';
    if (window.innerWidth < 992) {
        document.getElementById('sidebarOverlay').style.display = 'block';
        document.body.style.overflow = 'hidden';
    } else {
        document.getElementById('sidebarOverlay').style.display = 'none';
        document.body.style.overflow = '';
    }
    document.body.classList.add('sidebar-open');
    syncSidebarLayout();
}

function closeSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.style.transform = 'translateX(-100%)';
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    document.body.classList.remove('sidebar-open');
    syncSidebarLayout();
}

window.addEventListener('resize', syncSidebarLayout);
document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && document.body.classList.contains('sidebar-open')) {
        closeSidebar();
    }
});

function openNavFilterWizard() {
    const root = document.getElementById('navFilterWizard');
    if (!root) return;
    root.classList.add('open');
    document.body.classList.add('nav-filter-open');
    populateAdvancedFilterOptions();
    onAdvancedTypeChange();
    ['advDistrict', 'advService', 'advMinPrice', 'advMaxPrice'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.oninput = syncAdvancedFilterPreview;
        el.onchange = syncAdvancedFilterPreview;
    });
    syncAdvancedFilterPreview();
}

function closeNavFilterWizard() {
    const root = document.getElementById('navFilterWizard');
    if (root) root.classList.remove('open');
    document.body.classList.remove('nav-filter-open');
}

function extractCityDistrict(adres) {
    const text = fixText(adres || '').replace(/\s+/g, ' ').trim();
    if (!text) return { city: '', district: '' };
    const parts = text.split(/[,\-\/]/).map(x => x.trim()).filter(Boolean);
    const city = parts[0] || '';
    const district = parts[1] || '';
    return { city, district };
}

function populateAdvancedFilterOptions() {
    const cityEl = document.getElementById('advCity');
    const serviceEl = document.getElementById('advService');
    if (!cityEl || !serviceEl) return;

    const prevCity = cityEl.value || '';
    const prevService = serviceEl.value || '';
    const cityMap = {};

    allIsletmeler.forEach(i => {
        const loc = extractCityDistrict(i.adres);
        if (!loc.city) return;
        if (!cityMap[loc.city]) cityMap[loc.city] = new Set();
        if (loc.district) cityMap[loc.city].add(loc.district);
    });
    advancedLocationMap = cityMap;

    const cities = Object.keys(cityMap).sort((a, b) => a.localeCompare(b, 'tr'));
    cityEl.innerHTML = `<option value="">Seciniz</option>` + cities.map(c => `<option value="${c}">${c}</option>`).join('');
    if (prevCity && cities.includes(prevCity)) cityEl.value = prevCity;

    const services = allHizmetler.map(h => ({
        id: h.id,
        name: fixText((currentLang === 'en' && h.ad_en) ? h.ad_en : h.ad)
    }));
    serviceEl.innerHTML = `<option value="">Tumu</option>` +
        services.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (prevService && [...serviceEl.options].some(o => o.value === prevService)) serviceEl.value = prevService;

    onAdvancedCityChange();
}

function onAdvancedCityChange() {
    const cityEl = document.getElementById('advCity');
    const districtEl = document.getElementById('advDistrict');
    if (!cityEl || !districtEl) return;

    const city = cityEl.value || '';
    const districts = city && advancedLocationMap[city] ? [...advancedLocationMap[city]].sort((a, b) => a.localeCompare(b, 'tr')) : [];
    districtEl.innerHTML = `<option value="">Seciniz</option>` + districts.map(d => `<option value="${d}">${d}</option>`).join('');
    districtEl.disabled = !districts.length;
    syncAdvancedFilterPreview();
}

function setAdvancedTypeTab(type, btn) {
    const typeEl = document.getElementById('advType');
    if (!typeEl) return;
    typeEl.value = type || '';
    if (btn) {
        document.querySelectorAll('.adv-pill-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
    }
    onAdvancedTypeChange();
}

function updateAdvancedTypeTabs() {
    const type = (document.getElementById('advType')?.value || '').toLowerCase();
    const tabs = document.querySelectorAll('.adv-pill-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (!tabs.length) return;
    if (type === 'business' && tabs[1]) tabs[1].classList.add('active');
    else if (type === 'service' && tabs[2]) tabs[2].classList.add('active');
    else tabs[0].classList.add('active');
}

function onAdvancedTypeChange() {
    const type = (document.getElementById('advType')?.value || '').toLowerCase();
    const serviceEl = document.getElementById('advService');
    const minEl = document.getElementById('advMinPrice');
    const maxEl = document.getElementById('advMaxPrice');
    const serviceGroup = document.getElementById('advServiceGroup');
    const priceGroup = document.getElementById('advPriceGroup');
    if (!serviceEl || !minEl || !maxEl) return;

    if (serviceGroup) serviceGroup.classList.toggle('d-none', type !== 'business');
    else serviceEl.classList.toggle('d-none', type !== 'business');

    if (priceGroup) priceGroup.classList.toggle('d-none', type !== 'service');
    else {
        minEl.classList.toggle('d-none', type !== 'service');
        maxEl.classList.toggle('d-none', type !== 'service');
    }

    updateAdvancedTypeTabs();
    syncAdvancedFilterPreview();
}

function clearAdvancedFilters() {
    const typeEl = document.getElementById('advType');
    const cityEl = document.getElementById('advCity');
    const districtEl = document.getElementById('advDistrict');
    const serviceEl = document.getElementById('advService');
    const minEl = document.getElementById('advMinPrice');
    const maxEl = document.getElementById('advMaxPrice');

    if (typeEl) typeEl.value = '';
    if (cityEl) cityEl.value = '';
    if (serviceEl) serviceEl.value = '';
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    if (districtEl) {
        districtEl.innerHTML = `<option value="">Seciniz</option>`;
        districtEl.value = '';
        districtEl.disabled = true;
    }

    onAdvancedTypeChange();
    syncAdvancedFilterPreview();
}

function renderAdvancedFilterChips(state) {
    const chipList = document.getElementById('advChipList');
    const chipLabel = document.getElementById('advChipLabel');
    if (!chipList || !chipLabel) return;

    chipList.querySelectorAll('.adv-chip').forEach(x => x.remove());
    const chips = [];
    window._advChipActions = [];

    if (state.type) {
        chips.push(state.type === 'business' ? 'Isletme' : 'Hizmet');
        window._advChipActions.push(() => {
            const typeEl = document.getElementById('advType');
            if (typeEl) typeEl.value = '';
            onAdvancedTypeChange();
        });
    }
    if (state.city) {
        chips.push(state.city);
        window._advChipActions.push(() => {
            const cityEl = document.getElementById('advCity');
            if (cityEl) cityEl.value = '';
            onAdvancedCityChange();
        });
    }
    if (state.district) {
        chips.push(state.district);
        window._advChipActions.push(() => {
            const districtEl = document.getElementById('advDistrict');
            if (districtEl) districtEl.value = '';
            syncAdvancedFilterPreview();
        });
    }
    if (state.serviceTxt) {
        chips.push(state.serviceTxt);
        window._advChipActions.push(() => {
            const serviceEl = document.getElementById('advService');
            if (serviceEl) serviceEl.value = '';
            syncAdvancedFilterPreview();
        });
    }
    if (state.min) {
        chips.push(`Min ${state.min}`);
        window._advChipActions.push(() => {
            const minEl = document.getElementById('advMinPrice');
            if (minEl) minEl.value = '';
            syncAdvancedFilterPreview();
        });
    }
    if (state.max) {
        chips.push(`Max ${state.max}`);
        window._advChipActions.push(() => {
            const maxEl = document.getElementById('advMaxPrice');
            if (maxEl) maxEl.value = '';
            syncAdvancedFilterPreview();
        });
    }

    chipLabel.style.display = chips.length ? '' : 'none';

    chips.forEach((txt, i) => {
        const chip = document.createElement('span');
        chip.className = 'adv-chip';
        chip.innerHTML = `${fixText(txt)} <button type="button" class="adv-chip-x" onclick="removeAdvancedFilterChip(${i})">×</button>`;
        chipList.appendChild(chip);
    });
}

function removeAdvancedFilterChip(i) {
    if (!window._advChipActions || !window._advChipActions[i]) return;
    window._advChipActions[i]();
}

function syncAdvancedFilterPreview() {
    const box = document.getElementById('advFilterResult');
    if (!box) return;
    const type = (document.getElementById('advType')?.value || '').toLowerCase();
    const city = document.getElementById('advCity')?.value || '';
    const district = document.getElementById('advDistrict')?.value || '';
    const serviceTxtRaw = document.getElementById('advService')?.selectedOptions?.[0]?.textContent || '';
    const serviceTxt = fixText(serviceTxtRaw || '').trim();
    const min = document.getElementById('advMinPrice')?.value || '';
    const max = document.getElementById('advMaxPrice')?.value || '';

    const state = {
        type,
        city,
        district,
        serviceTxt: serviceTxt && serviceTxt.toLowerCase() !== 'tumu' ? serviceTxt : '',
        min,
        max
    };
    renderAdvancedFilterChips(state);

    const cityL = city.toLowerCase();
    const districtL = district.toLowerCase();
    const selectedServiceId = parseInt(document.getElementById('advService')?.value || '', 10);
    const minPrice = parseFloat(min || '');
    const maxPrice = parseFloat(max || '');

    const filteredIsletmeler = allIsletmeler.filter(i => {
        const adres = fixText(i.adres || '').toLowerCase();
        const inCity = !cityL || adres.includes(cityL);
        const inDistrict = !districtL || adres.includes(districtL);
        const hasService = !Number.isInteger(selectedServiceId) || selectedServiceId <= 0 || allHizmetler.some(h => h.id === selectedServiceId && h.isletme_id === i.id);
        return inCity && inDistrict && hasService;
    });

    const filteredHizmetler = allHizmetler.filter(h => {
        const business = allIsletmeler.find(i => i.id === h.isletme_id);
        const adres = fixText(business?.adres || '').toLowerCase();
        const inCity = !cityL || adres.includes(cityL);
        const inDistrict = !districtL || adres.includes(districtL);
        const serviceOk = !Number.isInteger(selectedServiceId) || selectedServiceId <= 0 || h.id === selectedServiceId;
        const minOk = Number.isNaN(minPrice) ? true : parseFloat(h.ucret || 0) >= minPrice;
        const maxOk = Number.isNaN(maxPrice) ? true : parseFloat(h.ucret || 0) <= maxPrice;
        return inCity && inDistrict && serviceOk && minOk && maxOk;
    });

    const showCount = type === 'service' ? filteredHizmetler.length : filteredIsletmeler.length;
    const showLabel = type === 'service' ? 'hizmet' : 'isletme';
    const activeInfo = [
        state.type ? `Tur: ${state.type === 'business' ? 'Isletme' : 'Hizmet'}` : '',
        (state.city || state.district) ? `Konum: ${state.city || 'Tum iller'}${state.district ? ' / ' + state.district : ''}` : '',
        state.serviceTxt ? `Hizmet: ${state.serviceTxt}` : '',
        (state.min || state.max) ? `Fiyat: ${state.min || '0'} - ${state.max || '∞'} TL` : ''
    ].filter(Boolean).join(' · ');

    box.innerHTML = `${showCount} ${showLabel} onizlemede listelenecek${activeInfo ? `<br><strong>${fixText(activeInfo)}</strong>` : ''}`;
}

function applyAdvancedFilters() {
    const type = (document.getElementById('advType')?.value || '').toLowerCase();
    const city = fixText(document.getElementById('advCity')?.value || '').toLowerCase();
    const district = fixText(document.getElementById('advDistrict')?.value || '').toLowerCase();
    const selectedServiceId = type === 'business'
        ? parseInt(document.getElementById('advService')?.value || '', 10)
        : NaN;
    const minPrice = parseFloat(document.getElementById('advMinPrice')?.value || '');
    const maxPrice = parseFloat(document.getElementById('advMaxPrice')?.value || '');

    const filteredIsletmeler = allIsletmeler.filter(i => {
        const adres = fixText(i.adres || '').toLowerCase();
        const inCity = !city || adres.includes(city);
        const inDistrict = !district || adres.includes(district);
        const hasService = !Number.isInteger(selectedServiceId) || selectedServiceId <= 0 || allHizmetler.some(h => h.id === selectedServiceId && h.isletme_id === i.id);
        return inCity && inDistrict && hasService;
    });

    const filteredHizmetler = allHizmetler.filter(h => {
        const business = allIsletmeler.find(i => i.id === h.isletme_id);
        const adres = fixText(business?.adres || '').toLowerCase();
        const inCity = !city || adres.includes(city);
        const inDistrict = !district || adres.includes(district);
        const serviceOk = !Number.isInteger(selectedServiceId) || selectedServiceId <= 0 || h.id === selectedServiceId;
        const minOk = Number.isNaN(minPrice) ? true : parseFloat(h.ucret || 0) >= minPrice;
        const maxOk = Number.isNaN(maxPrice) ? true : parseFloat(h.ucret || 0) <= maxPrice;
        return inCity && inDistrict && serviceOk && minOk && maxOk;
    });

    const isletmelerForView = type === 'service'
        ? filteredIsletmeler.filter(i => filteredHizmetler.some(h => h.isletme_id === i.id))
        : filteredIsletmeler;
    renderIsletmeler(isletmelerForView);
    renderHizmetler(filteredHizmetler);

    syncAdvancedFilterPreview();
    closeNavFilterWizard();
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeSidebar();
        closeNavFilterWizard();
    }
});

// =====================================================
// ARAMA
// =====================================================
function parsePriceRange(range, amount) {
    const price = parseFloat(amount || 0);
    if (!range || range === 'all') return true;
    if (range === '0-200') return price >= 0 && price <= 200;
    if (range === '200-400') return price > 200 && price <= 400;
    if (range === '400+') return price > 400;
    return true;
}

function populateNavIsletmeFilter() {
    const el = document.getElementById('navIsletmeFilter');
    if (!el) return;
    const prev = el.value || '';
    const allLabel = L('navAllBusinesses', 'Tüm İşletmeler');
    el.innerHTML = `<option value="">${allLabel}</option>` +
        allIsletmeler.map(i => `<option value="${i.id}">${fixText(i.ad)}</option>`).join('');
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
}

function populateNavHizmetFilter(isletmeId = '') {
    const el = document.getElementById('navHizmetFilter');
    if (!el) return;
    const prev = el.value || '';
    const allLabel = L('navAllServices', 'Tüm Hizmetler');
    const targetId = parseInt(isletmeId || document.getElementById('navIsletmeFilter')?.value || '', 10);
    const filtered = Number.isInteger(targetId) && targetId > 0
        ? allHizmetler.filter(h => h.isletme_id === targetId)
        : allHizmetler;
    el.innerHTML = `<option value="">${allLabel}</option>` + filtered.map(h => {
        const name = fixText((currentLang === 'en' && h.ad_en) ? h.ad_en : h.ad);
        const price = parseFloat(h.ucret || 0).toLocaleString('tr-TR');
        return `<option value="${h.id}">${name} - ${price} ₺</option>`;
    }).join('');
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
}

function onNavIsletmeChange() {
    const selected = document.getElementById('navIsletmeFilter')?.value || '';
    populateNavHizmetFilter(selected);
    const hizmetSelect = document.getElementById('navHizmetFilter');
    if (hizmetSelect && selected && ![...hizmetSelect.options].some(o => o.value === hizmetSelect.value)) {
        hizmetSelect.value = '';
    }
    syncNavFilterSelections();
}

function syncNavFilterSelections() {
    syncAdvancedFilterPreview();
}

function highlightSearchTarget(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.remove('search-target-focus');
    // reflow for repeated animation
    void el.offsetWidth;
    el.classList.add('search-target-focus');
    setTimeout(() => el.classList.remove('search-target-focus'), 1800);
}

function navigateToBestSearchMatch(qRaw, isletmeSonuclari, hizmetSonuclari) {
    const q = fixText(qRaw || '').trim().toLowerCase();
    if (!q) return;

    const exactHizmet = hizmetSonuclari.find(h => {
        const n1 = fixText((currentLang === 'en' && h.ad_en) ? h.ad_en : h.ad).toLowerCase();
        const n2 = fixText(h.ad || '').toLowerCase();
        return n1 === q || n2 === q;
    });
    const exactIsletme = isletmeSonuclari.find(i => fixText(i.ad).toLowerCase() === q);

    if (exactHizmet) {
        document.getElementById('hizmetler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => highlightSearchTarget(`.hizmet-card[data-hizmet-id="${exactHizmet.id}"]`), 420);
        return;
    }
    if (exactIsletme) {
        document.getElementById('isletmeler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => highlightSearchTarget(`.isletme-card[data-isletme-id="${exactIsletme.id}"]`), 420);
        return;
    }

    if (hizmetSonuclari.length > 0) {
        const first = hizmetSonuclari[0];
        document.getElementById('hizmetler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => highlightSearchTarget(`.hizmet-card[data-hizmet-id="${first.id}"]`), 420);
        return;
    }
    if (isletmeSonuclari.length > 0) {
        const first = isletmeSonuclari[0];
        document.getElementById('isletmeler')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => highlightSearchTarget(`.isletme-card[data-isletme-id="${first.id}"]`), 420);
    }
}

function aramaYap(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && e.type === 'submit') closeNavFilterWizard();
    const q = fixText((document.getElementById('navArama')?.value || '').trim().toLowerCase());
    const selectedIsletmeId = parseInt(document.getElementById('navIsletmeFilter')?.value || '', 10);
    const selectedHizmetId = parseInt(document.getElementById('navHizmetFilter')?.value || '', 10);
    const fiyatFilter = (document.getElementById('navFiyatFilter')?.value || 'all').toLowerCase();

    const isletmeSonuclari = allIsletmeler.filter(i => {
        const matchesBusiness = !Number.isInteger(selectedIsletmeId) || selectedIsletmeId <= 0 || i.id === selectedIsletmeId;
        if (!matchesBusiness) return false;
        if (!q) return true;
        return fixText(i.ad).toLowerCase().includes(q) ||
            fixText(i.aciklama || '').toLowerCase().includes(q) ||
            fixText(i.adres || '').toLowerCase().includes(q);
    });

    const hizmetSonuclari = allHizmetler.filter(h => {
        const serviceName = fixText((currentLang === 'en' && h.ad_en) ? h.ad_en : h.ad).toLowerCase();
        const serviceNameAlt = fixText(h.ad || '').toLowerCase();
        const isletmeAd = fixText(allIsletmeler.find(i => i.id === h.isletme_id)?.ad || '').toLowerCase();
        const matchesBusiness = !Number.isInteger(selectedIsletmeId) || selectedIsletmeId <= 0 || h.isletme_id === selectedIsletmeId;
        const matchesService = !Number.isInteger(selectedHizmetId) || selectedHizmetId <= 0 || h.id === selectedHizmetId;
        const matchesPrice = parsePriceRange(fiyatFilter, h.ucret);
        const matchesSearch = !q || serviceName.includes(q) || serviceNameAlt.includes(q) || isletmeAd.includes(q);
        return matchesBusiness && matchesService && matchesPrice && matchesSearch;
    });

    renderIsletmeler(isletmeSonuclari);
    renderHizmetler(hizmetSonuclari);

    const ia = document.getElementById('isletmeArama');
    if (ia) ia.value = document.getElementById('navArama')?.value || '';
    const ha = document.getElementById('hizmetArama');
    if (ha) ha.value = document.getElementById('navArama')?.value || '';

    navigateToBestSearchMatch(document.getElementById('navArama')?.value || '', isletmeSonuclari, hizmetSonuclari);

    const toplam = isletmeSonuclari.length + hizmetSonuclari.length;
    if (toplam === 0) {
        if (q) showToast(`"${q}" ${L('toastSearchNoResults','sonuç bulunamadı')}`, 'warning');
    } else {
        if (q) {
            const msg = [];
            if (isletmeSonuclari.length) msg.push(isletmeSonuclari.length + ' işletme');
            if (hizmetSonuclari.length) msg.push(hizmetSonuclari.length + ' hizmet');
            showToast(msg.join(', ') + ' ' + L('toastSearchFoundSuffix','bulundu'), 'success');
        }
    }
}

function setupNavSearchAutoReset() {
    const navSearch = document.getElementById('navArama');
    if (!navSearch) return;

    navSearch.addEventListener('input', (e) => {
        if (!fixText(e.target.value || '').trim()) aramaYap(e);
    });

    navSearch.addEventListener('search', aramaYap);
}

function araIsletme(q) {
    q = fixText(q || '').toLowerCase();
    const filter = (document.getElementById('isletmeAramaFilter')?.value || 'all').toLowerCase();
    const list = allIsletmeler.filter(i => {
        if (!q) return true;
        const inAd = fixText(i.ad).toLowerCase().includes(q);
        const inAdres = fixText(i.adres||'').toLowerCase().includes(q);
        if (filter === 'ad') return inAd;
        if (filter === 'adres') return inAdres;
        return inAd || inAdres;
    });
    renderIsletmeler(list);
}

function araHizmet(q) {
    q = fixText(q || '').toLowerCase();
    const filter = (document.getElementById('hizmetAramaFilter')?.value || 'all').toLowerCase();
    const list = allHizmetler.filter(h => {
        if (!q) return true;
        const isletmeAd = fixText(allIsletmeler.find(i => i.id === h.isletme_id)?.ad || '').toLowerCase();
        const inAd = fixText(h.ad).toLowerCase().includes(q) || fixText(h.ad_en||'').toLowerCase().includes(q);
        const inIsletme = isletmeAd.includes(q);
        if (filter === 'ad') return inAd;
        if (filter === 'isletme') return inIsletme;
        return inAd || inIsletme;
    });
    renderHizmetler(list);
}
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
    if (!ad || !email) { toast('toastProfileRequired','error'); return; }
    if (sifre && sifre.length < 6) { toast('toastPasswordMin','error'); return; }
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
            refreshCurrentUserLabels();
            // Modal güncelle
            document.getElementById('profilAd').textContent = ad;
            document.getElementById('profilEmail').textContent = email;
            document.getElementById('profilAvatar').textContent = (ad[0]||'U').toUpperCase();
            if (sifre) document.getElementById('profilSifreInput').value = '';
            toast('toastProfileUpdated','success');
        } else {
            toast('toastProfileUpdateFailed','error');
        }
    } catch { toast('toastServerError','error'); }
}

async function profilGuncelle() {
    const ad    = (document.getElementById('profilAdInput')?.value||'').trim();
    const email = (document.getElementById('profilEmailInput')?.value||'').trim();
    const sifre = (document.getElementById('profilSifreInput')?.value||'').trim();
    if (!ad || !email) { toast('toastProfileRequired','error'); return; }
    if (sifre && sifre.length < 6) { toast('toastPasswordMin','error'); return; }
    const payload = { ad, email };
    if (sifre) payload.sifre = sifre;

    // Butonu loading yap
    const btn = document.querySelector('#profilModal button[onclick="profilGuncelle()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>${L('profilUpdating','Güncelleniyor...')}`; }

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
            refreshCurrentUserLabels();
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
            toast('toastProfileUpdated','success');
        } else {
            toast('toastProfileUpdateFailed','error');
        }
    } catch { toast('toastServerError','error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fas fa-save me-2"></i>${L('profilGuncelleBtn','Güncelle')}`; }
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
    applyTheme(currentUser ? t : 'light');
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
    heroBadge: 'MBX BARBER & BEAUTY', heroH1: 'MBX BARBER', heroH1Span: '& BEAUTY',
    heroP: 'MBX BARBER & BEAUTY ile berber ve güzellik dünyasında uzman kadromuzla en uygun zamanda randevu alın.',
    toastFillAll: 'Tüm alanları doldurun!', toastPasswordMin: 'Şifre en az 6 karakter!',
    toastPasswordMismatch: 'Şifreler eşleşmiyor!', toastServerError: 'Sunucu hatası!',
    toastEnterCredentials: 'E-posta ve şifre girin!', toastLoginSuccess: 'Giriş başarılı!',
    toastLogout: 'Çıkış yapıldı', toastLoginRequired: 'Randevu almak için giriş yapın!',
    toastEnterName: 'Ad Soyad girin!', toastEnterPhone: 'Telefon numarası girin!',
    toastSelectBusiness: 'İşletme seçilmedi!', toastSelectService: 'Hizmet seçin!',
    toastSelectDate: 'Tarih seçin!', toastSelectTime: 'Saat seçin!',
    toastAppointmentCreating: 'Oluşturuluyor...', toastPhoneRequired: 'Telefon numarası girin!',
    toastConnectionError: 'Bağlantı hatası!', toastGeneralError: 'Bir sorun oluştu!',
    profilUpdating: 'Güncelleniyor...', toastProfileRequired: 'Ad ve e-posta zorunludur!',
    toastProfileUpdated: 'Profil güncellendi!', toastProfileUpdateFailed: 'Güncelleme başarısız!',
    toastSearchNoResults: 'Sonuç bulunamadı', toastSearchFoundSuffix: 'bulundu',
    toastLangTr: 'Türkçe seçildi', toastLangEn: 'English selected',
    toastCancelConfirm: 'Randevuyu iptal etmek istediğinize emin misiniz?',
    rdvTelefonPlaceholder: '05XX XXX XX XX', rdvAltYada: 'Ya da',
    rdvAltTumunuGor: 'tüm randevularınızı görün.',
    heroBtn1: 'Hemen Randevu Al', heroBtn2: 'İşletmeleri Gör',
    heroLbl1: 'İşletme', heroLbl2: 'Hizmet', heroLbl3: 'Uzman',
    secIsletmeler: 'İşletmeler', secIsletmelerH2a: 'Hizmet Veren', secIsletmelerH2b: 'Merkezlerimiz',
    secIsletmelerP: 'Seçtiğiniz işletmede uygun saatte randevu alın',
    secHizmetler: 'Hizmetler', secHizmetlerH2a: 'Sunulan', secHizmetlerH2b: 'Hizmetler',
    secHizmetlerP: 'Tüm merkezlerdeki güncel fiyat ve süre bilgileri',
    filterTumu: 'Tümü', filterBerber: 'Berber', filterEpilasyon: 'Epilasyon',
    aramaPlaceholder: 'İşletme veya hizmet ara...', navFilterButton: 'Filtre',
    navAllBusinesses: 'Tüm İşletmeler', navAllServices: 'Tüm Hizmetler', navAllPrices: 'Tüm Fiyatlar',
    isletmeAramaPlaceholder: 'İşletme ara...', hizmetAramaPlaceholder: 'Hizmet ara...',
    kartRandevuAl: 'Randevu Al', kartDk: 'dk', kartBerber: 'Berber', kartEpilasyon: 'Epilasyon',
    sbRandevularim: 'Randevularım', sbProfilim: 'Profilim', sbAyarlar: 'Ayarlar',
    sbCikis: 'Çıkış Yap', sbCikisYap: 'Çıkış Yap', sbRandevuAl: 'Randevu Al', sbUye: 'Üye',
    rdvBaslik: 'Randevu Al', rdvAltBaslik: 'Adımları takip edin',
    girisBaslik: 'Hoş Geldiniz', girisAlt: 'Hesabınıza giriş yapın',
    kayitBaslik: 'Yeni Hesap', kayitAlt: 'Hızlıca kayıt olun',
    profilRandevuLbl: 'Randevu', profilOnaylananLbl: 'Onaylanan', profilSifreAciklama: '(boş = değişmez)',
    sbGirisYap: 'Giriş Yap', sbKayitOl: 'Kayıt Ol', randevuYok: 'Henüz randevunuz yok',
    randevuYokAcik: 'Henüz randevu almadınız.', rdvIsletme: 'İşletme', rdvHizmet: 'Hizmet',
    rdvUzman: 'Uzman', rdvNot: 'Not', rdvIptalEt: 'İptal Et', rdvYukleniyor: 'Yükleniyor...',
    rdvBekliyor: 'Bekliyor', rdvOnaylandi: 'Onaylandı', rdvTamamlandi: 'Tamamlandı', rdvIptal: 'İptal',
    rdvConfirmBtn: 'Randevuyu Onayla', rdvServiceChoose: 'Hizmet seçiniz', rdvStaffChoose: 'Uzman seçiniz',
    rdvTelefonLabel: 'Telefon', rdvServiceLabel: 'Hizmet Seçin', rdvStaffLabel: 'Uzman Seçin',
    rdvDateLabel: 'Tarih Seçin', rdvTimeLabel: 'Saat Seçin',
    rdvNoteLabel: 'Not (isteğe bağlı)', rdvNotePlaceholder: 'Eklemek istediğiniz notlar...',
    rdvNoServiceInBusiness: 'Bu işletmede henüz hizmet yok', rdvLoadFailed: 'Yüklenemedi',
    rdvAnyStaffFirstAvailable: 'Herhangi bir uzman (ilk müsait)', rdvPast: 'Geçmiş randevu',
    rdvTelGir: 'Randevularınızı görmek için telefon numaranızı girin.', rdvSorgula: 'Sorgula', rdvGirisYap: 'giriş yapın',
    profilimBaslik: 'Bilgilerimi Güncelle', profilAdLabel: 'Ad Soyad', profilEmailLabel: 'E-posta',
    profilSifreLabel: 'Yeni Şifre', profilGuncelleBtn: 'Güncelle', profilAdPlaceholder: 'Ad Soyad',
    profilEmailPlaceholder: 'email@ornek.com', profilSifrePlaceholder: 'En az 6 karakter',
    heroCard1Title: 'Saç Kesimi', heroCard1Sub: '30 dk • 150 ₺', heroCard2Title: 'Epilasyon',
    heroCard2Sub: '45 dk • 300 ₺', heroCard3Title: 'Randevu Onaylandı!', heroCard3Sub: 'Yarın 14:00',
    ayarlarTema: 'Tema', ayarlarDil: 'Dil / Language', temaAcik: 'Açık', temaKoyu: 'Koyu', temaSistem: 'Sistem',
    guncelMsg: 'Bilgileriniz güncellendi', kartHizmet: 'Hizmet', kartUzman: 'Uzman', kartDetay: 'Detay', kartRdvAl: 'Randevu Al', kartHaritadaGoster: 'Haritada Göster',
    detayHizmetler: 'Hizmetler', detayUzmanlar: 'Uzmanlar', detayRandevuAl: 'Bu İşletmede Randevu Al', detayHaritadaGoster: 'Haritada Göster',
    detayHizmetYok: 'Henüz hizmet eklenmemiş.', detayUzmanYok: 'Henüz çalışan eklenmemiş.',
    detayDk: 'dk', detayBerber: 'Berber', detayEpilasyon: 'Epilasyon', sonucBulunamadi: 'Sonuç bulunamadı', toastLocationMissing: 'Konum bilgisi bulunamadı',
  },  en: {
    navIsletmeler: 'Businesses', navHizmetler: 'Services',
    navGiris: 'Login', navKayit: 'Register', navRandevuAl: 'Book Now',
    heroBadge: 'MBX BARBER & BEAUTY', heroH1: 'MBX BARBER', heroH1Span: '& BEAUTY',
    heroP: 'Book with MBX BARBER & BEAUTY and choose the best time with our expert team.',
    toastFillAll: 'Fill in all fields!',
    toastPasswordMin: 'Password must be at least 6 characters!',
    toastPasswordMismatch: 'Passwords do not match!',
    toastServerError: 'Server error!',
    toastEnterCredentials: 'Enter your email and password!',
    toastLoginSuccess: 'Logged in successfully!',
    toastLogout: 'Signed out.',
    toastLoginRequired: 'Please log in to book an appointment!',
    toastEnterName: 'Enter your full name!',
    toastEnterPhone: 'Enter your phone number!',
    toastSelectBusiness: 'Select a business!',
    toastSelectService: 'Select a service!',
    toastSelectDate: 'Select a date!',
    toastSelectTime: 'Select a time!',
    toastAppointmentCreating: 'Creating your appointment...',
    toastPhoneRequired: 'Enter your phone number!',
    toastConnectionError: 'Connection error!',
    toastGeneralError: 'Something went wrong!',
    profilUpdating: 'Updating...',
    toastProfileRequired: 'Full name and email are required!',
    toastProfileUpdated: 'Profile updated!',
    toastProfileUpdateFailed: 'Update failed!',
    toastSearchNoResults: 'No results found',
    toastSearchFoundSuffix: 'found',
    toastLangTr: 'Turkish selected',
    toastLangEn: 'English selected',
    toastCancelConfirm: 'Are you sure you want to cancel this appointment?',
    rdvTelefonPlaceholder: '05XX XXX XX XX',
    rdvAltYada: 'Or',
    rdvAltTumunuGor: 'see all your appointments.',
    heroBtn1: 'Book Now', heroBtn2: 'View Businesses',
    heroLbl1: 'Business', heroLbl2: 'Service', heroLbl3: 'Expert',
    secIsletmeler: 'Businesses', secIsletmelerH2a: 'Our Service', secIsletmelerH2b: 'Centers',
    secIsletmelerP: 'Choose a business and book at the right time',
    secHizmetler: 'Services', secHizmetlerH2a: 'Available', secHizmetlerH2b: 'Services',
    secHizmetlerP: 'Current prices and durations across all centers',
    filterTumu: 'All', filterBerber: 'Barber', filterEpilasyon: 'Epilation',
    aramaPlaceholder: 'Search business or service...',
    navFilterButton: 'Filter',
    navAllBusinesses: 'All Businesses',
    navAllServices: 'All Services',
    navAllPrices: 'All Prices',
    isletmeAramaPlaceholder: 'Search business...', hizmetAramaPlaceholder: 'Search service...',
    kartRandevuAl: 'Book Now', kartDk: 'min', kartBerber: 'Barber', kartEpilasyon: 'Epilation',
    sbRandevularim: 'My Appointments', sbProfilim: 'My Profile', sbAyarlar: 'Settings',
    sbCikis: 'Sign Out', sbCikisYap: 'Sign Out', sbRandevuAl: 'Book Now', sbUye: 'Member',
    profilRandevuLbl: 'Appointments', profilOnaylananLbl: 'Approved',
    profilSifreAciklama: '(empty = unchanged)',
    rdvBaslik: 'Book Appointment', rdvAltBaslik: 'Follow the steps',
    girisBaslik: 'Welcome Back', girisAlt: 'Sign in to your account',
    kayitBaslik: 'New Account', kayitAlt: 'Register quickly',
    sbGirisYap: 'Login', sbKayitOl: 'Register',
    randevuYok: 'No appointments yet', randevuYokAcik: 'You have no appointments.',
    rdvIsletme: 'Business', rdvHizmet: 'Service', rdvUzman: 'Staff', rdvNot: 'Note',
    rdvIptalEt: 'Cancel', rdvYukleniyor: 'Loading...',
    rdvBekliyor: 'Pending', rdvOnaylandi: 'Approved', rdvTamamlandi: 'Completed', rdvIptal: 'Cancelled',
    rdvConfirmBtn: 'Confirm Appointment',
    rdvServiceChoose: 'Select service',
    rdvStaffChoose: 'Select specialist',
    rdvTelefonLabel: 'Telephone', rdvServiceLabel: 'Choose Service', rdvStaffLabel: 'Choose Staff',
    rdvDateLabel: 'Choose Date', rdvTimeLabel: 'Choose Time',
    rdvNoteLabel: 'Note (optional)', rdvNotePlaceholder: 'Notes you want to add...',
    rdvNoServiceInBusiness: 'No services available in this business',
    rdvLoadFailed: 'Could not load',
    rdvAnyStaffFirstAvailable: 'Any specialist (first available)',
    rdvPast: 'Past appointment',
    rdvTelGir: 'Enter your phone number to view your appointments.',
    rdvSorgula: 'Search', rdvGirisYap: 'log in',
    profilimBaslik: 'Update My Info', profilAdLabel: 'Full Name',
    profilEmailLabel: 'Email', profilSifreLabel: 'New Password', profilGuncelleBtn: 'Update',
    profilAdPlaceholder: 'Full Name', profilEmailPlaceholder: 'email@example.com', profilSifrePlaceholder: 'At least 6 characters',
    heroCard1Title: 'Haircut', heroCard1Sub: '30 min • 150 ₺',
    heroCard2Title: 'Epilation', heroCard2Sub: '45 min • 300 ₺',
    heroCard3Title: 'Appointment Approved!', heroCard3Sub: 'Tomorrow 14:00',
    ayarlarTema: 'Theme', ayarlarDil: 'Language',
    temaAcik: 'Light', temaKoyu: 'Dark', temaSistem: 'System',
    guncelMsg: 'Your information has been updated',
    kartHizmet: 'Service', kartUzman: 'Staff', kartDetay: 'Details', kartRdvAl: 'Book Now', kartHaritadaGoster: 'Show Map',
    detayHizmetler: 'Services', detayUzmanlar: 'Staff',
    detayRandevuAl: 'Book at This Business', detayHaritadaGoster: 'Show on Map',
    detayHizmetYok: 'No services added yet.', detayUzmanYok: 'No staff added yet.',
    detayDk: 'min', detayBerber: 'Barber', detayEpilasyon: 'Epilation',
    sonucBulunamadi: 'No results found', toastLocationMissing: 'Location info is missing',
  }
};
let currentLang = localStorage.getItem('lang') || 'tr';

function L(key, fallback = '') {
    const dict = APP_LANGS[currentLang] || APP_LANGS['tr'];
    return fixText(dict[key] || fallback || key);
}

function toast(key, type = 'success', fallback = '') {
    showToast(L(key, fallback), type);
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyLang(lang);
    const trBtn = document.getElementById('langTR');
    const enBtn = document.getElementById('langEN');
    if (trBtn) trBtn.classList.toggle('active', lang === 'tr');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');
    const toastKey = lang === 'tr' ? 'toastLangTr' : 'toastLangEn';
    showToast(L(toastKey), 'success');
}

function applyLang(lang) {
    const d = APP_LANGS[lang] || APP_LANGS['tr'];
    document.documentElement.lang = lang === 'en' ? 'en' : 'tr';

    // data-lang attribute'u olan tüm elementleri güncelle
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (d[key] !== undefined) el.textContent = fixText(d[key]);
    });

    document.querySelectorAll('[data-lang-ph]').forEach(el => {
        const key = el.getAttribute('data-lang-ph');
        if (d[key] !== undefined) el.placeholder = fixText(d[key]);
    });

    // Özel durumlar (data-lang ile çözülemeyen HTML içerikli elementler)

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
    if (el('navArama'))     el('navArama').placeholder     = L('aramaPlaceholder', 'İşletme veya hizmet ara...');
    if (el('isletmeArama')) el('isletmeArama').placeholder = d.isletmeAramaPlaceholder;
    if (el('hizmetArama'))  el('hizmetArama').placeholder  = d.hizmetAramaPlaceholder;
    if (el('navIsletmeFilter') && el('navIsletmeFilter').options[0]) {
        el('navIsletmeFilter').options[0].text = L('navAllBusinesses', 'Tüm İşletmeler');
    }
    if (el('navHizmetFilter') && el('navHizmetFilter').options[0]) {
        el('navHizmetFilter').options[0].text = L('navAllServices', 'Tüm Hizmetler');
    }
    if (el('navFiyatFilter')) {
        const pf = el('navFiyatFilter');
        if (pf.options[0]) pf.options[0].text = L('navAllPrices', 'Tüm Fiyatlar');
        if (pf.options[1]) pf.options[1].text = '0 - 200 ₺';
        if (pf.options[2]) pf.options[2].text = '200 - 400 ₺';
        if (pf.options[3]) pf.options[3].text = '400+ ₺';
    }

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
    const heroActionBtns = document.querySelectorAll('.hero-actions .hero-action');
    if (heroActionBtns[0]) heroActionBtns[0].innerHTML = `<i class="fas fa-calendar-plus me-2"></i>${d.heroBtn1}`;
    if (heroActionBtns[1]) heroActionBtns[1].innerHTML = `<i class="fas fa-store me-2"></i>${d.heroBtn2}`;

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
    if (iF[1]) iF[1].innerHTML = `<i class="fas fa-cut me-1"></i>${d.filterBerber}`;
    if (iF[2]) iF[2].innerHTML = `<i class="fas fa-spa me-1"></i>${d.filterEpilasyon}`;
    const hF = document.querySelectorAll('#hizmetler .filter-btn');
    if (hF[0]) hF[0].textContent = d.filterTumu;
    if (hF[1]) hF[1].textContent = d.filterBerber;
    if (hF[2]) hF[2].textContent = d.filterEpilasyon;

    // Randevularım modal başlığı
    const rdvTitle = document.querySelector('#randevularimModal .modal-title');
    if (rdvTitle) rdvTitle.innerHTML = `<i class="fas fa-calendar-alt me-2 text-primary"></i>${d.sbRandevularim}`;
    const rdvModal = document.getElementById('randevularimModal');
    if (rdvModal && rdvModal.classList.contains('show') && lastRandevularimList.length) {
        renderRandevularim(lastRandevularimList);
    }

    // Profil form placeholder'ları
    if (el('profilAdInput')) el('profilAdInput').placeholder = d.profilAdPlaceholder;
    if (el('profilEmailInput')) el('profilEmailInput').placeholder = d.profilEmailPlaceholder;
    if (el('profilSifreInput')) el('profilSifreInput').placeholder = d.profilSifrePlaceholder;
    if (el('rTarih')) el('rTarih').setAttribute('lang', lang === 'en' ? 'en' : 'tr');
    setupAppointmentDatePicker(lang);
    const rSubmitBtn = el('rSubmitBtn');
    if (rSubmitBtn) rSubmitBtn.innerHTML = `<i class="fas fa-check-circle me-2"></i>${d.rdvConfirmBtn}`;

    // Hero sağ kart metinleri
    const heroCard1Title = document.getElementById('heroCard1Title');
    const heroCard1Sub = document.getElementById('heroCard1Sub');
    const heroCard2Title = document.getElementById('heroCard2Title');
    const heroCard2Sub = document.getElementById('heroCard2Sub');
    const heroCard3Title = document.getElementById('heroCard3Title');
    const heroCard3Sub = document.getElementById('heroCard3Sub');
    if (heroCard1Title) heroCard1Title.textContent = d.heroCard1Title;
    if (heroCard1Sub) heroCard1Sub.textContent = d.heroCard1Sub;
    if (heroCard2Title) heroCard2Title.textContent = d.heroCard2Title;
    if (heroCard2Sub) heroCard2Sub.textContent = d.heroCard2Sub;
    if (heroCard3Title) heroCard3Title.textContent = d.heroCard3Title;
    if (heroCard3Sub) heroCard3Sub.textContent = d.heroCard3Sub;

    // Hizmet kartlarını yeniden render et
    if (allHizmetler.length) renderHizmetler(allHizmetler);
    if (allIsletmeler.length) renderIsletmeler(allIsletmeler);
    populateNavIsletmeFilter();
    populateNavHizmetFilter();
    repairMojibakeInDOM();
    autoTranslateAppDom(document.body);
    refreshCurrentUserLabels();
}













