// ════════════════════════════════════════════════════════
// GLOBAL
// ════════════════════════════════════════════════════════
var SES = {};
var ISLETMELER = [];
var IP_LANG_CURRENT = localStorage.getItem('isletmeLang') || 'tr';

var BERBER_SABLONLAR = [
  {ad:'Saç Kesimi',sure:30,ucret:150},
  {ad:'Sakal Tıraşı',sure:20,ucret:100},
  {ad:'Saç + Sakal',sure:45,ucret:230},
  {ad:'Çocuk Saç Kesimi',sure:20,ucret:100},
  {ad:'Bıyık Şekillendirme',sure:15,ucret:80},
  {ad:'Saç Boyama',sure:60,ucret:350},
  {ad:'Fön',sure:20,ucret:120}
];

var EPILASYON_SABLONLAR = [
  {ad:'Bacak Epilasyon',sure:45,ucret:400},
  {ad:'Koltuk Altı Epilasyon',sure:20,ucret:200},
  {ad:'Bikini Epilasyon',sure:30,ucret:300},
  {ad:'Yüz Epilasyon',sure:20,ucret:200},
  {ad:'Tam Vücut Epilasyon',sure:90,ucret:900},
  {ad:'Üst Dudak',sure:10,ucret:120},
  {ad:'Kaş Şekillendirme',sure:15,ucret:150}
];

var TAB_TITLES = {
  dashboard:'Dashboard',
  randevular:'Randevular',
  calisanlar:'Çalışanlar',
  hizmetler:'Hizmetler & Fiyatlar',
  saatler:'Çalışma Saatleri & Tatiller',
  isletme:'İşletme Bilgileri',
  profil:'Profilim',
  ayarlar:'Ayarlar'
};

// ════════════════════════════════════════════════════════
// BAŞLAT
// ════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async function() {
  ensureMapFields();
  applyResponsiveTableLabels();
  initResponsiveTableObserver();
  try {
    var r = await api('/api/oturum');
    if (!r.success) { window.location.href='/giris'; return; }
    SES = r;

    document.getElementById('yoneticiAd').textContent = r.ad || '';
    document.getElementById('sbIsletmeAdi').textContent = r.isletme_adi || (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tumIsletmeler;
    // Sidebar footer güncelle
    var sbAv = document.getElementById('sbAvatarIp');
    if (sbAv) sbAv.textContent = (r.ad||'?')[0].toUpperCase();
    var sbYad = document.getElementById('sbYoneticiAd');
    if (sbYad) sbYad.textContent = r.ad || '—';
    var sbIad = document.getElementById('sbIsletmeAdiKucuk');
    if (sbIad) sbIad.textContent = r.isletme_adi || '—';

    // İşletme türüne göre UI ayarla
    var tur = r.isletme_tur || '';
    if (tur === 'berber') {
      document.getElementById('sbLogoIcon').textContent = '✂️';
      document.getElementById('sbTurBadge').textContent = (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).berberSalonuBadge;
      document.getElementById('navHizmetIcon').textContent = '✂️';
      document.getElementById('dashHizmetIco').textContent = '✂️';
      buildSablonlar(BERBER_SABLONLAR);
    } else if (tur === 'epilasyon') {
      document.getElementById('sbLogoIcon').textContent = '✨';
      document.getElementById('sbTurBadge').textContent = (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).epilasyonMerkeziBadge;
      document.getElementById('navHizmetIcon').textContent = '✨';
      document.getElementById('dashHizmetIco').textContent = '✨';
      document.getElementById('hizmetlerTitle').textContent = '✨ Hizmetler & Fiyatlar';
      // Epilasyon için kategori varsayılanı
      var hKatSel = document.getElementById('hKat');
      if (hKatSel) hKatSel.value = 'epilasyon';
      buildSablonlar(EPILASYON_SABLONLAR);
    } else {
      document.getElementById('sbTurBadge').textContent = '';
      buildSablonlar(BERBER_SABLONLAR.concat(EPILASYON_SABLONLAR));
    }

    // Süper admin: bazı tabları gizle
    if (r.super_admin) {
      document.getElementById('navSaatler').style.display = 'none';
      document.getElementById('navIsletme').style.display = 'none';
      await loadIsletmelerList();
    }

    await loadStats();

    // Önce dili uygula, sonra dashboard yükle — böylece mesajlar doğru dilde çıkar
    if (IP_LANG_CURRENT !== 'tr') {
      applyIpLang(IP_LANG_CURRENT);
    }

    await loadDashRandevular();

  } catch(e) {
    window.location.href = '/giris';
  }
});

function applyResponsiveTableLabels() {
  document.querySelectorAll('.tbl-wrap table').forEach(function(table) {
    var headers = Array.from(table.querySelectorAll('thead th')).map(function(th) {
      return (th.textContent || '').trim();
    });
    table.querySelectorAll('tbody tr').forEach(function(tr) {
      var cells = Array.from(tr.children).filter(function(node) {
        return node.tagName === 'TD';
      });
      if (!cells.length) return;
      if (cells.length === 1 && cells[0].classList.contains('tbl-empty')) return;
      cells.forEach(function(td, index) {
        td.setAttribute('data-label', headers[index] || '');
      });
    });
  });
}

function initResponsiveTableObserver() {
  if (window.__ipResponsiveTableObserver) return;
  var targets = Array.from(document.querySelectorAll('.tbl-wrap tbody'));
  if (!targets.length || typeof MutationObserver === 'undefined') return;

  var observer = new MutationObserver(function() {
    applyResponsiveTableLabels();
  });

  targets.forEach(function(target) {
    observer.observe(target, { childList: true, subtree: true });
  });

  window.__ipResponsiveTableObserver = observer;
}

function ensureMapFields() {
  var adresInput = document.getElementById('ibAdres');
  if (!adresInput || document.getElementById('ibLat')) return;
  var holder = adresInput.closest('.fg');
  if (!holder || !holder.parentNode) return;

  var wrap = document.createElement('div');
  wrap.innerHTML = [
    '<div class="form-row" style="gap:13px;margin-bottom:13px">',
    '  <div class="fg">',
    '    <label><span data-iplang="latitude">Latitude</span></label>',
    '    <input id="ibLat" placeholder="41.0082" oninput="onizlemeGuncelle()">',
    '  </div>',
    '  <div class="fg">',
    '    <label><span data-iplang="longitude">Longitude</span></label>',
    '    <input id="ibLng" placeholder="28.9784" oninput="onizlemeGuncelle()">',
    '  </div>',
    '</div>',
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">',
    '  <button class="btn btn-ghost" type="button" onclick="isletmeKonumuAl()">',
    '    <i class="fas fa-location-crosshairs"></i> <span data-iplang="konumuAl">Konumu Al</span>',
    '  </button>',
    '  <button class="btn btn-ghost" type="button" onclick="isletmeHaritadaAc()">',
    '    <i class="fas fa-map-location-dot"></i> <span data-iplang="haritadaKontrol">Haritada Kontrol Et</span>',
    '  </button>',
    '</div>'
  ].join('');
  holder.insertAdjacentElement('afterend', wrap);
}

// ════════════════════════════════════════════════════════
// TAB
// ════════════════════════════════════════════════════════
function goTab(t) {
  document.querySelectorAll('.tab').forEach(function(x){ x.classList.remove('active'); });
  document.querySelectorAll('.nav-a').forEach(function(x){ x.classList.remove('active'); });
  document.getElementById('tab-'+t).classList.add('active');
  var nav = document.querySelector('[data-tab="'+t+'"]');
  if (nav) nav.classList.add('active');
  if (window.innerWidth < 992 && typeof closeSidebar === 'function') closeSidebar();
  var _ld = IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr'];
  document.getElementById('topTitle').textContent = _ld[t] || TAB_TITLES[t] || t;
  if (t==='randevular') loadRandevular();
  if (t==='hizmetler')  loadHizmetler();
  if (t==='calisanlar') loadCalisanlar();
  if (t==='saatler')    loadSaatler();
  if (t==='isletme')    loadIsletmeBilgi();
  if (t==='ayarlar')    initIpAyarlar();
  if (t==='profil')     initIpProfil();
}

// ════════════════════════════════════════════════════════
// SÜPER ADMİN İŞLETME LİSTESİ
// ════════════════════════════════════════════════════════
async function loadIsletmelerList() {
  var d = await api('/api/isletmeler-listesi');
  if (d && d.isletmeler) ISLETMELER = d.isletmeler;
  ['hIsletmeFg','cIsletmeFg'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'block';
  });
  ['hIsletme','cIsletme'].forEach(function(id){
    var sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).isletmeSecLabel+'</option>';
    ISLETMELER.forEach(function(i){
      var o = document.createElement('option');
      o.value = i.id;
      var ld2=IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']; o.textContent = i.ad + ' ('+(i.tur==='berber'?ld2.uzmBerber:ld2.uzmEpilasyon)+')';
      sel.appendChild(o);
    });
  });
}

// ════════════════════════════════════════════════════════
// HİZMET ŞABLONLARI
// ════════════════════════════════════════════════════════
function buildSablonlar(list) {
  var div = document.getElementById('sablonBtnler');
  if (!div) return;
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  // Dile göre şablon adlarını eşle
  var berberTR = ['Saç Kesimi','Sakal Tıraşı','Saç + Sakal','Çocuk Saç Kesimi','Bıyık Şekillendirme','Saç Boyama','Fön'];
  var epilTR   = ['Bacak Epilasyon','Koltuk Altı Epilasyon','Bikini Epilasyon','Yüz Epilasyon','Tam Vücut Epilasyon','Üst Dudak','Kaş Şekillendirme'];
  div.innerHTML = '';
  div.style.display = 'flex';
  div.style.gap = '6px';
  div.style.flexWrap = 'wrap';
  list.forEach(function(s){
    var btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    // Dile göre görünen ad
    var bIdx = berberTR.indexOf(s.ad);
    var eIdx = epilTR.indexOf(s.ad);
    var gorunenAd = s.ad;
    if (IP_LANG_CURRENT === 'en') {
      if (bIdx >= 0 && ld.berberSablonlar[bIdx]) gorunenAd = ld.berberSablonlar[bIdx];
      else if (eIdx >= 0 && ld.epilasyonSablonlar[eIdx]) gorunenAd = ld.epilasyonSablonlar[eIdx];
    }
    btn.textContent = gorunenAd;
    btn.onclick = function(){
      document.getElementById('hAd').value    = gorunenAd; // Dile göre ad
      document.getElementById('hSure').value  = s.sure;
      document.getElementById('hUcret').value = s.ucret;
      document.getElementById('hKat').value   = SES.isletme_tur==='epilasyon' ? 'epilasyon' : 'berber';
      document.getElementById('hAd').focus();
      toast('"'+gorunenAd+'" ' + ld.sablonYuklendi, 'success');
    };
    div.appendChild(btn);
  });
}

// ════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════
async function loadStats() {
  var d = await api('/api/istatistikler');
  if (!d || !d.success) return;
  var s = d.stats;
  var map = {sBekliyor:s.bekleyen, sOnaylanan:s.onaylanan, sBugun:s.bugun,
             sToplamR:s.toplam_randevu, sHizmet:s.hizmet, sCalisan:s.calisan};
  Object.keys(map).forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.textContent = (map[id] !== undefined && map[id] !== null) ? map[id] : '–';
  });
}

