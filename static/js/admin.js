// =====================================================
// ADMİN PANELİ — admin.js  (Bootstrap versiyonu)
// =====================================================

let ISLETMELER = [];
let TUM_RANDEVULAR = [];

// ─────────────────────────────────────────────────────
// BAŞLAT
// ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const r = await fetch('/api/admin/oturum');
    const d = await r.json();
    if (!d.success) { window.location.href = '/giris'; return; }
    document.getElementById('adminAd').textContent = '👤 ' + d.ad;
    // Sidebar kullanıcı adı
    const sb = document.getElementById('sidebarAd');
    if (sb) sb.textContent = d.ad;
    const av = document.getElementById('sidebarAvatar');
    if (av) av.textContent = (d.ad[0] || 'A').toUpperCase();
    // Profil verisi
    if (typeof PROFIL_DATA !== 'undefined') {
      PROFIL_DATA.ad    = d.ad;
      PROFIL_DATA.email = d.email || '';
    }
  } catch {
    window.location.href = '/giris';
    return;
  }
  await fetchIsletmeler();
  loadStats();
  loadSonRandevular();
});

// ─────────────────────────────────────────────────────
// İSTATİSTİKLER
// ─────────────────────────────────────────────────────
async function loadStats() {
  try {
    const d = await api('/api/admin/istatistikler');
    if (d.success) {
      const s = d.stats;
      setEl('sIsletme',  s.isletme);
      setEl('sCalisan',  s.calisan);
      setEl('sHizmet',   s.hizmet);
      setEl('sToplam',   s.toplam_randevu);
      setEl('sBekleyen', s.bekleyen);
      setEl('sOnaylanan',s.onaylanan);
    }
  } catch {}
}

// ─────────────────────────────────────────────────────
// İŞLETMELER
// ─────────────────────────────────────────────────────
async function fetchIsletmeler() {
  try {
    const d = await api('/api/admin/isletmeler');
    if (d.success) ISLETMELER = d.isletmeler;
  } catch {}
}

async function loadIsletmeler() {
  await fetchIsletmeler();
  renderIsletmeler();
  fillSel(['hIsletme','hizmetIsletmeFilter','cIsletme','calisanIsletmeFilter','rIsletmeFilter']);
}

