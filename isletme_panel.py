# =====================================================================
# İŞLETME YÖNETİM PANELİ — port 5002
# Kök klasöre koy (app.py ile aynı yere)
# =====================================================================
import os, re, json
from flask import Flask, render_template, request, jsonify, session, redirect
from flask_cors import CORS
import pyodbc
import urllib.request as urllib_req
import urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__,
    template_folder=os.path.join(BASE, 'templates'),
    static_folder=os.path.join(BASE, 'static'))
app.secret_key = 'isletme-panel-2024-xyz'
CORS(app)

SERVER   = 'DESKTOP-T20P6DA\\SQLEXPRESS'
DATABASE = 'BerberRandevu'
CONN     = f'DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

def db():
    return pyodbc.connect(CONN, timeout=10)

# ─────────────────────────────────────────────────────────────────
# OTOMATİK ÇEVİRİ — Google Translate (ücretsiz, key gerektirmez)
# ─────────────────────────────────────────────────────────────────
def auto_translate_tr_en(text):
    """Türkçe hizmet adını Google Translate ile İngilizce'ye çevirir.
    Key gerekmez, ücretsiz, her zaman çalışır."""
    if not text or not text.strip():
        return ''
    try:
        params = urllib.parse.urlencode({
            'client': 'gtx',
            'sl': 'tr',
            'tl': 'en',
            'dt': 't',
            'q': text.strip()
        })
        url = f'https://translate.googleapis.com/translate_a/single?{params}'
        req = urllib_req.Request(url, headers={
            'User-Agent': 'Mozilla/5.0'
        })
        with urllib_req.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            # Google yanıt formatı: [[[çeviri, orijinal, ...], ...], ...]
            result = data[0][0][0].strip()
            print(f"  [çeviri] '{text}' → '{result}'")
            if result and len(result) < 150:
                return result
    except Exception as ex:
        print(f"  [çeviri] Hata: {ex}")
    return ''