async function loadDashRandevular() {
  var tb = document.getElementById('dashBody');
  var lang = IP_LANG_CURRENT; // API beklerken değişmesin diye kilitle
  var d  = await api('/api/randevular?durum=bekliyor');
  var ld = IP_LANGS[lang] || IP_LANGS['tr'];
  if (!d || !d.success) { tb.innerHTML='<tr><td colspan="6" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>'; return; }
  var list = (d.randevular||[]).slice(0,8);
  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" class="tbl-empty">'+ld.bekleyenRandevuYok+'</td></tr>'; return;
  }
  tb.innerHTML = list.map(function(r){
    return '<tr>'+
      '<td><b>'+r.tarih+'</b> '+r.saat+'</td>'+
      '<td><b>'+r.musteri_adi+'</b></td>'+
      '<td><small>'+r.musteri_telefon+'</small></td>'+
      '<td>'+(r.hizmet_adi||'–')+'</td>'+
      '<td class="randevu-staff-cell">'+(r.calisan_adi||'–')+'</td>'+
      '<td style="display:flex;gap:5px;flex-wrap:wrap">'+
        '<button class="btn btn-success btn-sm" onclick="hizliDurum('+r.id+',\'onaylandi\')">✅ Onayla</button>'+
        '<button class="btn btn-warning btn-sm" onclick="acDetay('+r.id+')">👁 Detay</button>'+
        '<button class="btn btn-danger btn-sm" onclick="hizliDurum('+r.id+',\'iptal\')">❌ İptal</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

async function hizliDurum(id, durum) {
  if (durum==='iptal' && !confirm((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).randevuIptalOnayi)) return;
  var r = await api('/api/randevu-durum/'+id, 'POST', {durum:durum});
  toast(r.message, r.success?'success':'error');
  if (r.success) { loadStats(); loadDashRandevular(); }
}

// ════════════════════════════════════════════════════════
// RANDEVULAR
// ════════════════════════════════════════════════════════
async function loadRandevular() {
  var tb    = document.getElementById('randevuBody');
  var durum = (document.getElementById('fDurum')||{}).value || '';
  var tarih = (document.getElementById('fTarih')||{}).value || '';
  var arama = (document.getElementById('fArama')||{}).value || '';
  tb.innerHTML = '<tr><td colspan="9" class="tbl-empty"><div class="sp"></div></td></tr>';
  var url = '/api/randevular?';
  if (durum) url += 'durum='+durum+'&';
  if (tarih) url += 'tarih='+tarih+'&';
  if (arama) url += 'arama='+encodeURIComponent(arama)+'&';
  var d = await api(url);
  if (!d||!d.success) { tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).veriAlinamadi+'</td></tr>'; return; }
  if (!d.randevular.length) { tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+(( IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).randevuBulunamadi)+'</td></tr>'; return; }
  tb.innerHTML = d.randevular.map(function(r){
    return '<tr>'+
      '<td><b>'+r.tarih+'</b></td>'+
      '<td>'+r.saat+'</td>'+
      '<td><b>'+r.musteri_adi+'</b></td>'+
      '<td><small>'+r.musteri_telefon+'</small></td>'+
      '<td>'+(r.hizmet_adi||'–')+'</td>'+
      '<td>'+(r.calisan_adi||'–')+'</td>'+
      '<td>'+(r.ucret?parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺':'–')+'</td>'+
      '<td>'+
        '<select class="st-sel" onchange="durumGuncelle('+r.id+',this.value)">'+
          '<option value="bekliyor"   '+(r.durum==='bekliyor'  ?'selected':'')+'>⏳ Bekliyor</option>'+
          '<option value="onaylandi"  '+(r.durum==='onaylandi' ?'selected':'')+'>✅ Onaylandı</option>'+
          '<option value="tamamlandi" '+(r.durum==='tamamlandi'?'selected':'')+'>🎉 Tamamlandı</option>'+
          '<option value="iptal"      '+(r.durum==='iptal'     ?'selected':'')+'>❌ İptal</option>'+
        '</select>'+
      '</td>'+
      '<td class="randevu-actions-cell" style="display:flex;gap:4px">'+
        '<button class="btn btn-icon btn-ghost" onclick="acDetay('+r.id+')" title="Detay">👁</button>'+
        '<button class="btn btn-icon btn-ghost" onclick="notEkle('+r.id+',\''+esc(r.notlar||'')+'\')" title="Not ekle" style="margin-left:3px">📝</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

function temizleFiltre() {
  ['fDurum','fTarih','fArama'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  loadRandevular();
}

async function durumGuncelle(id, durum) {
  var r = await api('/api/randevu-durum/'+id,'POST',{durum:durum});
  toast(r.message, r.success?'success':'error');
  if (r.success) loadStats();
}

async function acDetay(id) {
  var d = await api('/api/randevular');
  if (!d||!d.success) return;
  var r = d.randevular.find(function(x){return x.id===id;});
  if (!r) return;
  var durumBadge = {bekliyor:'b-bekliyor',onaylandi:'b-onaylandi',tamamlandi:'b-tamamlandi',iptal:'b-iptal'};
  showModal(
    '<div class="m-icon m-blue">📅</div>'+
    '<h2>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).randevuDetayi+'</h2><p class="msub">#'+r.id+'</p>'+
    dr('👤','Müşteri',r.musteri_adi)+
    dr('📞','Telefon',r.musteri_telefon)+
    dr('✂️','Hizmet',r.hizmet_adi||'–')+
    dr('💰','Ücret',r.ucret?parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺':'–')+
    dr('👤','Çalışan',r.calisan_adi||'–')+
    dr('📅','Tarih',r.tarih+' — '+r.saat)+
    dr('🔵','Durum','<span class="badge '+durumBadge[r.durum]+'">'+r.durum+'</span>')+
    (r.notlar?dr('📝','Not',r.notlar):'')+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="notEkle('+r.id+',\''+esc(r.notlar||'')+'\')">📝 Not Ekle/Düzenle</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">Kapat</button>'+
    '</div>'
  );
}

function notEkle(id, mevcutNot) {
  showModal(
    '<div class="m-icon m-blue">📝</div>'+
    '<h2>Randevu Notu</h2><p class="msub">Randevu #'+id+'</p>'+
    '<div class="fg">'+
      '<label>Not</label>'+
      '<textarea id="notInput" rows="4" style="resize:vertical;padding:8px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;width:100%">'+mevcutNot+'</textarea>'+
    '</div>'+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="saveNot('+id+')">💾 Kaydet</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).iptalBtn+'</button>'+
    '</div>'
  );
}

async function saveNot(id) {
  var notlar = (document.getElementById('notInput')||{}).value || '';
  var r = await api('/api/randevu-not/'+id,'POST',{notlar:notlar});
  toast(r.message, r.success?'success':'error');
  if (r.success) { closeModal(); loadRandevular(); }
}

// ════════════════════════════════════════════════════════
// ÇALIŞANLAR
// ════════════════════════════════════════════════════════
async function loadCalisanlar() {
  var tb = document.getElementById('calisanBody');
  tb.innerHTML = '<tr><td colspan="6" class="tbl-empty"><div class="sp"></div></td></tr>';
  var d = await api('/api/calisanlar');
  // hCalisan dropdown'unu güncelle
  if (d && d.success) {
  window._calisanlar = d.calisanlar || [];
  window._calisanMap = {};
  d.calisanlar.forEach(function(c){ window._calisanMap[c.id] = c; });
    var sel = document.getElementById('hCalisan');
    if (sel) {
      sel.innerHTML = '<option value="0">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).uzmanSecOpsiyonel+'</option>';
      window._calisanlar.forEach(function(c){
        sel.innerHTML += '<option value="'+c.id+'">'+c.ad+'</option>';
      });
    }
  }
  if (!d||!d.success) { tb.innerHTML='<tr><td colspan="6" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).veriAlinamadi+'</td></tr>'; return; }
  if (!d.calisanlar.length) { tb.innerHTML='<tr><td colspan="6" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanEklenmemis+'</td></tr>'; return; }
  var uzmIco = {berber:'✂️',epilasyon:'✨',kasiyer:'💰',diger:'👤'};
  tb.innerHTML = d.calisanlar.map(function(c){
    return '<tr>'+
      '<td><b>#'+c.id+'</b></td>'+
      '<td><b>'+c.ad+'</b>'+(c.isletme_adi&&SES.super_admin?'<br><small style="color:#94a3b8">'+c.isletme_adi+'</small>':'')+
      '<td><span class="badge '+(c.uzmanlik==='berber'?'b-berber':'b-epilasyon')+'">'+
        (uzmIco[c.uzmanlik]||'👤')+' '+c.uzmanlik+'</span></td>'+
      '<td>'+(c.telefon||'–')+'</td>'+
      '<td><label class="tog"><input type="checkbox" '+(c.aktif?'checked':'')+
        ' onchange="toggleCalisan('+c.id+',this.checked)"><span class="tog-sl"></span></label></td>'+
      '<td style="display:flex;gap:4px">'+
        '<button class="btn btn-icon btn-ghost" data-cid="'+c.id+'" onclick="editCalisanById(this)">✏️</button>'+
        '<button class="btn btn-icon btn-danger" onclick="silCalisan('+c.id+')" style="margin-left:3px">🗑️</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

async function calisanEkle() {
  var isletme_id = SES.super_admin ? v('cIsletme') : SES.isletme_id;
  var ad = v('cAd'), uzmanlik = v('cUzm'), telefon = v('cTel');
  if (!ad) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).adZorunludur,'error'); return; }
  if (SES.super_admin && !isletme_id) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).isletmeSecin,'error'); return; }
  var r = await api('/api/calisan-ekle','POST',{isletme_id:isletme_id,ad:ad,uzmanlik:uzmanlik,telefon:telefon});
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanEklendi : r.message, r.success?'success':'error');
  if (r.success) { document.getElementById('cAd').value=''; document.getElementById('cTel').value=''; loadCalisanlar(); }
}

function editCalisanById(btn) {
  var cid = parseInt(btn.getAttribute('data-cid'));
  var c = (window._calisanMap||{})[cid];
  if (!c) { toast('Çalışan bulunamadı','error'); return; }
  editCalisan(c.id, c.ad, c.uzmanlik, c.telefon||'');
}

function editCalisan(id, ad, uzm, tel) {
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  showModal(
    '<div class="m-icon m-green">✏️</div>'+
    '<h2>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanDuzenle+'</h2><p class="msub">#'+id+'</p>'+
    '<div class="form-row" style="grid-template-columns:1fr 1fr;gap:10px">'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).adSoyadYildiz+'</label><input id="ec_ad" value="'+ad+'"></div>'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).uzmanlikLabel+'</label>'+
        '<select id="ec_uzm">'+
          '<option value="berber" '+(uzm==='berber'?'selected':'')+'>'+(ld.uzmBerber)+'</option>'+
          '<option value="epilasyon" '+(uzm==='epilasyon'?'selected':'')+'>'+(ld.uzmEpilasyon)+'</option>'+
          '<option value="kasiyer" '+(uzm==='kasiyer'?'selected':'')+'>'+(ld.uzmKasiyer)+'</option>'+
          '<option value="diger" '+(uzm==='diger'?'selected':'')+'>'+(ld.uzmDiger)+'</option>'+
        '</select>'+
      '</div>'+
      '<div class="fg" style="grid-column:span 2"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).telefonLabel+'</label><input id="ec_tel" value="'+tel+'"></div>'+
    '</div>'+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="saveCalisan('+id+')">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).kaydetBtn+'</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).iptalBtn+'</button>'+
    '</div>'
  );
}

async function saveCalisan(id) {
  var payload = {ad:v('ec_ad'),uzmanlik:v('ec_uzm'),telefon:v('ec_tel'),aktif:true};
  if (!payload.ad) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).adZorunlu,'error'); return; }
  var r = await api('/api/calisan-guncelle/'+id,'PUT',payload);
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanGuncellendi : r.message, r.success?'success':'error');
  if (r.success) { closeModal(); loadCalisanlar(); }
}

async function toggleCalisan(id, aktif) {
  await api('/api/calisan-guncelle/'+id,'PUT',{ad:'',uzmanlik:'berber',telefon:'',aktif:aktif});
  toast((aktif ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanAktif : (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanPasif),'success');
}

async function silCalisan(id) {
  if (!confirm((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanSilOnayi)) return;
  var r = await api('/api/calisan-sil/'+id,'DELETE');
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanSilindi : r.message, r.success?'success':'error');
  if (r.success) loadCalisanlar();
}

// ════════════════════════════════════════════════════════
// HİZMETLER
// ════════════════════════════════════════════════════════

async function tumHizmetleriCevir() {
  if (!confirm((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetCeviriOnayi)) return;
  toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).ceviriYapiliyor, 'info');
  var r = await api('/api/hizmetleri-cevir', 'POST', {});
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).ceviriTamamlandi : (r.message || 'Hata!'), r.success ? 'success' : 'error');
  if (r.success) loadHizmetler();
}

async function loadHizmetler() {
  var tb = document.getElementById('hizmetBody');
  tb.innerHTML = '<tr><td colspan="9" class="tbl-empty"><div class="sp"></div></td></tr>';
  var d = await api('/api/hizmetler');
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  if (!d||!d.success) { tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>'; return; }
  if (!d.hizmetler||!d.hizmetler.length) { tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+ld.hizmetEklenmemis+'</td></tr>'; return; }
  var sureBirim = IP_LANG_CURRENT === 'en' ? 'min' : 'dk';
  window._hizmetMap = {};
  d.hizmetler.forEach(function(h){ window._hizmetMap[h.id] = h; });
  tb.innerHTML = d.hizmetler.map(function(h){
    var uzman = h.calisan_adi
      ? '<span style="background:#f0f9ff;border-radius:20px;padding:2px 8px;font-size:12px;color:#0369a1">👤 '+h.calisan_adi+'</span>'
      : '<span style="color:#cbd5e1;font-size:12px">—</span>';
    var katAd = h.kategori === 'berber'
      ? (IP_LANG_CURRENT === 'en' ? 'Barber' : 'Berber')
      : (IP_LANG_CURRENT === 'en' ? 'Epilation' : 'Epilasyon');
    var hizmetAdi = (IP_LANG_CURRENT === 'en' && h.ad_en) ? h.ad_en : h.ad;
    return '<tr>'+
      '<td><b>#'+h.id+'</b></td>'+
      '<td><b>'+hizmetAdi+'</b>'+(h.isletme_adi&&SES.super_admin?'<br><small style="color:#94a3b8">'+h.isletme_adi+'</small>':'')+'</td>'+
      '<td><span class="badge '+(h.kategori==='berber'?'b-berber':'b-epilasyon')+'">'+
        (h.kategori==='berber'?'✂️':'✨')+' '+katAd+'</span></td>'+
      '<td>'+h.sure+' '+sureBirim+'</td>'+
      '<td><b>'+parseFloat(h.ucret).toLocaleString('tr-TR')+' ₺</b></td>'+
      '<td>'+uzman+'</td>'+
      '<td><label class="tog"><input type="checkbox" '+(h.aktif?'checked':'')+
        ' onchange="toggleHizmet('+h.id+',this.checked)"><span class="tog-sl"></span></label></td>'+
      '<td style="display:flex;gap:4px">'+
        '<button class="btn btn-icon btn-ghost" data-hid="'+h.id+'" onclick="editHizmetById(this)">✏️</button>'+
        '<button class="btn btn-icon btn-danger" onclick="silHizmet('+h.id+')" style="margin-left:3px">🗑️</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

async function hizmetEkle() {
  var isletme_id = SES.super_admin ? v('hIsletme') : SES.isletme_id;
  var ad=v('hAd'), kat=v('hKat'), sure=v('hSure'), ucret=v('hUcret');
  var cid = v('hCalisan') || '0';
  if (!ad||!sure) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetAdiSureZorunlu,'error'); return; }
  if (SES.super_admin && !isletme_id) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).isletmeSecin,'error'); return; }
  var r = await api('/api/hizmet-ekle','POST',{
    isletme_id:isletme_id, ad:ad, kategori:kat,
    sure:parseInt(sure), ucret:parseFloat(ucret)||0,
    calisan_id: cid!=='0' ? parseInt(cid) : null,
    panel_lang: IP_LANG_CURRENT
  });
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetEklendi : r.message, r.success?'success':'error');
  if (r.success) { document.getElementById('hAd').value=''; loadHizmetler(); }
}