function renderIsletmeler() {
  const tb = document.getElementById('isletmelerBody');
  if (!tb) return;
  if (!ISLETMELER.length) {
    tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Henüz işletme eklenmemiş</td></tr>';
    return;
  }
  tb.innerHTML = ISLETMELER.map(i => `
    <tr>
      <td><b>#${i.id}</b></td>
      <td><b>${i.ad}</b></td>
      <td><span class="badge-tur ${i.tur}">${i.tur === 'berber' ? '✂️ Berber' : '✨ Epilasyon'}</span></td>
      <td>${i.telefon || '–'}</td>
      <td><span class="badge bg-secondary bg-opacity-10 text-secondary">${i.hizmet_sayisi || 0}</span></td>
      <td><span class="badge bg-secondary bg-opacity-10 text-secondary">${i.calisan_sayisi || 0}</span></td>
      <td>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" ${i.aktif ? 'checked' : ''}
            onchange="toggleIsletme(${i.id}, this.checked)">
        </div>
      </td>
      <td>
        <button class="btn-icon" onclick="editIsletme(${i.id})" title="Düzenle"><i class="fas fa-edit text-primary"></i></button>
        <button class="btn-icon danger" onclick="silIsletme(${i.id})" title="Sil" style="margin-left:4px"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

async function isletmeEkle() {
  const ad = v('iAd'), tur = v('iTur'), tel = v('iTel'), adres = v('iAdres'), acik = v('iAciklama');
  if (!ad || !tur) { showToast('Ad ve tür zorunludur!', 'error'); return; }
  const r = await api('/api/admin/isletme-ekle', 'POST', { ad, tur, telefon: tel, adres, aciklama: acik });
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) {
    ['iAd','iTel','iAdres','iAciklama'].forEach(x => { const el = document.getElementById(x); if(el) el.value=''; });
    await loadIsletmeler();
    loadStats();
  }
}

function editIsletme(id) {
  const i = ISLETMELER.find(x => x.id === id);
  if (!i) return;
  openEditModal(`
    <h5 class="fw-bold mb-3"><i class="fas fa-edit me-2 text-primary"></i>İşletme Düzenle <small class="text-muted">#${i.id}</small></h5>
    <div class="row g-3">
      <div class="col-6"><label class="form-label small fw-600">Ad *</label><input class="form-control" id="ei_ad" value="${escHtml(i.ad)}"></div>
      <div class="col-6"><label class="form-label small fw-600">Tür</label>
        <select class="form-select" id="ei_tur">
          <option value="berber" ${i.tur==='berber'?'selected':''}>✂️ Berber</option>
          <option value="epilasyon" ${i.tur==='epilasyon'?'selected':''}>✨ Epilasyon</option>
        </select>
      </div>
      <div class="col-6"><label class="form-label small fw-600">Telefon</label><input class="form-control" id="ei_tel" value="${i.telefon||''}"></div>
      <div class="col-6"><label class="form-label small fw-600">Adres</label><input class="form-control" id="ei_adres" value="${i.adres||''}"></div>
      <div class="col-12"><label class="form-label small fw-600">Açıklama</label><input class="form-control" id="ei_acik" value="${i.aciklama||''}"></div>
    </div>
    <div class="d-flex gap-2 mt-3 justify-content-end">
      <button class="btn btn-secondary btn-sm" onclick="closeEditModal()">İptal</button>
      <button class="btn btn-brand btn-sm" onclick="saveIsletme(${i.id})"><i class="fas fa-save me-1"></i>Kaydet</button>
    </div>
  `);
}

async function saveIsletme(id) {
  const payload = { ad:v('ei_ad'), tur:v('ei_tur'), telefon:v('ei_tel'), adres:v('ei_adres'), aciklama:v('ei_acik'), aktif:true };
  if (!payload.ad) { showToast('Ad zorunlu!', 'error'); return; }
  const r = await api(`/api/admin/isletme-guncelle/${id}`, 'PUT', payload);
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { closeEditModal(); await loadIsletmeler(); }
}

async function toggleIsletme(id, aktif) {
  const i = ISLETMELER.find(x => x.id === id);
  if (!i) return;
  await api(`/api/admin/isletme-guncelle/${id}`, 'PUT', { ...i, aktif });
  i.aktif = aktif;
  showToast(`İşletme ${aktif ? 'aktif' : 'pasif'} edildi`, 'success');
  loadStats();
}

async function silIsletme(id) {
  const i = ISLETMELER.find(x => x.id === id);
  if (!confirm(`"${i?.ad}" silinsin mi?\nTüm hizmet ve çalışanlar da silinecek!`)) return;
  const r = await api(`/api/admin/isletme-sil/${id}`, 'DELETE');
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { await loadIsletmeler(); loadStats(); }
}

// ─────────────────────────────────────────────────────
// HİZMETLER
// ─────────────────────────────────────────────────────
async function loadHizmetler() {
  const iid = document.getElementById('hizmetIsletmeFilter')?.value || '';
  const tb  = document.getElementById('hizmetlerBody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Yükleniyor...</td></tr>';
  const url = iid ? `/api/admin/hizmetler?isletme_id=${iid}` : '/api/admin/hizmetler';
  const d   = await api(url);
  if (!d.success) { tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Hata!</td></tr>'; return; }
  if (!d.hizmetler.length) { tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Hizmet bulunamadı</td></tr>'; return; }
  tb.innerHTML = d.hizmetler.map(h => `
    <tr>
      <td><b>#${h.id}</b></td>
      <td>${h.isletme_adi || '–'}</td>
      <td><b>${escHtml(h.ad)}</b></td>
      <td><span class="badge-tur ${h.kategori}">${h.kategori === 'berber' ? '✂️ Berber' : '✨ Epilasyon'}</span></td>
      <td>${h.sure} dk</td>
      <td><b>${parseFloat(h.ucret).toLocaleString('tr-TR')} ₺</b></td>
      <td>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" ${h.aktif ? 'checked' : ''}
            onchange="toggleHizmet(${h.id}, this.checked)">
        </div>
      </td>
      <td>
        <button class="btn-icon" onclick="editHizmet(${h.id})" title="Düzenle"><i class="fas fa-edit text-primary"></i></button>
        <button class="btn-icon danger" onclick="silHizmet(${h.id})" title="Sil" style="margin-left:4px"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  // İşletme filter doldur
  fillSel(['hizmetIsletmeFilter']);
}

async function hizmetEkle() {
  const iid = v('hIsletme'), ad = v('hAd'), kat = v('hKategori'), sure = v('hSure'), ucret = v('hUcret');
  if (!iid || !ad || !sure) { showToast('İşletme, ad ve süre zorunludur!', 'error'); return; }
  const r = await api('/api/admin/hizmet-ekle', 'POST', { isletme_id: iid, ad, kategori: kat, sure: parseInt(sure), ucret: parseFloat(ucret) || 0 });
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { ['hAd','hSure','hUcret'].forEach(x => { const el = document.getElementById(x); if(el) el.value=''; }); loadHizmetler(); loadStats(); }
}

async function editHizmet(id) {
  const d = await api('/api/admin/hizmetler');
  const h = d.hizmetler?.find(x => x.id === id);
  if (!h) return;
  openEditModal(`
    <h5 class="fw-bold mb-3"><i class="fas fa-cut me-2 text-primary"></i>Hizmet Düzenle <small class="text-muted">#${id}</small></h5>
    <div class="row g-3">
      <div class="col-12"><label class="form-label small fw-600">Hizmet Adı *</label><input class="form-control" id="eh_ad" value="${escHtml(h.ad)}"></div>
      <div class="col-6"><label class="form-label small fw-600">Kategori</label>
        <select class="form-select" id="eh_kat">
          <option value="berber" ${h.kategori==='berber'?'selected':''}>✂️ Berber</option>
          <option value="epilasyon" ${h.kategori==='epilasyon'?'selected':''}>✨ Epilasyon</option>
        </select>
      </div>
      <div class="col-3"><label class="form-label small fw-600">Süre (dk)</label><input class="form-control" type="number" id="eh_sure" value="${h.sure}" min="5"></div>
      <div class="col-3"><label class="form-label small fw-600">Ücret (₺)</label><input class="form-control" type="number" id="eh_ucret" value="${h.ucret}" min="0"></div>
    </div>
    <div class="d-flex gap-2 mt-3 justify-content-end">
      <button class="btn btn-secondary btn-sm" onclick="closeEditModal()">İptal</button>
      <button class="btn btn-brand btn-sm" onclick="saveHizmet(${id})"><i class="fas fa-save me-1"></i>Kaydet</button>
    </div>
  `);
}

async function saveHizmet(id) {
  const payload = { ad:v('eh_ad'), kategori:v('eh_kat'), sure:parseInt(v('eh_sure')), ucret:parseFloat(v('eh_ucret'))||0, aktif:true };
  if (!payload.ad) { showToast('Ad zorunlu!', 'error'); return; }
  const r = await api(`/api/admin/hizmet-guncelle/${id}`, 'PUT', payload);
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { closeEditModal(); loadHizmetler(); }
}

async function toggleHizmet(id, aktif) {
  const d = await api('/api/admin/hizmetler');
  const h = d.hizmetler?.find(x => x.id === id);
  if (!h) return;
  await api(`/api/admin/hizmet-guncelle/${id}`, 'PUT', { ...h, aktif });
  showToast(`Hizmet ${aktif ? 'aktif' : 'pasif'} edildi`, 'success');
}

async function silHizmet(id) {
  if (!confirm('Hizmeti silmek istiyor musunuz?')) return;
  const r = await api(`/api/admin/hizmet-sil/${id}`, 'DELETE');
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { loadHizmetler(); loadStats(); }
}

// ─────────────────────────────────────────────────────
// ÇALIŞANLAR
// ─────────────────────────────────────────────────────
async function loadCalisanlar() {
  const iid = document.getElementById('calisanIsletmeFilter')?.value || '';
  const tb  = document.getElementById('calisanlarBody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="7" class="tbl-empty">Yükleniyor...</td></tr>';
  const url = iid ? `/api/admin/calisanlar?isletme_id=${iid}` : '/api/admin/calisanlar';
  const d   = await api(url);
  if (!d.success) { tb.innerHTML = '<tr><td colspan="7" class="tbl-empty">Hata!</td></tr>'; return; }
  if (!d.calisanlar.length) { tb.innerHTML = '<tr><td colspan="7" class="tbl-empty">Çalışan bulunamadı</td></tr>'; return; }
  tb.innerHTML = d.calisanlar.map(c => `
    <tr>
      <td><b>#${c.id}</b></td>
      <td>${c.isletme_adi || '–'}</td>
      <td><b>${escHtml(c.ad)}</b></td>
      <td><span class="badge-tur ${c.uzmanlik}">${c.uzmanlik === 'berber' ? '✂️ Berber' : '✨ Epilasyon'}</span></td>
      <td>${c.telefon || '–'}</td>
      <td>
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" ${c.aktif ? 'checked' : ''}
            onchange="toggleCalisan(${c.id}, this.checked)">
        </div>
      </td>
      <td>
        <button class="btn-icon" onclick="editCalisan(${c.id})" title="Düzenle"><i class="fas fa-edit text-primary"></i></button>
        <button class="btn-icon danger" onclick="silCalisan(${c.id})" title="Sil" style="margin-left:4px"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  fillSel(['calisanIsletmeFilter']);
}

async function calisanEkle() {
  const iid = v('cIsletme'), ad = v('cAd'), uzm = v('cUzmanlik'), tel = v('cTel');
  if (!iid || !ad) { showToast('İşletme ve ad zorunludur!', 'error'); return; }
  const r = await api('/api/admin/calisan-ekle', 'POST', { isletme_id: iid, ad, uzmanlik: uzm, telefon: tel });
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { ['cAd','cTel'].forEach(x => { const el = document.getElementById(x); if(el) el.value=''; }); loadCalisanlar(); loadStats(); }
}

async function editCalisan(id) {
  const d = await api('/api/admin/calisanlar');
  const c = d.calisanlar?.find(x => x.id === id);
  if (!c) return;
  openEditModal(`
    <h5 class="fw-bold mb-3"><i class="fas fa-user-edit me-2 text-primary"></i>Çalışan Düzenle <small class="text-muted">#${id}</small></h5>
    <div class="row g-3">
      <div class="col-12"><label class="form-label small fw-600">Ad Soyad *</label><input class="form-control" id="ec_ad" value="${escHtml(c.ad)}"></div>
      <div class="col-6"><label class="form-label small fw-600">Uzmanlık</label>
        <select class="form-select" id="ec_uzm">
          <option value="berber" ${c.uzmanlik==='berber'?'selected':''}>✂️ Berber</option>
          <option value="epilasyon" ${c.uzmanlik==='epilasyon'?'selected':''}>✨ Epilasyon</option>
        </select>
      </div>
      <div class="col-6"><label class="form-label small fw-600">Telefon</label><input class="form-control" id="ec_tel" value="${c.telefon||''}"></div>
    </div>
    <div class="d-flex gap-2 mt-3 justify-content-end">
      <button class="btn btn-secondary btn-sm" onclick="closeEditModal()">İptal</button>
      <button class="btn btn-brand btn-sm" onclick="saveCalisan(${id})"><i class="fas fa-save me-1"></i>Kaydet</button>
    </div>
  `);
}

async function saveCalisan(id) {
  const payload = { ad:v('ec_ad'), uzmanlik:v('ec_uzm'), telefon:v('ec_tel'), aktif:true };
  if (!payload.ad) { showToast('Ad zorunlu!', 'error'); return; }
  const r = await api(`/api/admin/calisan-guncelle/${id}`, 'PUT', payload);
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { closeEditModal(); loadCalisanlar(); }
}

async function toggleCalisan(id, aktif) {
  const d = await api('/api/admin/calisanlar');
  const c = d.calisanlar?.find(x => x.id === id);
  if (!c) return;
  await api(`/api/admin/calisan-guncelle/${id}`, 'PUT', { ...c, aktif });
  showToast(`Çalışan ${aktif ? 'aktif' : 'pasif'} edildi`, 'success');
}

async function silCalisan(id) {
  if (!confirm('Çalışanı silmek istiyor musunuz?')) return;
  const r = await api(`/api/admin/calisan-sil/${id}`, 'DELETE');
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { loadCalisanlar(); loadStats(); }
}

// ─────────────────────────────────────────────────────
// RANDEVULAR
// ─────────────────────────────────────────────────────
async function loadSonRandevular() {
  const d = await api('/api/admin/tum-randevular');
  if (d.success) renderDashRandevu(d.randevular.slice(0, 10));
}

function renderDashRandevu(list) {
  const tb = document.getElementById('sonRandevularBody');
  if (!tb) return;
  if (!list.length) { tb.innerHTML = '<tr><td colspan="5" class="tbl-empty">🎉 Randevu yok</td></tr>'; return; }
  tb.innerHTML = list.map(r => `
    <tr>
      <td><b>${r.tarih}</b> ${r.saat}</td>
      <td>${escHtml(r.musteri_adi)}</td>
      <td>${r.isletme_adi || '–'}</td>
      <td>${r.hizmet_adi  || '–'}</td>
      <td>${durumBadge(r.durum)}</td>
    </tr>
  `).join('');
}

async function loadRandevular() {
  const tb = document.getElementById('randevularBody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">Yükleniyor...</td></tr>';
  const d = await api('/api/admin/tum-randevular');
  if (d.success) { TUM_RANDEVULAR = d.randevular; filtreleRandevular(); }
  fillSel(['rIsletmeFilter']);
}

function filtreleRandevular() {
  const dur = document.getElementById('rDurumFilter')?.value   || '';
  const iid = document.getElementById('rIsletmeFilter')?.value || '';
  const tar = document.getElementById('rTarihFilter')?.value   || '';
  let list  = [...TUM_RANDEVULAR];
  if (dur) list = list.filter(r => r.durum === dur);
  if (iid) list = list.filter(r => r.isletme_adi === iid);
  if (tar) list = list.filter(r => r.tarih === tar);
  renderRandevular(list);
}

function filtreleriTemizle() {
  ['rDurumFilter','rTarihFilter'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const ri = document.getElementById('rIsletmeFilter'); if (ri) ri.value = '';
  document.getElementById('randevuSearchInput') && (document.getElementById('randevuSearchInput').value = '');
  renderRandevular(TUM_RANDEVULAR);
}

function renderRandevular(list) {
  const tb = document.getElementById('randevularBody');
  if (!tb) return;
  if (!list.length) { tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">Randevu bulunamadı</td></tr>'; return; }
  tb.innerHTML = list.map(r => `
    <tr>
      <td><b>${r.tarih}</b></td>
      <td>${r.saat}</td>
      <td><b>${escHtml(r.musteri_adi)}</b></td>
      <td><small>${r.musteri_telefon}</small></td>
      <td>${r.isletme_adi || '–'}</td>
      <td>${r.hizmet_adi  || '–'}</td>
      <td>${r.calisan_adi || '–'}</td>
      <td>
        <select class="form-select form-select-sm" style="font-size:.75rem;padding:3px 8px;min-width:110px" onchange="durumGuncelle(${r.id}, this.value)">
          <option value="bekliyor"   ${r.durum==='bekliyor'   ?'selected':''}>⏳ Bekliyor</option>
          <option value="onaylandi"  ${r.durum==='onaylandi'  ?'selected':''}>✅ Onaylandı</option>
          <option value="tamamlandi" ${r.durum==='tamamlandi' ?'selected':''}>🎉 Tamamlandı</option>
          <option value="iptal"      ${r.durum==='iptal'      ?'selected':''}>❌ İptal</option>
        </select>
      </td>
      <td>
        <button class="btn-icon" onclick="randevuDetay(${r.id})" title="Detay"><i class="fas fa-eye text-primary"></i></button>
      </td>
    </tr>
  `).join('');
}

async function durumGuncelle(id, durum) {
  const r = await api(`/api/admin/randevu-durum-guncelle/${id}`, 'POST', { durum });
  showToast(r.message, r.success ? 'success' : 'error');
  if (r.success) { loadStats(); loadSonRandevular(); }
}

function randevuDetay(id) {
  const r = TUM_RANDEVULAR.find(x => x.id === id);
  if (!r) return;
  openEditModal(`
    <h5 class="fw-bold mb-3"><i class="fas fa-calendar-check me-2 text-primary"></i>Randevu Detayı <small class="text-muted">#${r.id}</small></h5>
    <table class="table table-sm table-bordered">
      <tbody>
        <tr><th width="120">Müşteri</th><td>${escHtml(r.musteri_adi)}</td></tr>
        <tr><th>Telefon</th><td>${r.musteri_telefon}</td></tr>
        <tr><th>İşletme</th><td>${r.isletme_adi || '–'}</td></tr>
        <tr><th>Hizmet</th><td>${r.hizmet_adi  || '–'}</td></tr>
        <tr><th>Çalışan</th><td>${r.calisan_adi || '–'}</td></tr>
        <tr><th>Tarih/Saat</th><td><b>${r.tarih} ${r.saat}</b></td></tr>
        <tr><th>Durum</th><td>${durumBadge(r.durum)}</td></tr>
        ${r.notlar ? `<tr><th>Not</th><td>${r.notlar}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="text-end"><button class="btn btn-secondary btn-sm" onclick="closeEditModal()">Kapat</button></div>
  `);
}

function durumBadge(d) {
  const map = { bekliyor:'warning', onaylandi:'success', tamamlandi:'primary', iptal:'danger' };
  const ico = { bekliyor:'⏳', onaylandi:'✅', tamamlandi:'🎉', iptal:'❌' };
  return `<span class="badge bg-${map[d]||'secondary'} bg-opacity-15 text-${map[d]||'secondary'}">${ico[d]||''} ${d}</span>`;
}

// ─────────────────────────────────────────────────────
// YARDIMCILAR
// ─────────────────────────────────────────────────────
function fillSel(ids) {
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur     = sel.value;
    const isFilter = id.includes('Filter') || id.includes('Filt') || id === 'rIsletme';
    sel.innerHTML = isFilter ? '<option value="">Tüm İşletmeler</option>' : '<option value="">-- Seçin --</option>';
    ISLETMELER.forEach(i => {
      const o = document.createElement('option');
      o.value = (id === 'rIsletmeFilter') ? i.ad : i.id;
      o.textContent = i.ad;
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  });
}

async function api(url, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    return await r.json();
  } catch {
    return { success: false, message: 'Sunucu hatası!' };
  }
}

function v(id) { return document.getElementById(id)?.value?.trim() || ''; }
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '–'; }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }