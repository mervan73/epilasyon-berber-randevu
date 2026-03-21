# =====================================================
# YÖNETİCİ PANELİ - admin.py  |  http://localhost:5001
# =====================================================
import os
from flask import Flask, render_template, request, jsonify, session, redirect
from flask_cors import CORS
import pyodbc

# Templates klasörünü kesin olarak belirt
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(BASE_DIR, 'templates'),
                      static_folder=os.path.join(BASE_DIR, 'static'))
app.secret_key = 'admin-panel-gizli-anahtar-2024'
CORS(app)

SERVER   = 'DESKTOP-T20P6DA\\SQLEXPRESS'
DATABASE = 'BerberRandevu'
CONN_STR = f'DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

def get_db():
    return pyodbc.connect(CONN_STR, timeout=5)

def sutun_ekle(cur, tablo, sutun, tanim):
    """Sütun yoksa ekle"""
    cur.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND COLUMN_NAME=?", (tablo, sutun))
    if cur.fetchone()[0] == 0:
        cur.execute(f"ALTER TABLE {tablo} ADD {sutun} {tanim}")
        print(f"  ➕ {tablo}.{sutun} eklendi")

def init_db():
    conn = get_db(); cur = conn.cursor()

    # ── adminler ──────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='adminler' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE adminler(
            id            INT IDENTITY(1,1) PRIMARY KEY,
            kullanici_adi NVARCHAR(50)  NOT NULL UNIQUE,
            sifre         NVARCHAR(100) NOT NULL,
            ad            NVARCHAR(100) NULL,
            email         NVARCHAR(100) NULL,
            telefon       NVARCHAR(20)  NULL,
            kayit_tarihi  DATETIME DEFAULT GETDATE(),
            aktif         BIT DEFAULT 1)""")
        print("  ✅ adminler tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'adminler', 'ad',           'NVARCHAR(100) NULL')
        sutun_ekle(cur, 'adminler', 'email',         'NVARCHAR(100) NULL')
        sutun_ekle(cur, 'adminler', 'telefon',       'NVARCHAR(20)  NULL')
        sutun_ekle(cur, 'adminler', 'kayit_tarihi',  'DATETIME DEFAULT GETDATE()')
        sutun_ekle(cur, 'adminler', 'aktif',         'BIT DEFAULT 1')

    # ── kullanicilar ──────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='kullanicilar' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE kullanicilar(
            id           INT IDENTITY(1,1) PRIMARY KEY,
            ad           NVARCHAR(100) NOT NULL,
            email        NVARCHAR(100) NOT NULL UNIQUE,
            sifre        NVARCHAR(100) NOT NULL,
            telefon      NVARCHAR(20),
            kayit_tarihi DATETIME DEFAULT GETDATE(),
            is_admin     BIT DEFAULT 0)""")
        print("  ✅ kullanicilar tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'kullanicilar', 'is_admin',     'BIT DEFAULT 0')
        sutun_ekle(cur, 'kullanicilar', 'kayit_tarihi', 'DATETIME DEFAULT GETDATE()')

    # ── isletmeler ────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='isletmeler' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE isletmeler(
            id           INT IDENTITY(1,1) PRIMARY KEY,
            ad           NVARCHAR(200) NOT NULL,
            tur          NVARCHAR(50)  NOT NULL,
            adres        NVARCHAR(500),
            telefon      NVARCHAR(20),
            aciklama     NVARCHAR(MAX),
            aktif        BIT DEFAULT 1,
            kayit_tarihi DATETIME DEFAULT GETDATE())""")
        print("  ✅ isletmeler tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'isletmeler', 'aktif',        'BIT DEFAULT 1')
        sutun_ekle(cur, 'isletmeler', 'tur',          "NVARCHAR(50) NOT NULL DEFAULT 'berber'")
        sutun_ekle(cur, 'isletmeler', 'adres',        'NVARCHAR(500)')
        sutun_ekle(cur, 'isletmeler', 'aciklama',     'NVARCHAR(MAX)')
        sutun_ekle(cur, 'isletmeler', 'kayit_tarihi', 'DATETIME DEFAULT GETDATE()')
        # kullanici_id NULL olsun (eski şema kalıntısı)
        try:
            cur.execute("ALTER TABLE isletmeler ALTER COLUMN kullanici_id INT NULL")
            print("  🔧 isletmeler.kullanici_id → NULL yapıldı")
        except: pass

    # ── hizmetler ─────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='hizmetler' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE hizmetler(
            id         INT IDENTITY(1,1) PRIMARY KEY,
            isletme_id INT NOT NULL,
            ad         NVARCHAR(100)  NOT NULL,
            kategori   NVARCHAR(50)   NOT NULL,
            sure       INT            NOT NULL,
            ucret      DECIMAL(10,2)  NOT NULL,
            aktif      BIT DEFAULT 1,
            FOREIGN KEY(isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE)""")
        print("  ✅ hizmetler tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'hizmetler', 'isletme_id', 'INT NULL')
        sutun_ekle(cur, 'hizmetler', 'kategori',   "NVARCHAR(50) NOT NULL DEFAULT 'berber'")
        sutun_ekle(cur, 'hizmetler', 'sure',       'INT NOT NULL DEFAULT 30')
        sutun_ekle(cur, 'hizmetler', 'ucret',      'DECIMAL(10,2) NOT NULL DEFAULT 0')
        sutun_ekle(cur, 'hizmetler', 'aktif',      'BIT DEFAULT 1')

    # ── calisanlar ────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='calisanlar' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE calisanlar(
            id         INT IDENTITY(1,1) PRIMARY KEY,
            isletme_id INT NOT NULL,
            ad         NVARCHAR(100) NOT NULL,
            uzmanlik   NVARCHAR(50)  NOT NULL,
            telefon    NVARCHAR(20),
            aktif      BIT DEFAULT 1,
            FOREIGN KEY(isletme_id) REFERENCES isletmeler(id) ON DELETE CASCADE)""")
        print("  ✅ calisanlar tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'calisanlar', 'isletme_id', 'INT NULL')
        sutun_ekle(cur, 'calisanlar', 'uzmanlik',   "NVARCHAR(50) NOT NULL DEFAULT 'berber'")
        sutun_ekle(cur, 'calisanlar', 'aktif',      'BIT DEFAULT 1')

    # ── randevular ────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='randevular' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""CREATE TABLE randevular(
            id               INT IDENTITY(1,1) PRIMARY KEY,
            kullanici_id     INT,
            isletme_id       INT NOT NULL,
            calisan_id       INT,
            hizmet_id        INT,
            musteri_adi      NVARCHAR(100) NOT NULL,
            musteri_telefon  NVARCHAR(20)  NOT NULL,
            tarih            DATE NOT NULL,
            saat             TIME NOT NULL,
            durum            NVARCHAR(20) DEFAULT 'bekliyor',
            notlar           NVARCHAR(500),
            olusturma_tarihi DATETIME DEFAULT GETDATE())""")
        print("  ✅ randevular tablosu oluşturuldu")
    else:
        sutun_ekle(cur, 'randevular', 'musteri_adi',     'NVARCHAR(100) NULL')
        sutun_ekle(cur, 'randevular', 'musteri_telefon', 'NVARCHAR(20)  NULL')
        sutun_ekle(cur, 'randevular', 'durum',           "NVARCHAR(20) DEFAULT 'bekliyor'")
        sutun_ekle(cur, 'randevular', 'notlar',          'NVARCHAR(500)')
        sutun_ekle(cur, 'randevular', 'olusturma_tarihi','DATETIME DEFAULT GETDATE()')

    conn.commit(); conn.close()
    print("✅ Veritabanı hazır")