function editHizmetById(btn) {
  var hid = parseInt(btn.getAttribute('data-hid'));
  var h = (window._hizmetMap||{})[hid];
  if (!h) { toast('Hizmet bulunamadı','error'); return; }
  var gorunenAd = (IP_LANG_CURRENT === 'en' && h.ad_en) ? h.ad_en : h.ad;
  editHizmet(h.id, h.ad, gorunenAd, h.kategori, h.sure, h.ucret, h.calisan_id||0);
}

function editHizmet(id, adTR, adGoster, kat, sure, ucret, calisan_id) {
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  // Çalışan listesini oluştur
  var calisanOpts = '<option value="0">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).uzmanSecOpsiyonel+'</option>';
  (window._calisanlar||[]).forEach(function(c){
    calisanOpts += '<option value="'+c.id+'" '+(c.id==calisan_id?'selected':'')+'>'+c.ad+'</option>';
  });
  showModal(
    '<div class="m-icon m-blue">✏️</div>'+
    '<h2>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetDuzenle+'</h2><p class="msub">#'+id+' — '+adGoster+'</p>'+
    '<div class="form-row" style="grid-template-columns:1fr 1fr;gap:10px">'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetAdi+'*</label><input id="eh_ad" value="'+adGoster+'"></div>'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).kategori+'</label>'+
        '<select id="eh_kat">'+
          '<option value="berber" '+(kat==='berber'?'selected':'')+'>'+(ld.katBerber||'✂️ Berber')+'</option>'+
          '<option value="epilasyon" '+(kat==='epilasyon'?'selected':'')+'>'+(ld.katEpilasyon||'✨ Epilasyon')+'</option>'+
        '</select>'+
      '</div>'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sureDakika+'</label><input type="number" id="eh_sure" value="'+sure+'" min="5" step="5"></div>'+
      '<div class="fg"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).fiyatTL+'</label><input type="number" id="eh_ucret" value="'+ucret+'" min="0" step="1"></div>'+
      '<div class="fg" style="grid-column:span 2"><label>'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sorumluCalisan+'</label>'+
        '<select id="eh_calisan">'+calisanOpts+'</select>'+
      '</div>'+
    '</div>'+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="saveHizmet('+id+')">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).kaydetBtn+'</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).iptalBtn+'</button>'+
    '</div>'
  );
}

async function saveHizmet(id) {
  var cid = v('eh_calisan') || '0';
  var payload={
    ad:v('eh_ad'),
    kategori:v('eh_kat'),
    sure:parseInt(v('eh_sure')), ucret:parseFloat(v('eh_ucret'))||0,
    aktif:true,
    calisan_id: cid!=='0' ? parseInt(cid) : null,
    panel_lang: IP_LANG_CURRENT
  };
  if (!payload.ad) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).adZorunlu,'error'); return; }
  var r = await api('/api/hizmet-guncelle/'+id,'PUT',payload);
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetGuncellendi : r.message, r.success?'success':'error');
  if (r.success) { closeModal(); loadHizmetler(); }
}

async function toggleHizmet(id, aktif) {
  await api('/api/hizmet-guncelle/'+id,'PUT',{ad:'',kategori:'berber',sure:30,ucret:0,aktif:aktif});
  toast((aktif ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetAktifMesaj : (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetPasifMesaj),'success');
}

async function silHizmet(id) {
  if (!confirm((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetSilOnayi)) return;
  var r = await api('/api/hizmet-sil/'+id,'DELETE');
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hizmetSilindi : r.message, r.success?'success':'error');
  if (r.success) loadHizmetler();
}

// ════════════════════════════════════════════════════════
// ÇALIŞMA SAATLERİ
// ════════════════════════════════════════════════════════
var GUNLER = ['','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

async function loadSaatler() {
  var form = document.getElementById('saatlerForm');
  form.innerHTML = '<div class="sp" style="margin:20px auto"></div>';
  var d = await api('/api/calisma-saatleri');
  if (!d||!d.success) { form.innerHTML='<p style="color:red;padding:16px">'+(d&&d.message||'Hata')+' </p>'; return; }
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  var html = '<div style="display:grid;gap:10px">';
  d.saatler.forEach(function(s){
    var gunAdi = ld.gunler ? ld.gunler[s.gun_no-1] : s.gun_adi;
    var acikMeyin  = s.kapali ? ld.kapali : ld.acik;
    html += '<div class="saat-row" style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:#f8fafc;border-radius:11px;flex-wrap:wrap">'+
      '<span class="gun-label" style="font-weight:700;min-width:105px;font-size:13px;color:#0f2b3d">'+gunAdi+'</span>'+
      '<label class="tog" title="Açık/Kapalı">'+
        '<input type="checkbox" id="gk_'+s.gun_no+'" '+(s.kapali?'':'checked')+' onchange="toggleGun('+s.gun_no+')">'+
        '<span class="tog-sl"></span>'+
      '</label>'+
      '<span class="acik-label" style="font-size:12px;color:#64748b;min-width:45px" id="gl_'+s.gun_no+'">'+acikMeyin+'</span>'+
      '<div id="gs_'+s.gun_no+'" style="display:'+(s.kapali?'none':'flex')+';gap:8px;align-items:center">'+
        '<input type="time" id="ga_'+s.gun_no+'" value="'+s.acilis+'" style="padding:5px 9px;border:1.5px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:12.5px">'+
        '<span style="color:#94a3b8">—</span>'+
        '<input type="time" id="gp_'+s.gun_no+'" value="'+s.kapanis+'" style="padding:5px 9px;border:1.5px solid #e2e8f0;border-radius:7px;font-family:inherit;font-size:12.5px">'+
      '</div>'+
    '</div>';
  });
  html += '</div>';
  form.innerHTML = html;
  loadTatiller();
}

function toggleGun(g) {
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  var kapali = !document.getElementById('gk_'+g).checked;
  document.getElementById('gl_'+g).textContent = kapali ? ld.kapali : ld.acik;
  document.getElementById('gs_'+g).style.display = kapali?'none':'flex';
}

async function saatleriKaydet() {
  var saatler = [];
  for (var g=1;g<=7;g++) {
    var cb = document.getElementById('gk_'+g);
    if (!cb) continue;
    saatler.push({
      gun_no:g,
      acilis:(document.getElementById('ga_'+g)||{}).value||'09:00',
      kapanis:(document.getElementById('gp_'+g)||{}).value||'19:00',
      kapali:!cb.checked
    });
  }
  var r = await api('/api/calisma-saatleri-kaydet','POST',{saatler:saatler});
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).saatlerKaydedildi : r.message, r.success?'success':'error');
}

// ════════════════════════════════════════════════════════
// TATİL GÜNLERİ
// ════════════════════════════════════════════════════════
async function loadTatiller() {
  var tb = document.getElementById('tatilBody');
  if (!tb) return;
  var d = await api('/api/tatil-gunleri');
  if (!d||!d.success) return;
  if (!d.tatiller.length) { tb.innerHTML='<tr><td colspan="3" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tatilGunuEklenmemis+'</td></tr>'; return; }
  tb.innerHTML = d.tatiller.map(function(t){
    var silLabel = (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).silBtn || 'Sil';
    return '<tr><td><b>'+t.tarih+'</b></td><td>'+(t.aciklama||'–')+'</td>'+
      '<td><button class="btn btn-danger btn-sm" onclick="tatilSil('+t.id+')">🗑️ '+silLabel+'</button></td></tr>';
  }).join('');
}

async function tatilEkle() {
  var tarih=v('tatilTarih'), acik=(document.getElementById('tatilAcik')||{}).value||'';
  if (!tarih) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tarihSecin,'error'); return; }
  var r = await api('/api/tatil-ekle','POST',{tarih:tarih,aciklama:acik});
  var tatilMsg = r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tatilEklendi : (r.message && r.message.includes('zaten') ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tarihZatenEklenmis : r.message);
  toast(tatilMsg, r.success?'success':'error');
  if (r.success) { document.getElementById('tatilTarih').value=''; document.getElementById('tatilAcik').value=''; loadTatiller(); }
}

async function tatilSil(id) {
  if (!confirm((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tatilSilOnayi)) return;
  var r = await api('/api/tatil-sil/'+id,'DELETE');
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).tatilSilindi : r.message, r.success?'success':'error');
  if (r.success) loadTatiller();
}

// ════════════════════════════════════════════════════════
// İŞLETME BİLGİLERİ
// ════════════════════════════════════════════════════════
async function loadIsletmeBilgi() {
  if (SES.super_admin) return;
  var d = await api('/api/isletme-bilgi');
  if (!d||!d.success) return;
  var i = d.isletme;
  document.getElementById('ibAd').value    = i.ad||'';
  document.getElementById('ibTel').value   = i.telefon||'';
  document.getElementById('ibIl').value    = i.il||'';
  document.getElementById('ibIlce').value  = i.ilce||'';
  document.getElementById('ibAdres').value = i.adres||'';
  if (document.getElementById('ibLat')) document.getElementById('ibLat').value = i.latitude||'';
  if (document.getElementById('ibLng')) document.getElementById('ibLng').value = i.longitude||'';
  document.getElementById('ibAcik').value  = i.aciklama||'';
  document.getElementById('ibAktif').checked = i.aktif !== false;

  // Hesap alanlarını doldur
  var hesapAd = document.getElementById('hesapAdInp');
  var hesapEmail = document.getElementById('hesapEmailInp');
  if (hesapAd) hesapAd.value = SES.ad || i.yonetici_ad || '';
  if (hesapEmail) hesapEmail.value = SES.email || i.email || '';

  // Tür butonunu ayarla
  setTur(i.tur || 'berber');

  // Son kayıt notunu temizle
  var sk = document.getElementById('ibSonKayit');
  if (sk) sk.textContent = '';

  // Önizlemeyi güncelle
  onizlemeGuncelle();
}

function setTur(tur) {
  document.getElementById('ibTur').value = tur;

  var btnB = document.getElementById('ibTurBerber');
  var btnE = document.getElementById('ibTurEpilasyon');
  if (!btnB || !btnE) return;

  if (tur === 'berber') {
    btnB.style.border     = '2px solid #1b4a6b';
    btnB.style.background = 'linear-gradient(135deg,#0f2b3d,#1b4a6b)';
    btnB.style.color      = '#fff';
    btnE.style.border     = '2px solid #e2e8f0';
    btnE.style.background = '#fff';
    btnE.style.color      = '#64748b';
  } else {
    btnE.style.border     = '2px solid #7c3aed';
    btnE.style.background = 'linear-gradient(135deg,#4c1d95,#7c3aed)';
    btnE.style.color      = '#fff';
    btnB.style.border     = '2px solid #e2e8f0';
    btnB.style.background = '#fff';
    btnB.style.color      = '#64748b';
  }

  onizlemeGuncelle();
}

function onizlemeGuncelle() {
  var ad     = (document.getElementById('ibAd')||{}).value    || 'İşletme Adı';
  var tel    = (document.getElementById('ibTel')||{}).value   || '';
  var il     = (document.getElementById('ibIl')||{}).value    || '';
  var ilce   = (document.getElementById('ibIlce')||{}).value  || '';
  var adres  = (document.getElementById('ibAdres')||{}).value || '';
  var lat    = (document.getElementById('ibLat')||{}).value   || '';
  var lng    = (document.getElementById('ibLng')||{}).value   || '';
  var acik   = (document.getElementById('ibAcik')||{}).value  || '';
  var tur    = (document.getElementById('ibTur')||{}).value   || 'berber';
  var aktif  = (document.getElementById('ibAktif')||{}).checked !== false;

  // Aktif label
  var aktifLbl = document.getElementById('ibAktifLabel');
  if (aktifLbl) {
    aktifLbl.textContent  = aktif ? 'Açık' : 'Kapalı';
    aktifLbl.style.color  = aktif ? '#059669' : '#dc2626';
  }

  // Karakter sayacı
  var sayac = document.getElementById('ibAcikSayac');
  if (sayac) sayac.textContent = acik.length + ' ' + ((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).karakter);

  // Önizleme
  var onizAd    = document.getElementById('ibOnizAd');
  var onizIcon  = document.getElementById('ibOnizIcon');
  var onizBadge = document.getElementById('ibOnizTurBadge');
  var onizAcik  = document.getElementById('ibOnizAcik');
  var onizAdres = document.getElementById('ibOnizAdres');
  var onizTel   = document.getElementById('ibOnizTel');

  if (onizAd)    onizAd.textContent    = ad || 'İşletme Adı';
  if (onizAcik)  onizAcik.textContent  = acik;

  if (onizAdres) {
    var konumParca = [];
    if (il) konumParca.push(il);
    if (ilce) konumParca.push(ilce);
    var tamAdres = konumParca.join(' / ');
    if (adres) tamAdres = tamAdres ? (tamAdres + ' - ' + adres) : adres;
    if (lat && lng) tamAdres = tamAdres ? (tamAdres + ' · ' + lat + ', ' + lng) : (lat + ', ' + lng);
    onizAdres.style.display = tamAdres ? 'block' : 'none';
    var sp = onizAdres.querySelector('span');
    if (sp) sp.textContent = tamAdres;
  }
  if (onizTel) {
    onizTel.style.display = tel ? 'block' : 'none';
    var sp2 = onizTel.querySelector('span');
    if (sp2) sp2.textContent = tel;
  }

  if (tur === 'berber') {
    if (onizIcon)  { onizIcon.textContent = '✂️'; onizIcon.style.background = '#dbeafe'; }
    if (onizBadge) { onizBadge.textContent = (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).onizBerber; onizBadge.style.background='#dbeafe'; onizBadge.style.color='#1e40af'; }
  } else {
    if (onizIcon)  { onizIcon.textContent = '✨'; onizIcon.style.background = '#fae8ff'; }
    if (onizBadge) { onizBadge.textContent = (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).onizEpilasyon; onizBadge.style.background='#fae8ff'; onizBadge.style.color='#86198f'; }
  }

  // Pasif ise önizleme solar
  var oniz = document.getElementById('ibOnizleme');
  if (oniz) oniz.style.opacity = aktif ? '1' : '0.5';
}