# ─────────────────────────────────────────────────────────────────
# VERİTABANI HAZIRLIK
# ─────────────────────────────────────────────────────────────────
def init_db():
    con = db(); cur = con.cursor()

    # ADIM 1 — Tüm FK constraint'leri kaldır (hata kaynağı)
    try:
        cur.execute("""
            DECLARE @sql NVARCHAR(MAX) = ''
            SELECT @sql = @sql + 'ALTER TABLE ' + OBJECT_NAME(parent_object_id)
                        + ' DROP CONSTRAINT ' + name + '; '
            FROM sys.foreign_keys
            WHERE OBJECT_NAME(parent_object_id) IN ('calisma_saatleri','tatil_gunleri')
            IF @sql <> '' EXEC sp_executesql @sql
        """)
        con.commit()
        print("✅ FK constraint'ler temizlendi")
    except Exception as e:
        print(f"  FK temizle: {e}")
        try: con.rollback()
        except: pass

    # ADIM 2 — Eksik sütunları ekle
    def sutun(tablo, ad, tanim):
        try:
            cur.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND COLUMN_NAME=?", tablo, ad)
            if cur.fetchone()[0] == 0:
                cur.execute(f"ALTER TABLE {tablo} ADD {ad} {tanim}")
                print(f"  + {tablo}.{ad}")
        except Exception as ex:
            print(f"  sutun({tablo},{ad}): {ex}")

    sutun('adminler',   'isletme_id',   'INT NULL')
    sutun('adminler',   'ad',           'NVARCHAR(100) NULL')
    sutun('adminler',   'email',        'NVARCHAR(100) NULL')
    sutun('adminler',   'telefon',      'NVARCHAR(20) NULL')
    sutun('adminler',   'aktif',        'BIT DEFAULT 1')
    sutun('adminler',   'kayit_tarihi', 'DATETIME DEFAULT GETDATE()')
    sutun('isletmeler', 'aktif',        'BIT DEFAULT 1')
    sutun('isletmeler', 'aciklama',     'NVARCHAR(MAX) NULL')
    # Yönetici bilgileri — adminler tablosundan BAĞIMSIZ
    sutun('isletmeler', 'yonetici_ad',  'NVARCHAR(100) NULL')
    sutun('isletmeler', 'yonetici_tel', 'NVARCHAR(20) NULL')
    sutun('isletmeler', 'email',        'NVARCHAR(100) NULL')
    sutun('isletmeler', 'sifre',        'NVARCHAR(200) NULL')
    sutun('hizmetler',  'aktif',        'BIT DEFAULT 1')
    sutun('hizmetler',  'calisan_id',   'INT NULL')   # ← hizmete çalışan bağlama
    sutun('hizmetler',  'ad_en',        'NVARCHAR(200) NULL')  # ← İngilizce hizmet adı
    sutun('calisanlar', 'aktif',        'BIT DEFAULT 1')

    # NULL aktif düzelt
    for t in ('hizmetler', 'calisanlar', 'isletmeler'):
        try: cur.execute(f"UPDATE {t} SET aktif=1 WHERE aktif IS NULL")
        except: pass

    # ADIM 3 — calisma_saatleri — KESİNLİKLE FK CONSTRAINT YOK
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='calisma_saatleri' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            CREATE TABLE calisma_saatleri(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                gun_no     INT NOT NULL,
                acilis     TIME NOT NULL,
                kapanis    TIME NOT NULL,
                kapali     BIT NOT NULL DEFAULT 0,
                CONSTRAINT UQ_CS UNIQUE(isletme_id, gun_no)
            )
        """)
        print("  + calisma_saatleri tablosu (FK yok)")

    # ADIM 4 — tatil_gunleri — KESİNLİKLE FK CONSTRAINT YOK
    cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='tatil_gunleri' AND xtype='U'")
    if cur.fetchone()[0] == 0:
        cur.execute("""
            CREATE TABLE tatil_gunleri(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                tarih      DATE NOT NULL,
                aciklama   NVARCHAR(200) NULL,
                CONSTRAINT UQ_TG UNIQUE(isletme_id, tarih)
            )
        """)
        print("  + tatil_gunleri tablosu (FK yok)")

    con.commit()

    # ADIM 5 — Mevcut işletmeler için eksik calisma_saatleri satırları
    try:
        cur.execute("SELECT id FROM isletmeler")
        isletmeler = [r[0] for r in cur.fetchall()]
        for iid in isletmeler:
            for g in range(1, 8):
                cur.execute("SELECT COUNT(*) FROM calisma_saatleri WHERE isletme_id=? AND gun_no=?", iid, g)
                if cur.fetchone()[0] == 0:
                    cur.execute(
                        "INSERT INTO calisma_saatleri(isletme_id,gun_no,acilis,kapanis,kapali) VALUES(?,?,'09:00','19:00',?)",
                        iid, g, 1 if g == 7 else 0)
        con.commit()
        print("  ✅ calisma_saatleri tamamlandı")
    except Exception as e:
        print(f"  calisma_saatleri satirlari: {e}")
        try: con.rollback()
        except: pass

    con.close()
    print("✅ Veritabanı hazır")

try:
    init_db()
except Exception as ex:
    print(f"⚠️ DB init: {ex}")

# ─────────────────────────────────────────────────────────────────
# YARDIMCILAR
# ─────────────────────────────────────────────────────────────────
def giris_yok():
    return not session.get('ok')

def eid():
    return session.get('isletme_id')  # None → süper admin

def zaman_str(v):
    if v is None: return '00:00'
    if isinstance(v, str): return v[:5]
    if hasattr(v, 'strftime'): return v.strftime('%H:%M')
    if hasattr(v, 'seconds'):
        s = int(v.seconds)
        return f"{s//3600:02d}:{(s%3600)//60:02d}"
    return str(v)[:5]

# ─────────────────────────────────────────────────────────────────
# SAYFALAR
# ─────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    if giris_yok(): return redirect('/giris')
    return render_template('isletme_panel.html')

@app.route('/giris')
def giris_sayfasi():
    if not giris_yok(): return redirect('/')
    return render_template('isletme_giris.html')

# ─────────────────────────────────────────────────────────────────
# KAYIT — işletme + yönetici birlikte
# ─────────────────────────────────────────────────────────────────
@app.route('/api/kayit', methods=['POST'])
def kayit():
    try:
        d = request.get_json(force=True, silent=True) or {}
        ad    = (d.get('ad')      or '').strip()
        email = (d.get('email')   or '').strip().lower()
        sifre = (d.get('sifre')   or '')
        tel   = (d.get('telefon') or '').strip()
        i_ad  = (d.get('isletme_ad')  or '').strip()
        i_tur = (d.get('isletme_tur') or 'berber').strip()
        i_adr = (d.get('isletme_adres')   or '').strip()
        i_tel = (d.get('isletme_tel') or d.get('isletme_telefon') or '').strip()

        if not ad or not email or not sifre or not i_ad:
            return jsonify(success=False, message='Ad, email, şifre ve işletme adı zorunludur!'), 400
        if len(sifre) < 6:
            return jsonify(success=False, message='Şifre en az 6 karakter!'), 400

        con = db(); cur = con.cursor()

        # Email benzersiz mi kontrol et (isletmeler tablosunda)
        cur.execute("SELECT COUNT(*) FROM isletmeler WHERE email=?", email)
        if cur.fetchone()[0] > 0:
            con.close()
            return jsonify(success=False, message='Bu e-posta ile zaten kayıtlı bir işletme var!'), 400

        # Sadece isletmeler tablosuna kayıt — adminler tablosuna DOKUNMA
        cur.execute("""
            INSERT INTO isletmeler(ad,tur,adres,telefon,aktif,kayit_tarihi,
                                   yonetici_ad,yonetici_tel,email,sifre)
            VALUES(?,?,?,?,1,GETDATE(),?,?,?,?)
        """, i_ad, i_tur, i_adr, i_tel, ad, tel, email, sifre)

        # Yeni işletmenin id'si
        cur.execute("SELECT TOP 1 id FROM isletmeler ORDER BY id DESC")
        row = cur.fetchone()
        if not row:
            con.close()
            return jsonify(success=False, message='İşletme kaydedilemedi!'), 500
        yeni_eid = row[0]

        # Varsayılan çalışma saatleri
        for g in range(1, 8):
            cur.execute("SELECT COUNT(*) FROM calisma_saatleri WHERE isletme_id=? AND gun_no=?", yeni_eid, g)
            if cur.fetchone()[0] == 0:
                cur.execute(
                    "INSERT INTO calisma_saatleri(isletme_id,gun_no,acilis,kapanis,kapali) VALUES(?,?,'09:00','19:00',?)",
                    yeni_eid, g, 1 if g == 7 else 0)

        con.commit(); con.close()
        return jsonify(success=True, message=f'"{i_ad}" işletmesi oluşturuldu! Giriş yapabilirsiniz.')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# GİRİŞ / ÇIKIŞ / OTURUM
# ─────────────────────────────────────────────────────────────────
@app.route('/api/giris', methods=['POST'])
def giris():
    try:
        d     = request.get_json(force=True, silent=True) or {}
        email = (d.get('email') or '').strip().lower()
        sifre = (d.get('sifre') or '')
        if not email or not sifre:
            return jsonify(success=False, message='Email ve şifre zorunludur!'), 400

        con = db(); cur = con.cursor()
        # isletmeler tablosundan giriş yap (adminler tablosundan BAĞIMSIZ)
        cur.execute("""
            SELECT id, ISNULL(yonetici_ad, ad), id, ad, ISNULL(tur,'berber')
            FROM isletmeler
            WHERE email=? AND sifre=? AND ISNULL(aktif,1)=1
        """, email, sifre)
        row = cur.fetchone(); con.close()

        if not row:
            return jsonify(success=False, message='Hatalı e-posta veya şifre!'), 401

        session.clear()
        session['ok']             = True
        session['yonetici_id']    = row[0]
        session['yonetici_ad']    = row[1]
        session['yonetici_email'] = email
        session['isletme_id']     = row[2]
        session['isletme_adi']    = row[3] or ''
        session['isletme_tur']    = row[4] or 'berber'

        return jsonify(success=True, ad=row[1], email=email, isletme_id=row[2],
                       isletme_adi=row[3], isletme_tur=row[4] or 'berber',
                       super_admin=False)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/cikis', methods=['POST'])
def cikis():
    session.clear()
    return jsonify(success=True)

@app.route('/api/oturum')
def oturum():
    if giris_yok(): return jsonify(success=False), 401
    return jsonify(
        success=True,
        ad=session.get('yonetici_ad'),
        email=session.get('yonetici_email', ''),
        isletme_id=session.get('isletme_id'),
        isletme_adi=session.get('isletme_adi'),
        isletme_tur=session.get('isletme_tur', ''),
        super_admin=session.get('isletme_id') is None
    )

@app.route('/api/isletme-profil-guncelle', methods=['POST'])
def isletme_profil_guncelle():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    d = request.get_json(force=True, silent=True) or {}
    ad         = (d.get('ad') or '').strip()
    email      = (d.get('email') or '').strip()
    sifre      = (d.get('sifre') or '').strip()
    isletme_ad = (d.get('isletme_ad') or '').strip()
    if not email:
        return jsonify(success=False, message='E-posta zorunludur!'), 400
    if sifre and len(sifre) < 6:
        return jsonify(success=False, message='Şifre en az 6 karakter!'), 400
    try:
        con = db(); cur = con.cursor()
        if e:
            # isletmeler tablosundaki email, sifre, yonetici_ad güncelle
            if sifre:
                cur.execute("UPDATE isletmeler SET email=?,sifre=?,yonetici_ad=?,ad=? WHERE id=?",
                            email, sifre, ad, isletme_ad or session.get('isletme_adi',''), e)
            else:
                cur.execute("UPDATE isletmeler SET email=?,yonetici_ad=?,ad=? WHERE id=?",
                            email, ad, isletme_ad or session.get('isletme_adi',''), e)
            if isletme_ad:
                session['isletme_adi'] = isletme_ad
        else:
            # Süper admin: adminler tablosunu güncelle
            admin_id = session.get('yonetici_id')
            if sifre:
                cur.execute("UPDATE adminler SET ad=?,email=?,kullanici_adi=?,sifre=? WHERE id=?",
                            ad, email, email, sifre, admin_id)
            else:
                cur.execute("UPDATE adminler SET ad=?,email=?,kullanici_adi=? WHERE id=?",
                            ad, email, email, admin_id)
        con.commit(); con.close()
        if ad: session['yonetici_ad'] = ad
        session['yonetici_email'] = email
        return jsonify(success=True, message='Profil güncellendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# İSTATİSTİKLER
# ─────────────────────────────────────────────────────────────────
@app.route('/api/istatistikler')
def istatistikler():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    try:
        con = db(); cur = con.cursor()
        def cnt(q, *p): cur.execute(q, *p); return cur.fetchone()[0]
        if e:
            s = dict(
                hizmet         = cnt("SELECT COUNT(*) FROM hizmetler  WHERE isletme_id=? AND ISNULL(aktif,1)=1", e),
                calisan        = cnt("SELECT COUNT(*) FROM calisanlar WHERE isletme_id=? AND ISNULL(aktif,1)=1", e),
                toplam_randevu = cnt("SELECT COUNT(*) FROM randevular WHERE isletme_id=?", e),
                bekleyen       = cnt("SELECT COUNT(*) FROM randevular WHERE isletme_id=? AND durum='bekliyor'", e),
                onaylanan      = cnt("SELECT COUNT(*) FROM randevular WHERE isletme_id=? AND durum='onaylandi'", e),
                bugun          = cnt("SELECT COUNT(*) FROM randevular WHERE isletme_id=? AND tarih=CAST(GETDATE() AS DATE)", e),
            )
        else:
            s = dict(
                isletme        = cnt("SELECT COUNT(*) FROM isletmeler WHERE ISNULL(aktif,1)=1"),
                hizmet         = cnt("SELECT COUNT(*) FROM hizmetler  WHERE ISNULL(aktif,1)=1"),
                calisan        = cnt("SELECT COUNT(*) FROM calisanlar WHERE ISNULL(aktif,1)=1"),
                toplam_randevu = cnt("SELECT COUNT(*) FROM randevular"),
                bekleyen       = cnt("SELECT COUNT(*) FROM randevular WHERE durum='bekliyor'"),
                bugun          = cnt("SELECT COUNT(*) FROM randevular WHERE tarih=CAST(GETDATE() AS DATE)"),
            )
        con.close()
        return jsonify(success=True, stats=s)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# RANDEVULAR
# ─────────────────────────────────────────────────────────────────
@app.route('/api/randevular')
def randevular():
    if giris_yok(): return jsonify(success=False), 401
    e     = eid()
    durum = request.args.get('durum', '')
    tarih = request.args.get('tarih', '')
    arama = request.args.get('arama', '').strip()
    try:
        con = db(); cur = con.cursor()
        where, params = [], []
        if e:     where.append("r.isletme_id=?");  params.append(e)
        if durum: where.append("r.durum=?");       params.append(durum)
        if tarih: where.append("CONVERT(VARCHAR(10),r.tarih,23)=?"); params.append(tarih)
        if arama:
            where.append("(r.musteri_adi LIKE ? OR r.musteri_telefon LIKE ?)")
            params += [f'%{arama}%', f'%{arama}%']
        w = ('WHERE ' + ' AND '.join(where)) if where else ''
        cur.execute(f"""
            SELECT r.id,
                   CONVERT(VARCHAR(10),r.tarih,23)  AS tarih,
                   CONVERT(VARCHAR(5), r.saat, 108) AS saat,
                   r.durum, ISNULL(r.notlar,''),
                   r.musteri_adi, r.musteri_telefon,
                   ISNULL(i.ad,''), ISNULL(c.ad,''), ISNULL(h.ad,''),
                   ISNULL(CAST(h.ucret AS NVARCHAR),''),
                   r.isletme_id
            FROM randevular r
            LEFT JOIN isletmeler i ON r.isletme_id=i.id
            LEFT JOIN calisanlar c ON r.calisan_id=c.id
            LEFT JOIN hizmetler  h ON r.hizmet_id=h.id
            {w}
            ORDER BY r.tarih DESC, r.saat DESC
        """, params)
        keys = ['id','tarih','saat','durum','notlar','musteri_adi','musteri_telefon',
                'isletme_adi','calisan_adi','hizmet_adi','ucret','isletme_id']
        rows = [dict(zip(keys, r)) for r in cur.fetchall()]
        con.close()
        return jsonify(success=True, randevular=rows)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/randevu-durum/<int:rid>', methods=['POST'])
def randevu_durum(rid):
    if giris_yok(): return jsonify(success=False), 401
    durum = (request.get_json(force=True, silent=True) or {}).get('durum', '')
    if durum not in ('onaylandi', 'tamamlandi', 'iptal', 'bekliyor'):
        return jsonify(success=False, message='Geçersiz durum!'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE randevular SET durum=? WHERE id=?", durum, rid)
        con.commit(); con.close()
        return jsonify(success=True, message='Durum güncellendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/randevu-not/<int:rid>', methods=['POST'])
def randevu_not(rid):
    if giris_yok(): return jsonify(success=False), 401
    notlar = (request.get_json(force=True, silent=True) or {}).get('notlar', '')
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE randevular SET notlar=? WHERE id=?", notlar, rid)
        con.commit(); con.close()
        return jsonify(success=True, message='Not kaydedildi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# HİZMETLER (calisan_id destekli)
# ─────────────────────────────────────────────────────────────────
@app.route('/api/hizmetler')
def hizmetler():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    try:
        con = db(); cur = con.cursor()
        if e:
            cur.execute("""
                SELECT h.id, h.isletme_id, h.ad, ISNULL(h.ad_en,''), h.kategori, h.sure,
                       CAST(h.ucret AS FLOAT), ISNULL(h.aktif,1), ISNULL(i.ad,''),
                       ISNULL(h.calisan_id,0), ISNULL(c.ad,'')
                FROM hizmetler h
                LEFT JOIN isletmeler i ON h.isletme_id=i.id
                LEFT JOIN calisanlar c ON h.calisan_id=c.id
                WHERE h.isletme_id=? ORDER BY h.kategori, h.ad
            """, e)
        else:
            cur.execute("""
                SELECT h.id, h.isletme_id, h.ad, ISNULL(h.ad_en,''), h.kategori, h.sure,
                       CAST(h.ucret AS FLOAT), ISNULL(h.aktif,1), ISNULL(i.ad,''),
                       ISNULL(h.calisan_id,0), ISNULL(c.ad,'')
                FROM hizmetler h
                LEFT JOIN isletmeler i ON h.isletme_id=i.id
                LEFT JOIN calisanlar c ON h.calisan_id=c.id
                ORDER BY i.ad, h.kategori, h.ad
            """)
        keys = ['id','isletme_id','ad','ad_en','kategori','sure','ucret','aktif','isletme_adi','calisan_id','calisan_adi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(keys, r))
            d['aktif']      = bool(d['aktif'])
            d['ucret']      = float(d['ucret'])
            d['calisan_id'] = int(d['calisan_id'])
            rows.append(d)
        con.close()
        return jsonify(success=True, hizmetler=rows)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/hizmet-ekle', methods=['POST'])
def hizmet_ekle():
    if giris_yok(): return jsonify(success=False), 401
    d  = request.get_json(force=True, silent=True) or {}
    e  = eid() or d.get('isletme_id')
    if not e or not d.get('ad'):
        return jsonify(success=False, message='İşletme ve hizmet adı zorunlu!'), 400
    calisan_id = int(d['calisan_id']) if d.get('calisan_id') and str(d.get('calisan_id')) not in ('','0','null') else None
    try:
        # Otomatik İngilizce çeviri
        ad_en = auto_translate_tr_en(d['ad'])
        con = db(); cur = con.cursor()
        cur.execute(
            "INSERT INTO hizmetler(isletme_id,ad,ad_en,kategori,sure,ucret,aktif,calisan_id) VALUES(?,?,?,?,?,?,1,?)",
            e, d['ad'], ad_en or None, d.get('kategori','berber'), int(d.get('sure',30)), float(d.get('ucret',0)), calisan_id
        )
        con.commit(); con.close()
        return jsonify(success=True, message='Hizmet eklendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/hizmet-guncelle/<int:hid>', methods=['PUT'])
def hizmet_guncelle(hid):
    if giris_yok(): return jsonify(success=False), 401
    d = request.get_json(force=True, silent=True) or {}
    calisan_id = int(d['calisan_id']) if d.get('calisan_id') and str(d.get('calisan_id')) not in ('','0','null') else None
    try:
        con = db(); cur = con.cursor()
        # Mevcut ad_en'i kontrol et — ad değiştiyse yeniden çevir
        cur.execute("SELECT ad, ISNULL(ad_en,'') FROM hizmetler WHERE id=?", hid)
        row = cur.fetchone()
        if row and row[0] != d.get('ad', ''):
            # Ad değişti → yeniden çevir
            ad_en = auto_translate_tr_en(d['ad'])
        elif row and not row[1]:
            # ad_en hiç girilmemiş → çevir
            ad_en = auto_translate_tr_en(d['ad'])
        else:
            # Ad aynı, ad_en zaten var → dokunma
            ad_en = row[1] if row else ''
        cur.execute(
            "UPDATE hizmetler SET ad=?,ad_en=?,kategori=?,sure=?,ucret=?,aktif=?,calisan_id=? WHERE id=?",
            d['ad'], ad_en or None, d['kategori'], int(d['sure']), float(d['ucret']),
            1 if d.get('aktif', True) else 0, calisan_id, hid
        )
        con.commit(); con.close()
        return jsonify(success=True, message='Hizmet güncellendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/ceviri-test', methods=['GET'])
def ceviri_test():
    """Google Translate bağlantısını test eder."""
    sonuc = auto_translate_tr_en('Saç Kesimi')
    if sonuc:
        return jsonify(success=True, message=f'✅ Çeviri çalışıyor! "Saç Kesimi" → "{sonuc}"')
    return jsonify(success=False, message='❌ Çeviri çalışmıyor. İnternet bağlantısını kontrol edin.')

@app.route('/api/hizmetleri-cevir', methods=['POST'])
def hizmetleri_cevir():
    """Mevcut hizmetlerin ad_en alanlarını otomatik doldurur (tek seferlik)."""
    if giris_yok(): return jsonify(success=False), 401
    try:
        con = db(); cur = con.cursor()
        cur.execute("SELECT id, ad FROM hizmetler WHERE ISNULL(ad_en,'') = ''")
        rows = cur.fetchall()
        guncellenen = 0
        for row in rows:
            hid, ad = row[0], row[1]
            ad_en = auto_translate_tr_en(ad)
            if ad_en:
                cur.execute("UPDATE hizmetler SET ad_en=? WHERE id=?", ad_en, hid)
                guncellenen += 1
        con.commit(); con.close()
        return jsonify(success=True, message=f'{guncellenen} hizmet çevrildi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/hizmet-sil/<int:hid>', methods=['DELETE'])
def hizmet_sil(hid):
    if giris_yok(): return jsonify(success=False), 401
    try:
        con = db(); cur = con.cursor()
        cur.execute("DELETE FROM hizmetler WHERE id=?", hid)
        con.commit(); con.close()
        return jsonify(success=True, message='Hizmet silindi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# ÇALIŞANLAR
# ─────────────────────────────────────────────────────────────────
@app.route('/api/calisanlar')
def calisanlar():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    try:
        con = db(); cur = con.cursor()
        if e:
            cur.execute("""
                SELECT c.id, c.isletme_id, c.ad, c.uzmanlik, ISNULL(c.telefon,''), ISNULL(c.aktif,1), ISNULL(i.ad,'')
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id
                WHERE c.isletme_id=? ORDER BY c.ad
            """, e)
        else:
            cur.execute("""
                SELECT c.id, c.isletme_id, c.ad, c.uzmanlik, ISNULL(c.telefon,''), ISNULL(c.aktif,1), ISNULL(i.ad,'')
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id ORDER BY i.ad, c.ad
            """)
        keys = ['id','isletme_id','ad','uzmanlik','telefon','aktif','isletme_adi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(keys, r)); d['aktif'] = bool(d['aktif']); rows.append(d)
        con.close()
        return jsonify(success=True, calisanlar=rows)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/calisan-ekle', methods=['POST'])
def calisan_ekle():
    if giris_yok(): return jsonify(success=False), 401
    d = request.get_json(force=True, silent=True) or {}
    e = eid() or d.get('isletme_id')
    if not e or not d.get('ad'):
        return jsonify(success=False, message='İşletme ve ad zorunlu!'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("INSERT INTO calisanlar(isletme_id,ad,uzmanlik,telefon,aktif) VALUES(?,?,?,?,1)",
                    e, d['ad'], d.get('uzmanlik','berber'), d.get('telefon',''))
        con.commit(); con.close()
        return jsonify(success=True, message='Çalışan eklendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/calisan-guncelle/<int:cid>', methods=['PUT'])
def calisan_guncelle(cid):
    if giris_yok(): return jsonify(success=False), 401
    d = request.get_json(force=True, silent=True) or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE calisanlar SET ad=?,uzmanlik=?,telefon=?,aktif=? WHERE id=?",
                    d['ad'], d['uzmanlik'], d.get('telefon',''),
                    1 if d.get('aktif', True) else 0, cid)
        con.commit(); con.close()
        return jsonify(success=True, message='Çalışan güncellendi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/calisan-sil/<int:cid>', methods=['DELETE'])
def calisan_sil(cid):
    if giris_yok(): return jsonify(success=False), 401
    try:
        con = db(); cur = con.cursor()
        cur.execute("DELETE FROM calisanlar WHERE id=?", cid)
        con.commit(); con.close()
        return jsonify(success=True, message='Çalışan silindi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# İŞLETME BİLGİSİ
# ─────────────────────────────────────────────────────────────────
@app.route('/api/isletme-bilgi')
def isletme_bilgi():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='Süper admin bu endpointi kullanamaz'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT id, ad, tur,
                   ISNULL(adres,''), ISNULL(telefon,''), ISNULL(aciklama,''),
                   ISNULL(aktif,1), ISNULL(email,''), ISNULL(yonetici_ad,'')
            FROM isletmeler WHERE id=?
        """, e)
        row = cur.fetchone(); con.close()
        if not row: return jsonify(success=False, message='İşletme bulunamadı!'), 404
        keys = ['id','ad','tur','adres','telefon','aciklama','aktif','email','yonetici_ad']
        r = dict(zip(keys, row))
        r['aktif'] = bool(r['aktif'])
        return jsonify(success=True, isletme=r)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/isletme-guncelle', methods=['PUT'])