try:
    init_db()
except Exception as e:
    print(f"⚠️  DB init hatası: {e}")

# ── SAYFALAR ──────────────────────────────────────────
@app.route('/')
def index():
    if not session.get('admin_giris'):
        return redirect('/giris')
    return render_template('admin.html')

@app.route('/giris')
def giris_sayfasi():
    if session.get('admin_giris'):
        return redirect('/')
    return render_template('admin_giris.html')

@app.route('/kayit')
def kayit_sayfasi():
    if session.get('admin_giris'):
        return redirect('/')
    # Önce template'i dene, yoksa inline HTML döndür
    try:
        return render_template('admin_kayit.html')
    except Exception:
        pass
    return '''<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Yönetici Kaydı</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f2b3d,#1b4a6b,#2d7a9a);padding:20px}
.card{background:#fff;border-radius:24px;padding:44px;width:100%;max-width:480px;box-shadow:0 32px 80px rgba(0,0,0,.4)}
.logo{width:68px;height:68px;background:linear-gradient(135deg,#0f2b3d,#1b4a6b);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:30px}
h1{font-size:1.55rem;font-weight:800;color:#0f2b3d;text-align:center;margin-bottom:4px}
.sub{color:#64748b;font-size:13px;text-align:center;margin-bottom:22px}
.field{margin-bottom:13px}
.field label{display:block;font-size:12.5px;font-weight:600;color:#475569;margin-bottom:5px}
.field input{width:100%;padding:11px 13px;border:2px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;color:#1e293b;outline:none;transition:.2s}
.field input:focus{border-color:#1b4a6b;box-shadow:0 0 0 3px rgba(27,74,107,.1)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{width:100%;padding:13px;background:linear-gradient(135deg,#0f2b3d,#1b4a6b);color:#fff;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px;transition:.2s}
.btn:hover{transform:translateY(-1px)}
.btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.alert{padding:10px 13px;border-radius:10px;font-size:13px;margin-bottom:12px;display:none}
.err{background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626}
.suc{background:#f0fdf4;border:1.5px solid #bbf7d0;color:#15803d}
.info-box{background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:10px;padding:10px 13px;font-size:12.5px;color:#0369a1;margin-bottom:16px;line-height:1.6}
.footer{text-align:center;margin-top:18px;font-size:13px;color:#64748b}
.footer a{color:#1b4a6b;font-weight:700;text-decoration:none}
.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .6s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes sp{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="card">
  <div class="logo">&#128081;</div>
  <h1>Y&#246;netici Kayd&#305;</h1>
  <p class="sub">S&#252;per Admin hesab&#305; olu&#351;turun</p>
  <div class="info-box">
    &#128274; Bu sayfa yaln&#305;zca <strong>S&#252;per Admin</strong> hesab&#305; olu&#351;turmak i&#231;indir.<br>
    &#304;&#351;letme sahipleri <a href="http://localhost:5002/giris" style="color:#0369a1;font-weight:700">i&#351;letme panelinden</a> kay&#305;t olmal&#305;d&#305;r.
  </div>
  <div id="err" class="alert err"></div>
  <div id="suc" class="alert suc"></div>
  <div class="field"><label>Ad Soyad *</label><input type="text" id="ad" placeholder="Ad&#305;n&#305;z ve soyad&#305;n&#305;z"></div>
  <div class="row2">
    <div class="field"><label>E-posta *</label><input type="email" id="email" placeholder="ornek@email.com"></div>
    <div class="field"><label>Telefon</label><input type="tel" id="tel" placeholder="0555 555 55 55"></div>
  </div>
  <div class="row2">
    <div class="field"><label>&#350;ifre *</label><input type="password" id="sifre" placeholder="En az 6 karakter"></div>
    <div class="field"><label>&#350;ifre Tekrar *</label><input type="password" id="sifre2" placeholder="&#350;ifrenizi tekrarlay&#305;n"></div>
  </div>
  <div class="field"><label>&#128274; Admin Kay&#305;t Kodu *</label><input type="password" id="kod" placeholder="Y&#246;neticiden al&#305;nan kod"></div>
  <button class="btn" id="btn" onclick="kayit()">&#128081; S&#252;per Admin Hesab&#305; Olu&#351;tur</button>
  <div class="footer"><a href="/giris">Giri&#351; Yap</a> &nbsp;&middot;&nbsp; <a href="http://localhost:5002/giris">&#304;&#351;letme Paneli &rarr;</a></div>
</div>
<script>
function show(id,type,msg){var e=document.getElementById(id);e.className="alert "+type;e.textContent=(type==="err"?"⚠️ ":"✅ ")+msg;e.style.display="block";}
function hide(){["err","suc"].forEach(function(i){document.getElementById(i).style.display="none";});}
async function kayit(){
  var ad=document.getElementById("ad").value.trim();
  var email=document.getElementById("email").value.trim();
  var tel=document.getElementById("tel").value.trim();
  var sifre=document.getElementById("sifre").value;
  var sifre2=document.getElementById("sifre2").value;
  var kod=document.getElementById("kod").value.trim();
  var btn=document.getElementById("btn");
  hide();
  if(!ad){show("err","err","Ad Soyad zorunludur!");return;}
  if(!email){show("err","err","E-posta zorunludur!");return;}
  if(sifre.length<6){show("err","err","Şifre en az 6 karakter!");return;}
  if(sifre!==sifre2){show("err","err","Şifreler eşleşmiyor!");return;}
  if(!kod){show("err","err","Admin kayıt kodu zorunludur!");return;}
  btn.innerHTML="<span class=\\"spin\\"></span>Oluşturuluyor...";btn.disabled=true;
  try{
    var res=await fetch("/api/admin/kayit",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ad:ad,email:email,telefon:tel,sifre:sifre,admin_kodu:kod,isletme_id:null})});
    var data=await res.json();
    if(data.success){show("suc","suc",data.message+" Giriş yapabilirsiniz.");setTimeout(function(){window.location.href="/giris";},2000);}
    else{show("err","err",data.message||"Kayıt başarısız!");}
  }catch(e){show("err","err","Sunucuya bağlanılamadı!");}
  finally{btn.innerHTML="👑 Süper Admin Hesabı Oluştur";btn.disabled=false;}
}
</script>
</body>
</html>'''