function isletmeHaritaUrl() {
  var lat = v('ibLat');
  var lng = v('ibLng');
  if (lat && lng) return 'https://www.google.com/maps?q=' + encodeURIComponent(lat + ',' + lng);
  var adres = [v('ibAdres'), v('ibIlce'), v('ibIl')].filter(Boolean).join(', ');
  return adres ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(adres) : '';
}

function isletmeHaritadaAc() {
  var url = isletmeHaritaUrl();
  if (!url) {
    toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).konumYok, 'error');
    return;
  }
  window.open(url, '_blank', 'noopener');
}

function isletmeKonumuAl() {
  if (!navigator.geolocation) {
    toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).konumDesteklenmiyor, 'error');
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos){
    if (document.getElementById('ibLat')) document.getElementById('ibLat').value = pos.coords.latitude.toFixed(6);
    if (document.getElementById('ibLng')) document.getElementById('ibLng').value = pos.coords.longitude.toFixed(6);
    onizlemeGuncelle();
    toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).konumAlindi, 'success');
  }, function(err){
    toast(((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).konumAlinamadi || 'Konum alınamadı') + ': ' + err.message, 'error');
  }, {enableHighAccuracy:true, timeout:10000, maximumAge:0});
}

async function isletmeGuncelle() {
  var payload = {
    ad       : v('ibAd'),
    tur      : v('ibTur') || 'berber',
    telefon  : v('ibTel'),
    il       : v('ibIl'),
    ilce     : v('ibIlce'),
    adres    : v('ibAdres'),
    latitude : v('ibLat') || null,
    longitude: v('ibLng') || null,
    aciklama : (document.getElementById('ibAcik')||{}).value||'',
    aktif    : (document.getElementById('ibAktif')||{}).checked !== false
  };
  if (!payload.ad) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).isletmeAdiZorunlu,'error'); return; }
  if (!payload.il) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).ilZorunlu,'error'); return; }
  if (!payload.ilce) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).ilceZorunlu,'error'); return; }

  var btn = document.getElementById('ibKaydetBtn');
  if (btn) { btn.disabled=true; btn.innerHTML='⏳ '+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).kaydediliyor; }

  var r = await api('/api/isletme-guncelle','PUT',payload);
  toast(r.success ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).isletmeGuncellendi : r.message, r.success?'success':'error');

  if (r.success) {
    // Sidebar ve topbar'ı güncelle
    document.getElementById('sbIsletmeAdi').textContent = payload.ad;
    var tb = document.getElementById('sbTurBadge');
    if (tb) tb.textContent = payload.tur==='berber' ? (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).berberSalonuBadge : (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).epilasyonMerkeziBadge;
    var sbIcon = document.getElementById('sbLogoIcon');
    if (sbIcon) sbIcon.textContent = payload.tur==='berber' ? '✂️' : '✨';
    // Son kayıt zamanı
    var sk = document.getElementById('ibSonKayit');
    if (sk) {
      var now = new Date();
      var kayitMesaj = IP_LANG_CURRENT==='en' ? 'saved' : 'kaydedildi';
      sk.textContent = '✅ ' + now.getHours()+':'+String(now.getMinutes()).padStart(2,'0') + ' ' + kayitMesaj;
    }
  }

  if (btn) { btn.disabled=false; btn.innerHTML=(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).degisiklikleriKaydetBtn; }
}

// ════════════════════════════════════════════════════════
// YARDIMCILAR
// ════════════════════════════════════════════════════════
async function api(url, method, body) {
  method = method || 'GET';
  try {
    var opts = {method:method, headers:{'Content-Type':'application/json'}};
    if (body) opts.body = JSON.stringify(body);
    var r = await fetch(url, opts);
    var data = await r.json();
    return data;
  } catch(e) {
    return {success:false, message:'Bağlantı hatası: '+e.message};
  }
}

function v(id) {
  var el=document.getElementById(id);
  return el?(el.value||'').trim():'';
}

function esc(s) {
  return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dr(ico, lbl, val) {
  return '<div class="drow"><span style="min-width:22px;text-align:center">'+ico+'</span><span class="drow-lbl">'+lbl+'</span><span class="drow-val">'+val+'</span></div>';
}

function showModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modal').classList.add('open');
  autoTranslateIpDom(document.getElementById('modalBody'));
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function toast(msg, type) {
  type = type || 'success';
  var t = document.getElementById('toast');
  var ico = type==='success'?'✅':type==='error'?'❌':'⚠️';
  t.className = 'toast '+(type==='success'?'':''+type);
  t.innerHTML = ico+' '+msg;
  t.style.display = 'flex';
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.style.display='none'; }, 3500);
}

async function cikis() {
  await api('/api/cikis','POST');
  window.location.href = '/giris';
}

// ── Profil & Ayarlar ──────────────────────────────