def isletme_guncelle():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='Süper admin bu endpointi kullanamaz'), 400
    d = request.get_json(force=True, silent=True) or {}
    tur = d.get('tur', 'berber')
    if tur not in ('berber', 'epilasyon'): tur = 'berber'
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE isletmeler SET ad=?,tur=?,adres=?,telefon=?,aciklama=?,aktif=? WHERE id=?",
                    d['ad'], tur, d.get('adres',''), d.get('telefon',''),
                    d.get('aciklama',''), 1 if d.get('aktif',True) else 0, e)
        con.commit()
        cur.execute("SELECT ad,tur FROM isletmeler WHERE id=?", e)
        row = cur.fetchone(); con.close()
        session['isletme_adi'] = row[0] if row else d['ad']
        session['isletme_tur'] = row[1] if row else tur
        return jsonify(success=True, message='İşletme bilgileri güncellendi!',
                       isletme_adi=session['isletme_adi'], isletme_tur=session['isletme_tur'])
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# ÇALIŞMA SAATLERİ
# ─────────────────────────────────────────────────────────────────
GUNLER = {1:'Pazartesi',2:'Salı',3:'Çarşamba',4:'Perşembe',5:'Cuma',6:'Cumartesi',7:'Pazar'}

@app.route('/api/calisma-saatleri')
def calisma_saatleri():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='İşletme seçilmemiş'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT gun_no, CONVERT(VARCHAR(5),acilis,108), CONVERT(VARCHAR(5),kapanis,108), kapali
            FROM calisma_saatleri WHERE isletme_id=? ORDER BY gun_no
        """, e)
        rows = [{'gun_no':r[0],'gun_adi':GUNLER.get(r[0],'?'),'acilis':r[1],'kapanis':r[2],'kapali':bool(r[3])}
                for r in cur.fetchall()]
        con.close()
        mevcut = {r['gun_no'] for r in rows}
        for g in range(1, 8):
            if g not in mevcut:
                rows.append({'gun_no':g,'gun_adi':GUNLER[g],'acilis':'09:00','kapanis':'19:00','kapali':g==7})
        rows.sort(key=lambda x: x['gun_no'])
        return jsonify(success=True, saatler=rows)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/calisma-saatleri-kaydet', methods=['POST'])
def calisma_saatleri_kaydet():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='İşletme seçilmemiş'), 400
    saatler = (request.get_json(force=True, silent=True) or {}).get('saatler', [])
    try:
        con = db(); cur = con.cursor()
        for s in saatler:
            cur.execute("SELECT COUNT(*) FROM calisma_saatleri WHERE isletme_id=? AND gun_no=?", e, s['gun_no'])
            if cur.fetchone()[0]:
                cur.execute("UPDATE calisma_saatleri SET acilis=?,kapanis=?,kapali=? WHERE isletme_id=? AND gun_no=?",
                            s['acilis'], s['kapanis'], 1 if s['kapali'] else 0, e, s['gun_no'])
            else:
                cur.execute("INSERT INTO calisma_saatleri(isletme_id,gun_no,acilis,kapanis,kapali) VALUES(?,?,?,?,?)",
                            e, s['gun_no'], s['acilis'], s['kapanis'], 1 if s['kapali'] else 0)
        con.commit(); con.close()
        return jsonify(success=True, message='Çalışma saatleri kaydedildi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# TATİL GÜNLERİ
# ─────────────────────────────────────────────────────────────────
@app.route('/api/tatil-gunleri')
def tatil_gunleri():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='İşletme seçilmemiş'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("SELECT id,CONVERT(VARCHAR(10),tarih,23),ISNULL(aciklama,'') FROM tatil_gunleri WHERE isletme_id=? ORDER BY tarih", e)
        rows = [{'id':r[0],'tarih':r[1],'aciklama':r[2]} for r in cur.fetchall()]
        con.close()
        return jsonify(success=True, tatiller=rows)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/tatil-ekle', methods=['POST'])
def tatil_ekle():
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    if not e: return jsonify(success=False, message='İşletme seçilmemiş'), 400
    d = request.get_json(force=True, silent=True) or {}
    if not d.get('tarih'): return jsonify(success=False, message='Tarih zorunlu!'), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("INSERT INTO tatil_gunleri(isletme_id,tarih,aciklama) VALUES(?,?,?)",
                    e, d['tarih'], d.get('aciklama',''))
        con.commit(); con.close()
        return jsonify(success=True, message='Tatil günü eklendi!')
    except Exception as ex:
        if '2627' in str(ex) or 'UNIQUE' in str(ex).upper():
            return jsonify(success=False, message='Bu tarih zaten eklenmiş!'), 400
        return jsonify(success=False, message=str(ex)), 500

@app.route('/api/tatil-sil/<int:tid>', methods=['DELETE'])
def tatil_sil(tid):
    if giris_yok(): return jsonify(success=False), 401
    e = eid()
    try:
        con = db(); cur = con.cursor()
        cur.execute("DELETE FROM tatil_gunleri WHERE id=? AND isletme_id=?", tid, e)
        con.commit(); con.close()
        return jsonify(success=True, message='Tatil günü silindi!')
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ─────────────────────────────────────────────────────────────────
# SÜPER ADMİN — işletmeler listesi
# ─────────────────────────────────────────────────────────────────
@app.route('/api/isletmeler-listesi')
def isletmeler_listesi():
    try:
        con = db(); cur = con.cursor()
        cur.execute("SELECT id,ad,tur FROM isletmeler WHERE ISNULL(aktif,1)=1 ORDER BY ad")
        rows = [{'id':r[0],'ad':r[1],'tur':r[2]} for r in cur.fetchall()]
        con.close()
        return jsonify(success=True, isletmeler=rows)
    except Exception as ex:
        return jsonify(success=False, isletmeler=[])

# ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 50)
    print("🏪  İŞLETME YÖNETİM PANELİ  —  port 5002")
    print("=" * 50)
    app.run(debug=False, host='0.0.0.0', port=5002)