# İşletme listesi (kayıt formunda dropdown için)
@app.route('/api/isletmeler-listesi')
def isletmeler_listesi():
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id, ad, tur FROM isletmeler WHERE aktif=1 ORDER BY ad")
        rows = [{'id': r[0], 'ad': r[1], 'tur': r[2]} for r in cur.fetchall()]
        conn.close()
        return jsonify({'success': True, 'isletmeler': rows})
    except Exception as e:
        return jsonify({'success': False, 'isletmeler': []}), 500

# ── KAYIT API ─────────────────────────────────────────
# Kayıtlar adminler tablosuna gidiyor
@app.route('/api/admin/kayit', methods=['POST'])
def admin_kayit():
    data       = request.json
    ad         = (data.get('ad') or '').strip()
    email      = (data.get('email') or '').strip()
    sifre      = data.get('sifre') or ''
    telefon    = (data.get('telefon') or '').strip()
    kod        = (data.get('admin_kodu') or '').strip()
    isletme_id = data.get('isletme_id') or None   # None = süper admin

    if kod != 'ADMIN2024':
        return jsonify({'success': False, 'message': '❌ Geçersiz admin kayıt kodu!'}), 403
    if not ad or not email or not sifre:
        return jsonify({'success': False, 'message': '❌ Ad, email ve şifre zorunludur!'}), 400
    if len(sifre) < 6:
        return jsonify({'success': False, 'message': '❌ Şifre en az 6 karakter olmalı!'}), 400

    kullanici_adi = email
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("SELECT id FROM adminler WHERE kullanici_adi=?", (kullanici_adi,))
        if cur.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': '❌ Bu email ile zaten kayıtlı admin var!'}), 400

        # isletme_id sayıya çevir veya None bırak
        eid = int(isletme_id) if isletme_id else None

        cur.execute("""
            INSERT INTO adminler (kullanici_adi, sifre, ad, email, telefon, isletme_id, kayit_tarihi, aktif)
            VALUES (?, ?, ?, ?, ?, ?, GETDATE(), 1)
        """, (kullanici_adi, sifre, ad, email, telefon, eid))

        conn.commit(); conn.close()
        rol = 'İşletme Yöneticisi' if eid else 'Süper Admin'
        return jsonify({'success': True, 'message': f'✅ {rol} hesabı oluşturuldu!'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'❌ {str(e)}'}), 500