// ── Tablo satır arama ──────────────────────────────
function filterTableRows(tbodyId, q) {
  q = q.toLowerCase();
  document.querySelectorAll('#' + tbodyId + ' tr').forEach(function(r) {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function araTable(tbodyId, val, cols) {
  var q = val.toLowerCase();
  document.querySelectorAll('#' + tbodyId + ' tr').forEach(function(r) {
    var cells = r.querySelectorAll('td');
    if (!cells.length) return;
    var match = !q;
    if (!match) {
      cols.forEach(function(i) { if (cells[i] && cells[i].textContent.toLowerCase().includes(q)) match = true; });
    }
    r.style.display = match ? '' : 'none';
  });
}


// ═══════════════════════════════════════════════════════
// DİL SÖZLÜKLERİ
// ═══════════════════════════════════════════════════════
// IP_LANGS — bkz. static/js/isletme_langs.js

// IP_LANG_CURRENT dosya başında tanımlandı

function applyIpLang(lang) {
  IP_LANG_CURRENT = lang;
  localStorage.setItem('isletmeLang', lang);
  var d = IP_LANGS[lang] || IP_LANGS['tr'];
  document.documentElement.lang = lang;
  document.title = d.pageTitle;

  // ── 1. data-iplang attribute olan TÜM elementleri güncelle ──
  document.querySelectorAll('[data-iplang]').forEach(function(el) {
    var key = el.getAttribute('data-iplang');
    if (d[key] !== undefined) el.textContent = d[key];
  });

  // ── 2. data-iplang-ph olan input placeholder'ları ──
  document.querySelectorAll('[data-iplang-ph]').forEach(function(el) {
    var key = el.getAttribute('data-iplang-ph');
    if (d[key] !== undefined) el.placeholder = d[key];
  });

  // ── 3. TAB_TITLES güncelle ──
  TAB_TITLES.dashboard  = d.dashboard;
  TAB_TITLES.randevular = d.randevular;
  TAB_TITLES.calisanlar = d.calisanlar;
  TAB_TITLES.hizmetler  = d.hizmetler;
  TAB_TITLES.saatler    = d.saatler;
  TAB_TITLES.isletme    = d.isletme;
  TAB_TITLES.ayarlar    = d.ayarlar;

  // ── 4. Aktif tab başlığı ──
  var activeNavA = document.querySelector('.nav-a.active');
  if (activeNavA) {
    var t = activeNavA.getAttribute('data-tab');
    var titleEl = document.getElementById('topTitle');
    if (titleEl && d[t]) titleEl.textContent = d[t];
  }

  // ── 5. Sidebar nav linkleri — data-iplang sistemi hallediyor ──
  // (navMap manuel güncelleme kaldırıldı, data-iplang [1] ile güncelleniyor)

  // ── 6. Dashboard stat etiketleri — data-iplang sistemi hallediyor ──

  // ── 7. Panel başlıkları ──
  var dashBtn = document.querySelector('#tab-dashboard .btn');
  if (dashBtn) dashBtn.textContent = d.tumunuGor;

  // ── 8. Tablo başlıkları ──
  var dashThs = document.querySelectorAll('#tab-dashboard thead tr:last-child th');
  dashThs.forEach(function(th,i){ if(d.dashHeaders[i]) th.textContent = d.dashHeaders[i]; });

  // rTitle data-iplang="tumRandevular" ile güncelleniyor
  var rThs = document.querySelectorAll('#tab-randevular thead th');
  rThs.forEach(function(th,i){ if(d.randevuHeaders[i]) th.textContent = d.randevuHeaders[i]; });

  var fArama = document.getElementById('fArama');
  if (fArama) fArama.placeholder = lang==='en' ? 'Customer name / phone...' : 'Müşteri adı / telefon ara...';
  var fTemizle = document.querySelector('#tab-randevular .filter-row .btn');
  if (fTemizle) fTemizle.textContent = lang==='en' ? 'Clear' : 'Temizle';

  // Çalışanlar tablo
  // cTitle data-iplang="kayitliCalisanlar"/"calisanlar" ile güncelleniyor
  var cEkleBtn = document.querySelector('#tab-calisanlar .btn-primary');
  if (cEkleBtn) cEkleBtn.textContent = d.calisanEkleBtn;
  var cSearchInp = document.getElementById('calisanAramaInput');
  if (cSearchInp) cSearchInp.placeholder = lang==='en' ? 'Search...' : 'Ara...';
  var cThs = document.querySelectorAll('#tab-calisanlar thead tr:last-child th');
  cThs.forEach(function(th,i){ if(d.calisanHeaders[i]) th.textContent = d.calisanHeaders[i]; });

  // Hizmetler tablo
  // hTitle data-iplang="yeniHizmetEkle" ile güncelleniyor
  var hEkleBtn = document.querySelector('#tab-hizmetler .btn-primary');
  if (hEkleBtn) hEkleBtn.textContent = d.hizmetEkleBtn;
  var hSearchInp = document.getElementById('hizmetAramaInput');
  if (hSearchInp) hSearchInp.placeholder = lang==='en' ? 'Search services...' : 'Hizmet ara...';
  var hThs = document.querySelectorAll('#tab-hizmetler .tbl-wrap thead th');
  hThs.forEach(function(th,i){ if(d.hizmetHeaders[i]) th.textContent = d.hizmetHeaders[i]; });

  // ── 9. Çalışma saatleri günleri ──
  var gunEls = document.querySelectorAll('#saatlerForm .gun-label');
  gunEls.forEach(function(el, i) { if (d.gunler[i]) el.textContent = d.gunler[i]; });
  // Açık/Kapalı toggle label'ları
  document.querySelectorAll('#saatlerForm .acik-label').forEach(function(el) {
    var isOpen = el.closest('.saat-row')?.querySelector('input[type=checkbox]')?.checked;
    el.textContent = isOpen ? d.acik : d.kapali;
  });

  // ── 10. Tatil tablo başlığı ──
  var tatilThs = document.querySelectorAll('#tatilBody').length ? 
    document.querySelectorAll('#tab-saatler .tbl-wrap thead th') : [];
  tatilThs.forEach(function(th,i){ if(d.tatilHeaders[i]) th.textContent = d.tatilHeaders[i]; });

  // ── 11. İşletme bilgileri ──
  var ibAktifWrap = document.getElementById('ibAktifToggleWrap');
  if (ibAktifWrap) {
    var lbl = ibAktifWrap.querySelector('span:first-child');
    if (lbl) lbl.textContent = d.isletmeAktif;
  }
  var ibKaydetBtn = document.getElementById('ibKaydetBtn');
  if (ibKaydetBtn) ibKaydetBtn.innerHTML = '💾 ' + (lang==='en' ? 'Save Changes' : 'Değişiklikleri Kaydet');

  // ── 12. Profil tab ──
  var pGuncelleBtn = document.querySelector('#tab-isletme .btn-primary');
  if (pGuncelleBtn) pGuncelleBtn.innerHTML = '<i class="fas fa-save"></i> ' + (lang==='en' ? 'Update Account' : 'Hesap Bilgilerini Güncelle');
  var pYoneticiEl = document.getElementById('profilYoneticiIp');
  if (pYoneticiEl) pYoneticiEl.textContent = (lang==='en'?'Manager: ':'Yönetici: ') + (SES.ad||'—');

  // ── 13. Hesap bilgileri form etiketleri ──
  var hesapLabels = document.querySelectorAll('#tab-isletme .panel:last-child .form-label, #tab-isletme .panel:last-child label');
  // Email, Yönetici, Şifre labelları
  var hesapMap = lang==='en'
    ? {0:'Manager Full Name', 1:'Email *', 2:'New Password', 3:'Confirm Password'}
    : {0:'Yönetici Ad Soyad', 1:'E-posta *', 2:'Yeni Şifre', 3:'Şifre Tekrar'};

  // ── 14. Ayarlar tab ──
  // aTitle data-iplang="ayarlar" ile güncelleniyor
  var temaDivs = document.querySelectorAll('#tab-ayarlar div[style*="font-weight:700"]');
  if (temaDivs[0]) temaDivs[0].textContent = d.tema;
  if (temaDivs[1]) temaDivs[1].textContent = d.dil;
  var temaAcikBadge = document.querySelector('#tab-ayarlar .acik-label');
  var ipThemeLight = document.getElementById('ipThemeLight');
  if (ipThemeLight) ipThemeLight.innerHTML = '<i class="fas fa-sun"></i>' + d.temaAcik;
  var ipThemeDark = document.getElementById('ipThemeDark');
  if (ipThemeDark) ipThemeDark.innerHTML = '<i class="fas fa-moon"></i>' + d.temaKoyu;
  var ipThemeSystem = document.getElementById('ipThemeSystem');
  if (ipThemeSystem) ipThemeSystem.innerHTML = '<i class="fas fa-desktop"></i>' + d.temaSistem;
  // Otomatik çeviri açıklaması
  var otoCeviriDiv = document.querySelector('#tab-ayarlar .otoCeviriBaslik');
  if (otoCeviriDiv) otoCeviriDiv.textContent = d.otoCeviri;
  var otoCeviriAcik = document.querySelector('#tab-ayarlar .otoCeviriAcik');
  if (otoCeviriAcik) otoCeviriAcik.textContent = d.otoCeviriAcik;
  var baglantiTestBtn = document.querySelector('#tab-ayarlar button[onclick="ceviriTest()"]');
  if (baglantiTestBtn) baglantiTestBtn.innerHTML = '<i class="fas fa-vial"></i> ' + d.baglantiTest;

  // ── 15. Çıkış butonu ──
  var cikisBtn = document.querySelector('.btn-logout');
  if (cikisBtn) cikisBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> ' + d.cikisYap;

  // ── 16. Placeholder'lar ──
  var phHizmetAdı = document.getElementById('hAd');
  if (phHizmetAdı) phHizmetAdı.placeholder = d.phHizmetAdi || '';
  var phHakkinda = document.getElementById('ibAcik');
  if (phHakkinda) phHakkinda.placeholder = d.phHakkinda || '';
  var phSifreTekrar = document.getElementById('hesapSifreTekrarInp');
  if (phSifreTekrar) phSifreTekrar.placeholder = d.phSifreTekrar || '';
  var phEnAz = document.getElementById('hesapSifreInp');
  if (phEnAz) phEnAz.placeholder = d.phEnAz6 || '';
  var phIsletmeAdi = document.getElementById('ibAd');
  if (phIsletmeAdi) phIsletmeAdi.placeholder = d.phIsletmeAdi || '';
  var phAdres = document.getElementById('ibAdres');
  if (phAdres) phAdres.placeholder = d.phAdres || '';
  var phTatil = document.getElementById('tatilAcik');
  if (phTatil) phTatil.placeholder = d.phTarih || '';

  // ── 17. Yenile butonları ──
  document.querySelectorAll('button[onclick*="loadRandevular"], button[onclick*="loadCalisanlar"], button[onclick*="loadHizmetler"]').forEach(function(btn) {
    if (btn.innerHTML && btn.innerHTML.includes('🔄')) btn.innerHTML = '🔄 ' + d.yenile;
  });

  // ── 18. Sidebar tur badge ──
  var sbTurBadge = document.getElementById('sbTurBadge');
  if (sbTurBadge && sbTurBadge.textContent) {
    if (sbTurBadge.textContent.includes('Berber') || sbTurBadge.textContent.includes('Barber')) sbTurBadge.textContent = d.berberSalonuBadge;
    else if (sbTurBadge.textContent.includes('Epilasyon') || sbTurBadge.textContent.includes('Epilation')) sbTurBadge.textContent = d.epilasyonMerkeziBadge;
  }

  // ── 19. Ayarlar açıklama metinleri ──
  var gorunumDiv = document.querySelector('#tab-ayarlar div[style*="font-size:.75rem"]:first-of-type');
  if (gorunumDiv) gorunumDiv.textContent = d.gorunumTercihi;
  var arayuzDiv  = document.querySelectorAll('#tab-ayarlar div[style*="font-size:.75rem"]');
  if (arayuzDiv[1]) arayuzDiv[1].textContent = d.arayuzDili;

  // ── 20. Şablon butonlarını yeniden oluştur ──
  var tur = SES.isletme_tur || '';
  if (tur === 'berber') buildSablonlar(BERBER_SABLONLAR);
  else if (tur === 'epilasyon') buildSablonlar(EPILASYON_SABLONLAR);
  else buildSablonlar(BERBER_SABLONLAR.concat(EPILASYON_SABLONLAR));

  // ── 21. Rendered listeler yeniden render ──
  if (typeof loadCalisanlar    === 'function') loadCalisanlar();
  if (typeof loadHizmetler     === 'function') loadHizmetler();
  if (typeof loadSaatler       === 'function') loadSaatler();
  if (typeof loadDashRandevular === 'function') loadDashRandevular();
  autoTranslateIpDom(document.body);
}

// ═══════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════
var _sbCollapsed = false;

function toggleSidebar() {
  var sb   = document.querySelector('.sidebar');
  var main = document.querySelector('.main');
  var overlay = document.getElementById('sidebarOverlay');
  if (window.innerWidth >= 992) {
    _sbCollapsed = !_sbCollapsed;
    sb.classList.toggle('collapsed', _sbCollapsed);
    main.classList.toggle('expanded', _sbCollapsed);
  } else {
    sb.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', sb.classList.contains('open'));
    document.body.classList.toggle('sidebar-mobile-open', sb.classList.contains('open'));
  }
}

function closeSidebar() {
  var sb = document.querySelector('.sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('sidebar-mobile-open');
}

// Mobilde dışarı tıklayınca kapat
document.addEventListener('click', function(e) {
  if (window.innerWidth < 992) {
    var sb = document.querySelector('.sidebar');
    var btn = document.getElementById('sidebarToggleBtn');
    if (sb && sb.classList.contains('open') && !sb.contains(e.target) && btn && !btn.contains(e.target)) {
      closeSidebar();
    }
  }
});

window.addEventListener('resize', function() {
  if (window.innerWidth >= 992) {
    closeSidebar();
  }
  clearTimeout(window.__dashResizeTimer);
  window.__dashResizeTimer = setTimeout(function() {
    var dashTab = document.getElementById('tab-dashboard');
    if (dashTab && dashTab.classList.contains('active')) {
      loadDashRandevular();
    }
  }, 120);
});

// ═══════════════════════════════════════════════════════
// PROFİL GÜNCELLEME (isletmeler tablosundaki email/sifre)
// ═══════════════════════════════════════════════════════
function initIpProfil() {
  var adi = SES.isletme_adi || '—';
  var yad = SES.ad || '—';
  var tur = SES.isletme_tur || '';

  // Avatar
  var av = document.getElementById('profilAvatarIp');
  if (av) av.textContent = (adi !== '—' ? adi[0] : (yad !== '—' ? yad[0] : '?')).toUpperCase();

  // Bilgi gösterimi
  var el;
  el = document.getElementById('profilIsletmeAdiIp'); if (el) el.textContent = adi;
  el = document.getElementById('profilYoneticiIp');  if (el) el.textContent = (IP_LANG_CURRENT==='en'?'Manager: ':'Yönetici: ') + yad;
  el = document.getElementById('profilTurIp');
  if (el) el.innerHTML = tur === 'berber'
    ? '<span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:20px">✂️ Berber Salonu</span>'
    : tur === 'epilasyon' ? '<span style="background:#fae8ff;color:#86198f;padding:2px 10px;border-radius:20px">✨ Epilasyon Merkezi</span>' : '';

  // Form alanları
  var isletmeAdInp = document.getElementById('profilIsletmeAdInp');
  if (isletmeAdInp) isletmeAdInp.value = adi !== '—' ? adi : '';

  var adInp = document.getElementById('profilYoneticiAdInp');
  if (adInp) adInp.value = yad !== '—' ? yad : '';

  var emInp = document.getElementById('profilEmailInp');
  if (emInp) emInp.value = SES.email || '';
}

async function ipProfilGuncelle() {
  // Artık kullanılmıyor - hesapGuncelle'ye yönlendir
  await hesapGuncelle();
}

async function hesapGuncelle() {
  var ad     = ((document.getElementById('hesapAdInp')          ||{}).value||'').trim();
  var email  = ((document.getElementById('hesapEmailInp')       ||{}).value||'').trim();
  var sifre  = ((document.getElementById('hesapSifreInp')       ||{}).value||'').trim();
  var sifre2 = ((document.getElementById('hesapSifreTekrarInp') ||{}).value||'').trim();

  if (!email) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).epostaZorunlu, 'error'); return; }
  if (sifre && sifre.length < 6) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sifreMinAlti, 'error'); return; }
  if (sifre && sifre !== sifre2) { toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sifrelerEslesmiyor, 'error'); return; }

  var payload = { ad: ad, email: email };
  if (sifre) payload.sifre = sifre;

  try {
    var r = await api('/api/isletme-profil-guncelle', 'POST', payload);
    if (r.success) {
      // Session güncelle
      if (ad) SES.ad = ad;
      SES.email = email;
      // Topbar + sidebar güncelle
      document.getElementById('yoneticiAd').textContent = SES.ad || '';
      var sbYad = document.getElementById('sbYoneticiAd');
      if (sbYad) sbYad.textContent = SES.ad || '—';
      var sbAv = document.getElementById('sbAvatarIp');
      if (sbAv) sbAv.textContent = (SES.isletme_adi||SES.ad||'?')[0].toUpperCase();
      // Şifre alanlarını temizle
      var s1 = document.getElementById('hesapSifreInp');
      var s2 = document.getElementById('hesapSifreTekrarInp');
      if (s1) s1.value = '';
      if (s2) s2.value = '';
      toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).hesapGuncellendi, 'success');
    } else {
      toast(r.message || (IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sunucuHatasi, 'error');
    }
  } catch(e) {
    toast((IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).sunucuHatasi, 'error');
  }
}

// ═══════════════════════════════════════════════════════
// AYARLAR TAB
// ═══════════════════════════════════════════════════════
function initIpAyarlar() {
  var t = localStorage.getItem('isletmeTheme') || 'light';
  var l = localStorage.getItem('isletmeLang') || 'tr';
  ['Light','Dark','System'].forEach(function(s) {
    var btn = document.getElementById('ipTheme' + s);
    if (!btn) return;
    var active = s.toLowerCase() === t;
    btn.classList.toggle('active', active);
  });
  document.getElementById('ipLangTR') && document.getElementById('ipLangTR').classList.toggle('active', l === 'tr');
  document.getElementById('ipLangEN') && document.getElementById('ipLangEN').classList.toggle('active', l === 'en');
}

function setIpTheme(t) {
  localStorage.setItem('isletmeTheme', t);
  var a = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
  document.documentElement.setAttribute('data-bs-theme', a);
  initIpAyarlar();
}

function setIpLang(l) {
  applyIpLang(l);
  // Dashboard mesajını hemen yenile — applyIpLang IP_LANG_CURRENT'ı set etti
  loadDashRandevular();
  initIpAyarlar();
  toast(l === 'tr' ? 'Dil Türkçe olarak ayarlandı ✅' : 'Language set to English ✅', 'success');
}

// ─── Claude API Key ───────────────────────────────────────
async function ceviriTest() {
  var statusEl = document.getElementById('ceviriTestSonuc');
  if (statusEl) { statusEl.textContent = '⏳ Test ediliyor...'; statusEl.style.color = '#64748b'; }
  var r = await api('/api/ceviri-test', 'GET');
  var msg = r && r.message ? r.message : 'Yanıt alınamadı';
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.style.color = (r && r.success) ? '#059669' : '#dc2626';
  }
  toast(msg, (r && r.success) ? 'success' : 'error');
}

// Init tema
(function(){
  var t = localStorage.getItem('isletmeTheme') || 'light';
  var a = t === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
  document.documentElement.setAttribute('data-bs-theme', a);
})();

// Appointment language overrides
var IP_TRANSLATION_CONFIG = null;
var IP_TRANSLATION_CACHE = {};

async function ipLoadTranslationConfig() {
  if (IP_TRANSLATION_CONFIG) return IP_TRANSLATION_CONFIG;
  try {
    var r = await fetch('/api/translation-config', { cache: 'no-store' });
    IP_TRANSLATION_CONFIG = await r.json();
  } catch (e) {
    IP_TRANSLATION_CONFIG = { success: false, enabled: false, provider: 'none' };
  }
  return IP_TRANSLATION_CONFIG;
}

async function ipTranslateTexts(texts, sourceLang, targetLang) {
  var items = (texts || []).map(function(t){ return (t || '').trim(); }).filter(Boolean);
  if (!items.length || sourceLang === targetLang) return {};

  var cfg = await ipLoadTranslationConfig();
  if (!cfg || !cfg.enabled) return {};

  var unique = Array.from(new Set(items));
  var missing = unique.filter(function(text){
    return !IP_TRANSLATION_CACHE[sourceLang + '|' + targetLang + '|' + text];
  });

  if (missing.length) {
    try {
      var resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: missing,
          source_lang: sourceLang,
          target_lang: targetLang,
          format: 'text'
        })
      });
      var data = await resp.json();
      if (data && data.success && Array.isArray(data.translations)) {
        missing.forEach(function(text, idx){
          IP_TRANSLATION_CACHE[sourceLang + '|' + targetLang + '|' + text] = data.translations[idx] || text;
        });
      }
    } catch (e) {}
  }

  var out = {};
  unique.forEach(function(text){
    out[text] = IP_TRANSLATION_CACHE[sourceLang + '|' + targetLang + '|' + text] || text;
  });
  return out;
}