# ── GİRİŞ / ÇIKIŞ ────────────────────────────────────
# Giriş adminler tablosundan yapılıyor
@app.route('/api/admin/giris', methods=['POST'])
def admin_giris():
    data  = request.json
    email = (data.get('email') or '').strip()
    sifre = data.get('sifre') or ''
    try:
        conn = get_db(); cur = conn.cursor()
        # kullanici_adi = email şeklinde kayıt yapıyoruz
        cur.execute("""
            SELECT id, ISNULL(ad, kullanici_adi)
            FROM adminler
            WHERE kullanici_adi=? AND sifre=? AND ISNULL(aktif,1)=1
              AND isletme_id IS NULL
        """, (email, sifre))
        user = cur.fetchone(); conn.close()
        if user:
            session['admin_giris'] = True
            session['admin_id']    = user[0]
            session['admin_ad']    = user[1]
            return jsonify({'success': True, 'ad': user[1]})
        return jsonify({'success': False, 'message': '❌ Hatalı email/şifre veya bu panele erişim yetkiniz yok!'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/cikis', methods=['POST'])
def admin_cikis():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/admin/oturum')
def admin_oturum():
    if session.get('admin_giris'):
        return jsonify({'success': True, 'ad': session.get('admin_ad')})
    return jsonify({'success': False}), 401

# ── İSTATİSTİK ────────────────────────────────────────
@app.route('/api/admin/istatistikler')
def istatistikler():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        def cnt(q): cur.execute(q); return cur.fetchone()[0]
        s = {
            'isletme':        cnt("SELECT COUNT(*) FROM isletmeler WHERE aktif=1"),
            'calisan':        cnt("SELECT COUNT(*) FROM calisanlar WHERE aktif=1"),
            'hizmet':         cnt("SELECT COUNT(*) FROM hizmetler  WHERE aktif=1"),
            'toplam_randevu': cnt("SELECT COUNT(*) FROM randevular"),
            'bekleyen':       cnt("SELECT COUNT(*) FROM randevular WHERE durum='bekliyor'"),
            'onaylanan':      cnt("SELECT COUNT(*) FROM randevular WHERE durum='onaylandi'"),
        }
        conn.close()
        return jsonify({'success': True, 'stats': s})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── İŞLETME ──────────────────────────────────────────
@app.route('/api/admin/isletmeler')
def isletmeleri_getir():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""SELECT i.id,i.ad,i.tur,i.adres,i.telefon,i.aciklama,i.aktif,
            CONVERT(VARCHAR,i.kayit_tarihi,120) as kayit_tarihi,
            (SELECT COUNT(*) FROM hizmetler h WHERE h.isletme_id=i.id AND h.aktif=1) as hizmet_sayisi,
            (SELECT COUNT(*) FROM calisanlar c WHERE c.isletme_id=i.id AND c.aktif=1) as calisan_sayisi
            FROM isletmeler i ORDER BY i.id DESC""")
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols,r)) for r in cur.fetchall()]
        for r in rows: r['aktif'] = bool(r['aktif'])
        conn.close()
        return jsonify({'success': True, 'isletmeler': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-ekle', methods=['POST'])
def isletme_ekle():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    if not d.get('ad') or not d.get('tur'): return jsonify({'success': False, 'message': 'Ad ve tür zorunlu!'}), 400
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("INSERT INTO isletmeler(ad,tur,adres,telefon,aciklama,aktif) VALUES(?,?,?,?,?,1)",
                    (d['ad'],d['tur'],d.get('adres',''),d.get('telefon',''),d.get('aciklama','')))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ İşletme kaydedildi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-guncelle/<int:iid>', methods=['PUT'])
def isletme_guncelle(iid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE isletmeler SET ad=?,tur=?,adres=?,telefon=?,aciklama=?,aktif=? WHERE id=?",
                    (d['ad'],d['tur'],d.get('adres',''),d.get('telefon',''),d.get('aciklama',''),
                     1 if d.get('aktif',True) else 0, iid))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ İşletme güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-sil/<int:iid>', methods=['DELETE'])
def isletme_sil(iid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM isletmeler WHERE id=?", (iid,))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ İşletme silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── HİZMET ───────────────────────────────────────────
@app.route('/api/admin/hizmetler')
def hizmetleri_getir():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    iid = request.args.get('isletme_id','')
    try:
        conn = get_db(); cur = conn.cursor()
        if iid:
            cur.execute("""SELECT h.id,h.isletme_id,h.ad,h.kategori,h.sure,h.ucret,h.aktif,i.ad as isletme_adi
                FROM hizmetler h LEFT JOIN isletmeler i ON h.isletme_id=i.id
                WHERE h.isletme_id=? ORDER BY h.kategori,h.ad""", (iid,))
        else:
            cur.execute("""SELECT h.id,h.isletme_id,h.ad,h.kategori,h.sure,h.ucret,h.aktif,i.ad as isletme_adi
                FROM hizmetler h LEFT JOIN isletmeler i ON h.isletme_id=i.id
                ORDER BY i.ad,h.kategori,h.ad""")
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols,r)) for r in cur.fetchall()]
        for r in rows: r['aktif']=bool(r['aktif']); r['ucret']=float(r['ucret'])
        conn.close()
        return jsonify({'success': True, 'hizmetler': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-ekle', methods=['POST'])
def hizmet_ekle():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    if not d.get('isletme_id') or not d.get('ad'): return jsonify({'success': False, 'message': 'İşletme ve ad zorunlu!'}), 400
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("INSERT INTO hizmetler(isletme_id,ad,kategori,sure,ucret,aktif) VALUES(?,?,?,?,?,1)",
                    (d['isletme_id'],d['ad'],d.get('kategori','berber'),int(d.get('sure',30)),float(d.get('ucret',0))))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Hizmet kaydedildi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-guncelle/<int:hid>', methods=['PUT'])
def hizmet_guncelle(hid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE hizmetler SET ad=?,kategori=?,sure=?,ucret=?,aktif=? WHERE id=?",
                    (d['ad'],d['kategori'],int(d['sure']),float(d['ucret']),1 if d.get('aktif',True) else 0,hid))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Hizmet güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-sil/<int:hid>', methods=['DELETE'])
def hizmet_sil(hid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM hizmetler WHERE id=?", (hid,))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Hizmet silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── ÇALIŞAN ──────────────────────────────────────────
@app.route('/api/admin/calisanlar')
def calisanlari_getir():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    iid = request.args.get('isletme_id','')
    try:
        conn = get_db(); cur = conn.cursor()
        if iid:
            cur.execute("""SELECT c.id,c.isletme_id,c.ad,c.uzmanlik,c.telefon,c.aktif,i.ad as isletme_adi
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id
                WHERE c.isletme_id=? ORDER BY c.ad""", (iid,))
        else:
            cur.execute("""SELECT c.id,c.isletme_id,c.ad,c.uzmanlik,c.telefon,c.aktif,i.ad as isletme_adi
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id ORDER BY i.ad,c.ad""")
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols,r)) for r in cur.fetchall()]
        for r in rows: r['aktif']=bool(r['aktif'])
        conn.close()
        return jsonify({'success': True, 'calisanlar': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-ekle', methods=['POST'])
def calisan_ekle():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    if not d.get('isletme_id') or not d.get('ad'): return jsonify({'success': False, 'message': 'İşletme ve ad zorunlu!'}), 400
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("INSERT INTO calisanlar(isletme_id,ad,uzmanlik,telefon,aktif) VALUES(?,?,?,?,1)",
                    (d['isletme_id'],d['ad'],d.get('uzmanlik','berber'),d.get('telefon','')))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Çalışan kaydedildi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-guncelle/<int:cid>', methods=['PUT'])
def calisan_guncelle(cid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    d = request.json
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE calisanlar SET ad=?,uzmanlik=?,telefon=?,aktif=? WHERE id=?",
                    (d['ad'],d['uzmanlik'],d.get('telefon',''),1 if d.get('aktif',True) else 0,cid))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Çalışan güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-sil/<int:cid>', methods=['DELETE'])
def calisan_sil(cid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("DELETE FROM calisanlar WHERE id=?", (cid,))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Çalışan silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── RANDEVU ──────────────────────────────────────────
@app.route('/api/admin/randevular')
def randevulari_getir():
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("""SELECT r.id,
            CONVERT(VARCHAR,r.tarih,23) as tarih,
            CONVERT(VARCHAR,r.saat,108) as saat,
            r.durum,r.notlar,r.musteri_adi,r.musteri_telefon,
            k.ad as kullanici_adi, i.ad as isletme_adi,
            c.ad as calisan_adi, h.ad as hizmet_adi, h.ucret
            FROM randevular r
            LEFT JOIN kullanicilar k ON r.kullanici_id=k.id
            LEFT JOIN isletmeler i ON r.isletme_id=i.id
            LEFT JOIN calisanlar c ON r.calisan_id=c.id
            LEFT JOIN hizmetler h ON r.hizmet_id=h.id
            ORDER BY r.tarih DESC, r.saat DESC""")
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols,r)) for r in cur.fetchall()]
        for r in rows:
            if r.get('ucret') is not None: r['ucret']=float(r['ucret'])
        conn.close()
        return jsonify({'success': True, 'randevular': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/randevu-durum/<int:rid>', methods=['POST'])
def randevu_durum(rid):
    if not session.get('admin_giris'): return jsonify({'success': False}), 401
    durum = request.json.get('durum')
    if durum not in ('bekliyor','onaylandi','tamamlandi','iptal'):
        return jsonify({'success': False, 'message': 'Geçersiz durum!'}), 400
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute("UPDATE randevular SET durum=? WHERE id=?", (durum,rid))
        conn.commit(); conn.close()
        return jsonify({'success': True, 'message': '✅ Durum güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ── BAŞLAT ────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("👑 YÖNETİCİ PANELİ")
    print("=" * 50)
    print(f"📁 Templates: {os.path.join(BASE_DIR, 'templates')}")
    print("🌐  http://localhost:5001")
    print("🔑  http://localhost:5001/giris")
    print("📝  http://localhost:5001/kayit")
    print("🔒  Kayıt kodu: ADMIN2024")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)