async function enrichAppointmentTranslations(rows) {
  rows = rows || [];
  if (IP_LANG_CURRENT !== 'en' || !rows.length) return rows;

  var serviceTexts = rows
    .filter(function(r){ return r && !r.hizmet_adi_en && r.hizmet_adi; })
    .map(function(r){ return r.hizmet_adi; });

  var noteTexts = rows
    .filter(function(r){ return r && !r.notlar_en && r.notlar; })
    .map(function(r){ return r.notlar; });

  var serviceMap = await ipTranslateTexts(serviceTexts, 'tr', 'en');
  var noteMap = await ipTranslateTexts(noteTexts, 'tr', 'en');

  rows.forEach(function(r){
    if (r && !r.hizmet_adi_en && r.hizmet_adi && serviceMap[r.hizmet_adi]) {
      r.hizmet_adi_en = serviceMap[r.hizmet_adi];
    }
    if (r && !r.notlar_en && r.notlar && noteMap[r.notlar]) {
      r.notlar_en = noteMap[r.notlar];
    }
  });
  return rows;
}

function isIpAutoTranslatableText(text) {
  var value = (text || '').trim();
  if (!value || value.length < 2) return false;
  if (/^[\d\s\-–—:/.+₺$€£#()%]+$/.test(value)) return false;
  return true;
}

function collectIpAutoTranslateTargets(root) {
  var scope = root || document.body;
  var textTargets = [];
  var placeholderTargets = [];
  var optionTargets = [];

  scope.querySelectorAll('*').forEach(function(el) {
    var tag = el.tagName;
    if (!tag) return;
    if (el.hasAttribute('data-iplang') || el.hasAttribute('data-no-auto-translate')) return;
    if (el.closest('[data-iplang]')) return;
    if (['SCRIPT','STYLE','NOSCRIPT','I','SVG','PATH'].includes(tag)) return;

    if ((tag === 'INPUT' || tag === 'TEXTAREA') && el.placeholder) {
      if (!el.dataset.trOriginalPlaceholder) el.dataset.trOriginalPlaceholder = el.placeholder;
      if (isIpAutoTranslatableText(el.dataset.trOriginalPlaceholder)) {
        placeholderTargets.push({ el: el, text: el.dataset.trOriginalPlaceholder });
      }
    }

    if (tag === 'OPTION') {
      if (!el.dataset.trOriginalText) el.dataset.trOriginalText = (el.textContent || '').trim();
      if (isIpAutoTranslatableText(el.dataset.trOriginalText)) {
        optionTargets.push({ el: el, text: el.dataset.trOriginalText });
      }
      return;
    }

    var hasElementChildren = Array.from(el.childNodes).some(function(n){ return n.nodeType === 1; });
    if (hasElementChildren) return;

    var text = (el.textContent || '').trim();
    if (!isIpAutoTranslatableText(text)) return;
    if (!el.dataset.trOriginalText) el.dataset.trOriginalText = text;
    textTargets.push({ el: el, text: el.dataset.trOriginalText });
  });

  return { textTargets: textTargets, placeholderTargets: placeholderTargets, optionTargets: optionTargets };
}

async function autoTranslateIpDom(root) {
  var scope = root || document.body;
  var targets = collectIpAutoTranslateTargets(scope);

  if (IP_LANG_CURRENT === 'tr') {
    targets.textTargets.forEach(function(item){ item.el.textContent = item.el.dataset.trOriginalText || item.text; });
    targets.placeholderTargets.forEach(function(item){ item.el.placeholder = item.el.dataset.trOriginalPlaceholder || item.text; });
    targets.optionTargets.forEach(function(item){ item.el.textContent = item.el.dataset.trOriginalText || item.text; });
    return;
  }

  if (IP_LANG_CURRENT !== 'en') return;

  var textMap = await ipTranslateTexts(targets.textTargets.map(function(item){ return item.text; }), 'tr', 'en');
  var placeholderMap = await ipTranslateTexts(targets.placeholderTargets.map(function(item){ return item.text; }), 'tr', 'en');
  var optionMap = await ipTranslateTexts(targets.optionTargets.map(function(item){ return item.text; }), 'tr', 'en');

  targets.textTargets.forEach(function(item){
    item.el.textContent = textMap[item.text] || item.text;
  });
  targets.placeholderTargets.forEach(function(item){
    item.el.placeholder = placeholderMap[item.text] || item.text;
  });
  targets.optionTargets.forEach(function(item){
    item.el.textContent = optionMap[item.text] || item.text;
  });
}

function getPanelAppointmentServiceName(r, ld) {
  if (!r) return '–';
  if (IP_LANG_CURRENT !== 'en') return r.hizmet_adi || '–';
  if (r.hizmet_adi_en) return r.hizmet_adi_en;

  var serviceMap = {
    'saç + sakal': 'Hair + Beard',
    'sac + sakal': 'Hair + Beard',
    'saç kesimi': 'Haircut',
    'cocuk saç kesimi': 'Kids Haircut',
    'çocuk saç kesimi': 'Kids Haircut',
    'bıyık şekillendirme': 'Mustache Styling',
    'biyik şekillendirme': 'Mustache Styling',
    'biyik sekillendirme': 'Mustache Styling',
    'koltuk altı epilasyon': 'Underarm Epilation',
    'bacak epilasyon': 'Leg Epilation'
  };

  var raw = (r.hizmet_adi || '').trim();
  var key = raw.toLocaleLowerCase('tr-TR');
  return serviceMap[key] || raw || '–';
}

function getPanelAppointmentNote(r, ld) {
  if (!r) return '—';
  if (IP_LANG_CURRENT !== 'en') return r.notlar || '—';
  if (r.notlar_en) return r.notlar_en;

  var noteMap = {
    'randevu onaylandı': 'appointment approved',
    'randevu onaylandi': 'appointment approved',
    'randevu tamamlandı': 'appointment completed',
    'randevu tamamlandi': 'appointment completed',
    'randevu iptal edildi': 'appointment cancelled',
    'beklemede': 'pending'
  };

  var raw = (r.notlar || '').trim();
  var key = raw.toLocaleLowerCase('tr-TR');
  return noteMap[key] || raw || '—';
}

async function loadRandevular() {
  var tb    = document.getElementById('randevuBody');
  var durum = (document.getElementById('fDurum')||{}).value || '';
  var tarih = (document.getElementById('fTarih')||{}).value || '';
  var arama = (document.getElementById('fArama')||{}).value || '';
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  tb.innerHTML = '<tr><td colspan="9" class="tbl-empty"><div class="sp"></div></td></tr>';
  var url = '/api/randevular?';
  if (durum) url += 'durum='+durum+'&';
  if (tarih) url += 'tarih='+tarih+'&';
  if (arama) url += 'arama='+encodeURIComponent(arama)+'&';
  var d = await api(url);
  if (!d || !d.success) {
    tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>';
    return;
  }
  await enrichAppointmentTranslations(d.randevular);
  if (!d.randevular.length) {
    tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">'+ld.randevuBulunamadi+'</td></tr>';
    return;
  }
  tb.innerHTML = d.randevular.map(function(r){
    return '<tr>'+
      '<td class="randevu-date-cell"><b>'+r.tarih+'</b></td>'+
      '<td class="randevu-time-cell">'+r.saat+'</td>'+
      '<td class="randevu-customer-cell"><b>'+r.musteri_adi+'</b></td>'+
      '<td class="randevu-phone-cell"><small>'+r.musteri_telefon+'</small></td>'+
      '<td class="randevu-service-cell">'+getPanelAppointmentServiceName(r, ld)+'</td>'+
      '<td>'+(r.calisan_adi||'–')+'</td>'+
      '<td class="randevu-price-cell">'+(r.ucret ? parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺' : '–')+'</td>'+
      '<td class="randevu-status-cell">'+
        '<select class="st-sel" onchange="durumGuncelle('+r.id+',this.value)">'+
          '<option value="bekliyor" '+(r.durum==='bekliyor'?'selected':'')+'>'+(ld.durumBekliyor||'⏳ Bekliyor')+'</option>'+
          '<option value="onaylandi" '+(r.durum==='onaylandi'?'selected':'')+'>'+(ld.durumOnaylandi||'✅ Onaylandı')+'</option>'+
          '<option value="tamamlandi" '+(r.durum==='tamamlandi'?'selected':'')+'>'+(ld.durumTamamlandi||'🎉 Tamamlandı')+'</option>'+
          '<option value="iptal" '+(r.durum==='iptal'?'selected':'')+'>'+(ld.durumIptal||'❌ İptal')+'</option>'+
        '</select>'+
      '</td>'+
      '<td style="display:flex;gap:4px">'+
        '<button class="btn btn-icon btn-ghost" onclick="acDetay('+r.id+')" title="'+(ld.detayBtn||'Detay')+'">👁</button>'+
        '<button class="btn btn-icon btn-ghost" onclick="notEkle('+r.id+',\''+esc(IP_LANG_CURRENT==='en' ? (r.notlar_en||r.notlar||'') : (r.notlar||''))+'\')" title="'+(ld.notEkleBtn||'Not ekle')+'" style="margin-left:3px">📝</button>'+
      '</td>'+
    '</tr>';
  }).join('');
}

async function acDetay(id) {
  var d = await api('/api/randevular');
  if (!d || !d.success) return;
  await enrichAppointmentTranslations(d.randevular);
  var r = d.randevular.find(function(x){ return x.id === id; });
  if (!r) return;
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  var durumBadge = {bekliyor:'b-bekliyor',onaylandi:'b-onaylandi',tamamlandi:'b-tamamlandi',iptal:'b-iptal'};
  var durumText = {
    bekliyor: ld.durumBekliyor || '⏳ Bekliyor',
    onaylandi: ld.durumOnaylandi || '✅ Onaylandı',
    tamamlandi: ld.durumTamamlandi || '🎉 Tamamlandı',
    iptal: ld.durumIptal || '❌ İptal'
  };
  showModal(
    '<div class="m-icon m-blue">📅</div>'+
    '<h2>'+(ld.randevuDetayi||'Appointment Details')+'</h2><p class="msub">#'+r.id+'</p>'+
    dr('👤', ld.randevuMusteri||'Customer', r.musteri_adi)+
    dr('📞', ld.randevuTelefon||'Phone', r.musteri_telefon)+
    dr('✂️', ld.randevuHizmet||'Service', getPanelAppointmentServiceName(r, ld))+
    dr('💰', ld.randevuUcret||'Price', r.ucret ? parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺' : '–')+
    dr('👤', ld.randevuCalisan||'Staff', r.calisan_adi||'–')+
    dr('📅', ld.randevuTarih||'Date', r.tarih+' — '+r.saat)+
    dr('🔵', ld.randevuDurum||'Status', '<span class="badge '+(durumBadge[r.durum]||'b-bekliyor')+'">'+(durumText[r.durum]||durumText.bekliyor)+'</span>')+
    dr('📝', ld.randevuNot||'Note', getPanelAppointmentNote(r, ld))+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="notEkle('+r.id+',\''+esc(IP_LANG_CURRENT==='en' ? (r.notlar_en||r.notlar||'') : (r.notlar||''))+'\')">'+(ld.notEkleDuzenle||'📝 Add/Edit Note')+'</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">'+(ld.kapatBtn||'Close')+'</button>'+
    '</div>'
  );
}

function notEkle(id, mevcutNot) {
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  showModal(
    '<div class="m-icon m-blue">📝</div>'+
    '<h2>'+(ld.randevuNotu||'Appointment Note')+'</h2><p class="msub">'+(ld.randevuNo||'Appointment')+' #'+id+'</p>'+
    '<div class="fg">'+
      '<label>'+(ld.randevuNot||'Note')+'</label>'+
      '<textarea id="notInput" rows="4" style="resize:vertical;padding:8px 11px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:13px;width:100%">'+(mevcutNot||'')+'</textarea>'+
    '</div>'+
    '<div class="mfooter">'+
      '<button class="btn btn-primary" onclick="saveNot('+id+')">'+(ld.kaydetBtn||'💾 Save')+'</button>'+
      '<button class="btn btn-ghost" onclick="closeModal()">'+(ld.iptalBtn||'Cancel')+'</button>'+
    '</div>'
  );
}

async function saveNot(id) {
  var notlar = (document.getElementById('notInput')||{}).value || '';
  var r = await api('/api/randevu-not/'+id, 'POST', {notlar:notlar});
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  toast(r.success ? (ld.notKaydedildi || '✅ Note saved!') : r.message, r.success ? 'success' : 'error');
  if (r.success) {
    closeModal();
    loadRandevular();
  }
}

async function loadDashRandevular() {
  var tb = document.getElementById('dashBody');
  var mobileList = document.getElementById('dashMobileList');
  var lang = IP_LANG_CURRENT;
  var ld = IP_LANGS[lang] || IP_LANGS['tr'];
  var d = await api('/api/randevular?durum=bekliyor');
  if (!d || !d.success) {
    tb.innerHTML = '<tr><td colspan="6" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="tbl-empty">'+ld.veriAlinamadi+'</div>';
    return;
  }

  await enrichAppointmentTranslations(d.randevular || []);
  var allList = d.randevular || [];
  var isMobileDashboard = window.innerWidth <= 575;
  var maxVisible = isMobileDashboard ? 2 : 8;
  var list = allList.slice(0, maxVisible);

  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" class="tbl-empty">'+ld.bekleyenRandevuYok+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="tbl-empty">'+ld.bekleyenRandevuYok+'</div>';
    return;
  }

  var rowsHtml = list.map(function(r){
    return '<tr>'+
      '<td><b>'+r.tarih+'</b> '+r.saat+'</td>'+
      '<td><b>'+r.musteri_adi+'</b></td>'+
      '<td><small>'+r.musteri_telefon+'</small></td>'+
      '<td>'+getPanelAppointmentServiceName(r, ld)+'</td>'+
      '<td>'+(r.calisan_adi || '–')+'</td>'+
      '<td style="display:flex;gap:5px;flex-wrap:wrap">'+
        '<button class="btn btn-success btn-sm" onclick="hizliDurum('+r.id+',\'onaylandi\')">✅ '+(lang === 'en' ? 'Approve' : 'Onayla')+'</button>'+
        '<button class="btn btn-warning btn-sm" onclick="acDetay('+r.id+')">👁 '+(ld.detayBtn || 'Detay')+'</button>'+
        '<button class="btn btn-danger btn-sm" onclick="hizliDurum('+r.id+',\'iptal\')">❌ '+(ld.iptalBtn || 'İptal')+'</button>'+
      '</td>'+
    '</tr>';
  }).join('');

  if (allList.length > maxVisible) {
    var remaining = allList.length - maxVisible;
    var moreLabel = lang === 'en'
      ? remaining + ' more pending appointments. Tap "View All".'
      : '+' + remaining + ' bekleyen randevu daha var. "Tümünü Gör" ile açabilirsiniz.';
    rowsHtml += '<tr class="dash-more-row"><td colspan="6" class="tbl-empty dash-more-cell">'+moreLabel+'</td></tr>';
  }

  tb.innerHTML = rowsHtml;
  if (mobileList) {
    mobileList.innerHTML = list.map(function(r){
      return '<div class="dash-mobile-item">'+
        '<div class="dash-mobile-top">'+
          '<div class="dash-mobile-datetime"><strong>'+r.tarih+'</strong><span>'+r.saat+'</span></div>'+
          '<button class="btn btn-ghost btn-sm" onclick="acDetay('+r.id+')">'+(ld.detayBtn || 'Detay')+'</button>'+
        '</div>'+
        '<div class="dash-mobile-customer">'+r.musteri_adi+'</div>'+
        '<div class="dash-mobile-meta"><span>'+getPanelAppointmentServiceName(r, ld)+'</span><span>'+(r.calisan_adi || 'â€“')+'</span></div>'+
        '<div class="dash-mobile-actions">'+
          '<button class="btn btn-success btn-sm" onclick="hizliDurum('+r.id+',\'onaylandi\')">âœ… '+(lang === 'en' ? 'Approve' : 'Onayla')+'</button>'+
          '<button class="btn btn-danger btn-sm" onclick="hizliDurum('+r.id+',\'iptal\')">âŒ '+(ld.iptalBtn || 'Ä°ptal')+'</button>'+
        '</div>'+
      '</div>';
    }).join('');
    if (allList.length > maxVisible) {
      mobileList.innerHTML += '<div class="dash-mobile-more">'+
        (lang === 'en' ? (allList.length - maxVisible) + ' more pending appointments' : '+' + (allList.length - maxVisible) + ' bekleyen randevu daha')+
      '</div>';
    }
  }
}

function isNarrowMobilePanel() {
  return false;
}

async function loadDashRandevular() {
  var tb = document.getElementById('dashBody');
  var mobileList = document.getElementById('dashMobileList');
  if (!tb) return;

  var lang = IP_LANG_CURRENT;
  var ld = IP_LANGS[lang] || IP_LANGS['tr'];
  var d = await api('/api/randevular?durum=bekliyor');

  if (!d || !d.success) {
    tb.innerHTML = '<tr><td colspan="6" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="tbl-empty">'+ld.veriAlinamadi+'</div>';
    return;
  }

  try {
    await enrichAppointmentTranslations(d.randevular || []);
  } catch (e) {}

  var allList = Array.isArray(d.randevular) ? d.randevular : [];
  var maxVisible = window.innerWidth <= 575 ? 2 : 8;
  var list = allList.slice(0, maxVisible);

  if (!list.length) {
    tb.innerHTML = '<tr><td colspan="6" class="tbl-empty">'+ld.bekleyenRandevuYok+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="tbl-empty">'+ld.bekleyenRandevuYok+'</div>';
    return;
  }

  var rowsHtml = list.map(function(r) {
    var tarih = escapeHtml(r.tarih || '-');
    var saat = escapeHtml(r.saat || '-');
    var musteriAdi = escapeHtml(r.musteri_adi || '-');
    var telefon = escapeHtml(r.musteri_telefon || '-');
    var hizmetAdi = escapeHtml(getPanelAppointmentServiceName(r, ld) || '-');
    var calisanAdi = escapeHtml(r.calisan_adi || '-');

    return '<tr>'+
      '<td><b>'+tarih+'</b> '+saat+'</td>'+
      '<td><b>'+musteriAdi+'</b></td>'+
      '<td><small>'+telefon+'</small></td>'+
      '<td>'+hizmetAdi+'</td>'+
      '<td>'+calisanAdi+'</td>'+
      '<td style="display:flex;gap:5px;flex-wrap:wrap">'+
        '<button class="btn btn-success btn-sm" onclick="hizliDurum('+r.id+',\'onaylandi\')">'+(lang === 'en' ? 'Approve' : 'Onayla')+'</button>'+
        '<button class="btn btn-warning btn-sm" onclick="acDetay('+r.id+')">'+(ld.detayBtn || 'Detay')+'</button>'+
        '<button class="btn btn-danger btn-sm" onclick="hizliDurum('+r.id+',\'iptal\')">'+(ld.iptalBtn || 'Iptal')+'</button>'+
      '</td>'+
    '</tr>';
  }).join('');

  if (allList.length > maxVisible) {
    var remaining = allList.length - maxVisible;
    var moreLabel = lang === 'en'
      ? remaining + ' more pending appointments. Tap "View All".'
      : '+' + remaining + ' bekleyen randevu daha var. "Tumunu Gor" ile acabilirsiniz.';
    rowsHtml += '<tr class="dash-more-row"><td colspan="6" class="tbl-empty dash-more-cell">'+moreLabel+'</td></tr>';
  }

  tb.innerHTML = rowsHtml;
  if (!mobileList) return;

  mobileList.innerHTML = list.map(function(r) {
    var tarih = escapeHtml(r.tarih || '-');
    var saat = escapeHtml(r.saat || '-');
    var musteriAdi = escapeHtml(r.musteri_adi || '-');
    var hizmetAdi = escapeHtml(getPanelAppointmentServiceName(r, ld) || '-');
    var calisanAdi = escapeHtml(r.calisan_adi || '-');

    return '<div class="dash-mobile-item">'+
      '<div class="dash-mobile-top">'+
        '<div class="dash-mobile-datetime"><strong>'+tarih+'</strong><span>'+saat+'</span></div>'+
        '<button class="btn btn-ghost btn-sm" onclick="acDetay('+r.id+')">'+(ld.detayBtn || 'Detay')+'</button>'+
      '</div>'+
      '<div class="dash-mobile-customer">'+musteriAdi+'</div>'+
      '<div class="dash-mobile-meta"><span>'+hizmetAdi+'</span><span>'+calisanAdi+'</span></div>'+
      '<div class="dash-mobile-actions">'+
        '<button class="btn btn-success btn-sm" onclick="hizliDurum('+r.id+',\'onaylandi\')">'+(lang === 'en' ? 'Approve' : 'Onayla')+'</button>'+
        '<button class="btn btn-danger btn-sm" onclick="hizliDurum('+r.id+',\'iptal\')">'+(ld.iptalBtn || 'Iptal')+'</button>'+
      '</div>'+
    '</div>';
  }).join('');

  if (allList.length > maxVisible) {
    mobileList.innerHTML += '<div class="dash-mobile-more">'+
      (lang === 'en' ? (allList.length - maxVisible) + ' more pending appointments' : '+' + (allList.length - maxVisible) + ' bekleyen randevu daha')+
    '</div>';
  }
}

async function loadRandevular() {
  var tb = document.getElementById('randevuBody');
  var mobileList = document.getElementById('randevuMobileList');
  var durum = (document.getElementById('fDurum') || {}).value || '';
  var tarih = (document.getElementById('fTarih') || {}).value || '';
  var arama = (document.getElementById('fArama') || {}).value || '';
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];

  if (tb) {
    tb.innerHTML = '<tr><td colspan="9" class="tbl-empty"><div class="sp"></div></td></tr>';
  }
  if (mobileList) {
    mobileList.innerHTML = '<div class="randevu-mobile-empty"><div class="sp"></div></div>';
  }

  var url = '/api/randevular?';
  if (durum) url += 'durum=' + durum + '&';
  if (tarih) url += 'tarih=' + tarih + '&';
  if (arama) url += 'arama=' + encodeURIComponent(arama) + '&';

  var d = await api(url);
  if (!d || !d.success) {
    if (tb) tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">' + ld.veriAlinamadi + '</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="randevu-mobile-empty">' + ld.veriAlinamadi + '</div>';
    return;
  }

  await enrichAppointmentTranslations(d.randevular);
  var rows = Array.isArray(d.randevular) ? d.randevular : [];

  if (!rows.length) {
    if (tb) tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">' + ld.randevuBulunamadi + '</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="randevu-mobile-empty">' + ld.randevuBulunamadi + '</div>';
    return;
  }

  if (tb) {
    tb.innerHTML = rows.map(function(r) {
      return '<tr>'+
        '<td class="randevu-date-cell"><b>'+r.tarih+'</b></td>'+
        '<td class="randevu-time-cell">'+r.saat+'</td>'+
        '<td class="randevu-customer-cell"><b>'+r.musteri_adi+'</b></td>'+
        '<td class="randevu-phone-cell"><small>'+r.musteri_telefon+'</small></td>'+
        '<td class="randevu-service-cell">'+getPanelAppointmentServiceName(r, ld)+'</td>'+
        '<td class="randevu-staff-cell">'+(r.calisan_adi || '–')+'</td>'+
        '<td class="randevu-price-cell">'+(r.ucret ? parseFloat(r.ucret).toLocaleString('tr-TR')+' ₺' : '–')+'</td>'+
        '<td class="randevu-status-cell">'+
          '<select class="st-sel" onchange="durumGuncelle('+r.id+',this.value)">'+
            '<option value="bekliyor" '+(r.durum==='bekliyor'?'selected':'')+'>'+(ld.durumBekliyor||'⏳ Bekliyor')+'</option>'+
            '<option value="onaylandi" '+(r.durum==='onaylandi'?'selected':'')+'>'+(ld.durumOnaylandi||'✅ Onaylandı')+'</option>'+
            '<option value="tamamlandi" '+(r.durum==='tamamlandi'?'selected':'')+'>'+(ld.durumTamamlandi||'🎉 Tamamlandı')+'</option>'+
            '<option value="iptal" '+(r.durum==='iptal'?'selected':'')+'>'+(ld.durumIptal||'❌ İptal')+'</option>'+
          '</select>'+
        '</td>'+
        '<td class="randevu-actions-cell" style="display:flex;gap:4px">'+
          '<button class="btn btn-icon btn-ghost" onclick="acDetay('+r.id+')" title="'+(ld.detayBtn||'Detay')+'">👁</button>'+
          '<button class="btn btn-icon btn-ghost" onclick="notEkle('+r.id+',\''+esc(IP_LANG_CURRENT==='en' ? (r.notlar_en||r.notlar||'') : (r.notlar||''))+'\')" title="'+(ld.notEkleBtn||'Not ekle')+'" style="margin-left:3px">📝</button>'+
        '</td>'+
      '</tr>';
    }).join('');
  }

  if (!mobileList) return;

  mobileList.innerHTML = rows.map(function(r) {
    var tarihText = escapeHtml(r.tarih || '-');
    var saatText = escapeHtml(r.saat || '-');
    var musteriText = escapeHtml(r.musteri_adi || '-');
    var telefonText = escapeHtml(r.musteri_telefon || '-');
    var hizmetText = escapeHtml(getPanelAppointmentServiceName(r, ld) || '-');
    var calisanText = escapeHtml(r.calisan_adi || '-');
    var ucretText = r.ucret ? escapeHtml(parseFloat(r.ucret).toLocaleString('tr-TR') + ' ₺') : '–';
    var durumClass = r.durum === 'onaylandi'
      ? 'is-onaylandi'
      : r.durum === 'tamamlandi'
      ? 'is-tamamlandi'
      : r.durum === 'iptal'
      ? 'is-iptal'
      : 'is-bekliyor';

    return '<div class="randevu-mobile-item">'+
      '<div class="randevu-mobile-top">'+
        '<div class="randevu-mobile-datetime"><strong>'+tarihText+'</strong><span>'+saatText+'</span></div>'+
        '<select class="st-sel randevu-mobile-state '+durumClass+'" onchange="durumGuncelle('+r.id+',this.value)">'+
          '<option value="bekliyor" '+(r.durum==='bekliyor'?'selected':'')+'>'+(ld.durumBekliyor||'Bekliyor')+'</option>'+
          '<option value="onaylandi" '+(r.durum==='onaylandi'?'selected':'')+'>'+(ld.durumOnaylandi||'Onaylandi')+'</option>'+
          '<option value="tamamlandi" '+(r.durum==='tamamlandi'?'selected':'')+'>'+(ld.durumTamamlandi||'Tamamlandi')+'</option>'+
          '<option value="iptal" '+(r.durum==='iptal'?'selected':'')+'>'+(ld.durumIptal||'Iptal')+'</option>'+
        '</select>'+
      '</div>'+
      '<div class="randevu-mobile-customer">'+musteriText+'</div>'+
      '<div class="randevu-mobile-info"><span class="randevu-mobile-label">Hizmet:</span><span class="randevu-mobile-value">'+hizmetText+'</span></div>'+
      '<div class="randevu-mobile-info"><span class="randevu-mobile-label">Calisan:</span><span class="randevu-mobile-value">'+calisanText+'</span></div>'+
      '<div class="randevu-mobile-info"><span class="randevu-mobile-label">Telefon:</span><span class="randevu-mobile-value">'+telefonText+'</span></div>'+
      '<div class="randevu-mobile-info"><span class="randevu-mobile-label">Ucret:</span><span class="randevu-mobile-value">'+ucretText+'</span></div>'+
      '<div class="randevu-mobile-actions">'+
        '<button class="btn btn-icon btn-ghost" onclick="acDetay('+r.id+')" title="'+(ld.detayBtn||'Detay')+'">👁</button>'+
        '<button class="btn btn-icon btn-ghost" onclick="notEkle('+r.id+',\''+esc(IP_LANG_CURRENT==='en' ? (r.notlar_en||r.notlar||'') : (r.notlar||''))+'\')" title="'+(ld.notEkleBtn||'Not ekle')+'">📝</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

window._calisanList = window._calisanList || [];
window._hizmetList = window._hizmetList || [];

function renderCalisanMobileCards(searchTerm) {
  var listEl = document.getElementById('calisanMobileList');
  if (!listEl) return;
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  var term = (searchTerm == null ? ((document.getElementById('calisanAramaInput') || {}).value || '') : searchTerm).trim().toLocaleLowerCase('tr-TR');
  var items = (window._calisanList || []).filter(function(c) {
    if (!term) return true;
    return [c.ad, c.uzmanlik, c.telefon, c.isletme_adi].join(' ').toLocaleLowerCase('tr-TR').indexOf(term) !== -1;
  });

  if (!items.length) {
    listEl.innerHTML = '<div class="yonetim-mobile-empty">'+(term ? ld.randevuBulunamadi : ld.calisanEklenmemis)+'</div>';
    return;
  }

  var uzmanlikLabels = {
    berber: ld.uzmBerber || 'Berber',
    epilasyon: ld.uzmEpilasyon || 'Epilasyon',
    kasiyer: ld.uzmKasiyer || 'Kasiyer',
    diger: ld.uzmDiger || 'Diger'
  };
  var uzmanlikIcons = { berber: '✂️', epilasyon: '✨', kasiyer: '💰', diger: '👤' };

  listEl.innerHTML = items.map(function(c) {
    var badgeClass = c.uzmanlik === 'berber' ? 'b-berber' : 'b-epilasyon';
    return '<div class="yonetim-mobile-item">'+
      '<div class="yonetim-mobile-top">'+
        '<div><div class="yonetim-mobile-id">#'+c.id+'</div><div class="yonetim-mobile-name">'+escapeHtml(c.ad || '-')+'</div></div>'+
        '<span class="badge yonetim-mobile-badge '+badgeClass+'">'+(uzmanlikIcons[c.uzmanlik] || '👤')+' '+escapeHtml(uzmanlikLabels[c.uzmanlik] || c.uzmanlik || '-')+'</span>'+
      '</div>'+
      '<div class="yonetim-mobile-lines">'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.uzmanlik || 'Uzmanlik')+':</span><span class="yonetim-mobile-value">'+escapeHtml(uzmanlikLabels[c.uzmanlik] || c.uzmanlik || '-')+'</span></div>'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.telefon || 'Telefon')+':</span><span class="yonetim-mobile-value">'+escapeHtml(c.telefon || '–')+'</span></div>'+
        (c.isletme_adi && SES.super_admin ? '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.isletme || 'Isletme')+':</span><span class="yonetim-mobile-value">'+escapeHtml(c.isletme_adi)+'</span></div>' : '')+
      '</div>'+
      '<div class="yonetim-mobile-bottom">'+
        '<div class="yonetim-mobile-toggle"><span>Aktif</span><label class="tog"><input type="checkbox" '+(c.aktif ? 'checked' : '')+' onchange="toggleCalisan('+c.id+',this.checked)"><span class="tog-sl"></span></label></div>'+
      '</div>'+
      '<div class="yonetim-mobile-actions">'+
        '<button class="btn btn-icon btn-ghost" data-cid="'+c.id+'" onclick="editCalisanById(this)" title="Duzenle">✏️</button>'+
        '<button class="btn btn-icon btn-danger" onclick="silCalisan('+c.id+')" title="Sil">🗑️</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function renderHizmetMobileCards(searchTerm) {
  var listEl = document.getElementById('hizmetMobileList');
  if (!listEl) return;
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  var term = (searchTerm == null ? ((document.getElementById('hizmetAramaInput') || {}).value || '') : searchTerm).trim().toLocaleLowerCase('tr-TR');
  var items = (window._hizmetList || []).filter(function(h) {
    var ad = (IP_LANG_CURRENT === 'en' && h.ad_en) ? h.ad_en : h.ad;
    if (!term) return true;
    return [ad, h.kategori, h.calisan_adi, h.isletme_adi].join(' ').toLocaleLowerCase('tr-TR').indexOf(term) !== -1;
  });

  if (!items.length) {
    listEl.innerHTML = '<div class="yonetim-mobile-empty">'+(term ? ld.randevuBulunamadi : ld.hizmetEklenmemis)+'</div>';
    return;
  }

  var sureBirim = IP_LANG_CURRENT === 'en' ? 'min' : 'dk';

  listEl.innerHTML = items.map(function(h) {
    var badgeClass = h.kategori === 'berber' ? 'b-berber' : 'b-epilasyon';
    var katAd = h.kategori === 'berber' ? (IP_LANG_CURRENT === 'en' ? 'Barber' : 'Berber') : (IP_LANG_CURRENT === 'en' ? 'Epilation' : 'Epilasyon');
    var hizmetAdi = (IP_LANG_CURRENT === 'en' && h.ad_en) ? h.ad_en : h.ad;
    return '<div class="yonetim-mobile-item">'+
      '<div class="yonetim-mobile-top">'+
        '<div><div class="yonetim-mobile-id">#'+h.id+'</div><div class="yonetim-mobile-name">'+escapeHtml(hizmetAdi || '-')+'</div></div>'+
        '<span class="badge yonetim-mobile-badge '+badgeClass+'">'+(h.kategori === 'berber' ? '✂️ ' : '✨ ')+escapeHtml(katAd)+'</span>'+
      '</div>'+
      '<div class="yonetim-mobile-lines">'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.kategori || 'Kategori')+':</span><span class="yonetim-mobile-value">'+escapeHtml(katAd)+'</span></div>'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.sureDakika || 'Sure')+':</span><span class="yonetim-mobile-value">'+escapeHtml(String(h.sure || 0) + ' ' + sureBirim)+'</span></div>'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.fiyatTL || 'Fiyat')+':</span><span class="yonetim-mobile-value">'+escapeHtml(parseFloat(h.ucret || 0).toLocaleString('tr-TR') + ' ₺')+'</span></div>'+
        '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.sorumluCalisan || 'Sorumlu Uzman')+':</span><span class="yonetim-mobile-value">'+escapeHtml(h.calisan_adi || '–')+'</span></div>'+
        (h.isletme_adi && SES.super_admin ? '<div class="yonetim-mobile-line"><span class="yonetim-mobile-label">'+(ld.isletme || 'Isletme')+':</span><span class="yonetim-mobile-value">'+escapeHtml(h.isletme_adi)+'</span></div>' : '')+
      '</div>'+
      '<div class="yonetim-mobile-bottom">'+
        '<div class="yonetim-mobile-toggle"><span>Aktif</span><label class="tog"><input type="checkbox" '+(h.aktif ? 'checked' : '')+' onchange="toggleHizmet('+h.id+',this.checked)"><span class="tog-sl"></span></label></div>'+
      '</div>'+
      '<div class="yonetim-mobile-actions">'+
        '<button class="btn btn-icon btn-ghost" data-hid="'+h.id+'" onclick="editHizmetById(this)" title="Duzenle">✏️</button>'+
        '<button class="btn btn-icon btn-danger" onclick="silHizmet('+h.id+')" title="Sil">🗑️</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

async function loadCalisanlar() {
  var tb = document.getElementById('calisanBody');
  var mobileList = document.getElementById('calisanMobileList');
  if (tb) tb.innerHTML = '<tr><td colspan="6" class="tbl-empty"><div class="sp"></div></td></tr>';
  if (mobileList) mobileList.innerHTML = '<div class="yonetim-mobile-empty"><div class="sp"></div></div>';
  var d = await api('/api/calisanlar');
  if (d && d.success) {
    window._calisanList = d.calisanlar || [];
    window._calisanlar = d.calisanlar || [];
    window._calisanMap = {};
    d.calisanlar.forEach(function(c){ window._calisanMap[c.id] = c; });
    var sel = document.getElementById('hCalisan');
    if (sel) {
      sel.innerHTML = '<option value="0">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).uzmanSecOpsiyonel+'</option>';
      window._calisanlar.forEach(function(c){ sel.innerHTML += '<option value="'+c.id+'">'+c.ad+'</option>'; });
    }
  }
  if (!d||!d.success) {
    if (tb) tb.innerHTML='<tr><td colspan="6" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).veriAlinamadi+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="yonetim-mobile-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).veriAlinamadi+'</div>';
    return;
  }
  if (!d.calisanlar.length) {
    if (tb) tb.innerHTML='<tr><td colspan="6" class="tbl-empty">'+(IP_LANGS[IP_LANG_CURRENT]||IP_LANGS['tr']).calisanEklenmemis+'</td></tr>';
    renderCalisanMobileCards('');
    return;
  }
  var uzmIco = {berber:'✂️',epilasyon:'✨',kasiyer:'💰',diger:'👤'};
  if (tb) {
    tb.innerHTML = d.calisanlar.map(function(c){
      return '<tr>'+
        '<td><b>#'+c.id+'</b></td>'+
        '<td><b>'+c.ad+'</b>'+(c.isletme_adi&&SES.super_admin?'<br><small style="color:#94a3b8">'+c.isletme_adi+'</small>':'')+
        '<td><span class="badge '+(c.uzmanlik==='berber'?'b-berber':'b-epilasyon')+'">'+
          (uzmIco[c.uzmanlik]||'👤')+' '+c.uzmanlik+'</span></td>'+
        '<td>'+(c.telefon||'–')+'</td>'+
        '<td><label class="tog"><input type="checkbox" '+(c.aktif?'checked':'')+' onchange="toggleCalisan('+c.id+',this.checked)"><span class="tog-sl"></span></label></td>'+
        '<td style="display:flex;gap:4px">'+
          '<button class="btn btn-icon btn-ghost" data-cid="'+c.id+'" onclick="editCalisanById(this)">✏️</button>'+
          '<button class="btn btn-icon btn-danger" onclick="silCalisan('+c.id+')" style="margin-left:3px">🗑️</button>'+
        '</td>'+
      '</tr>';
    }).join('');
  }
  renderCalisanMobileCards('');
}

async function loadHizmetler() {
  var tb = document.getElementById('hizmetBody');
  var mobileList = document.getElementById('hizmetMobileList');
  var ld = IP_LANGS[IP_LANG_CURRENT] || IP_LANGS['tr'];
  if (tb) tb.innerHTML = '<tr><td colspan="9" class="tbl-empty"><div class="sp"></div></td></tr>';
  if (mobileList) mobileList.innerHTML = '<div class="yonetim-mobile-empty"><div class="sp"></div></div>';
  var d = await api('/api/hizmetler');
  if (!d||!d.success) {
    if (tb) tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+ld.veriAlinamadi+'</td></tr>';
    if (mobileList) mobileList.innerHTML = '<div class="yonetim-mobile-empty">'+ld.veriAlinamadi+'</div>';
    return;
  }
  window._hizmetList = d.hizmetler || [];
  if (!d.hizmetler||!d.hizmetler.length) {
    if (tb) tb.innerHTML='<tr><td colspan="9" class="tbl-empty">'+ld.hizmetEklenmemis+'</td></tr>';
    renderHizmetMobileCards('');
    return;
  }
  var sureBirim = IP_LANG_CURRENT === 'en' ? 'min' : 'dk';
  window._hizmetMap = {};
  d.hizmetler.forEach(function(h){ window._hizmetMap[h.id] = h; });
  if (tb) {
    tb.innerHTML = d.hizmetler.map(function(h){
      var uzman = h.calisan_adi
        ? '<span style="background:#f0f9ff;border-radius:20px;padding:2px 8px;font-size:12px;color:#0369a1">👤 '+h.calisan_adi+'</span>'
        : '<span style="color:#cbd5e1;font-size:12px">—</span>';
      var katAd = h.kategori === 'berber'
        ? (IP_LANG_CURRENT === 'en' ? 'Barber' : 'Berber')
        : (IP_LANG_CURRENT === 'en' ? 'Epilation' : 'Epilasyon');
      var hizmetAdi = (IP_LANG_CURRENT === 'en' && h.ad_en) ? h.ad_en : h.ad;
      return '<tr>'+
        '<td><b>#'+h.id+'</b></td>'+
        '<td><b>'+hizmetAdi+'</b>'+(h.isletme_adi&&SES.super_admin?'<br><small style="color:#94a3b8">'+h.isletme_adi+'</small>':'')+'</td>'+
        '<td><span class="badge '+(h.kategori==='berber'?'b-berber':'b-epilasyon')+'">'+(h.kategori==='berber'?'✂️':'✨')+' '+katAd+'</span></td>'+
        '<td>'+h.sure+' '+sureBirim+'</td>'+
        '<td><b>'+parseFloat(h.ucret).toLocaleString('tr-TR')+' ₺</b></td>'+
        '<td>'+uzman+'</td>'+
        '<td><label class="tog"><input type="checkbox" '+(h.aktif?'checked':'')+' onchange="toggleHizmet('+h.id+',this.checked)"><span class="tog-sl"></span></label></td>'+
        '<td style="display:flex;gap:4px">'+
          '<button class="btn btn-icon btn-ghost" data-hid="'+h.id+'" onclick="editHizmetById(this)">✏️</button>'+
          '<button class="btn btn-icon btn-danger" onclick="silHizmet('+h.id+')" style="margin-left:3px">🗑️</button>'+
        '</td>'+
      '</tr>';
    }).join('');
  }
  renderHizmetMobileCards('');
}
