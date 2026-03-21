from flask import Flask, render_template, request, jsonify, session, redirect
from flask_cors import CORS
import pyodbc, re, socket
from functools import wraps

app = Flask(__name__)
app.secret_key = 'berber-randevu-2024-xyz'
CORS(app)

SERVER   = 'DESKTOP-T20P6DA\\SQLEXPRESS'
DATABASE = 'BerberRandevu'
CONN_STR = f'DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

def db():
    return pyodbc.connect(CONN_STR, timeout=10)

# ══════════════════════════════════════════════════════════════════
# VERİTABANI HAZIRLIK
# ══════════════════════════════════════════════════════════════════
def init_db():
    con = db()
    cur = con.cursor()

    # ── ADIM 1: Mevcut tüm FK constraint'leri kaldır ─────────────
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

    def tablo_var(ad):
        cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name=? AND xtype='U'", ad)
        return cur.fetchone()[0] > 0

    def sutun_var(tablo, sutun):
        cur.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=? AND COLUMN_NAME=?", tablo, sutun)
        return cur.fetchone()[0] > 0

    # ── ADIM 2: Tablolar ──────────────────────────────────────────

    if not tablo_var('kullanicilar'):
        cur.execute("""
            CREATE TABLE kullanicilar(
                id           INT IDENTITY(1,1) PRIMARY KEY,
                ad           NVARCHAR(100) NOT NULL,
                email        NVARCHAR(100) NOT NULL UNIQUE,
                sifre        NVARCHAR(200) NOT NULL,
                telefon      NVARCHAR(20)  NULL,
                is_admin     BIT DEFAULT 0,
                kayit_tarihi DATETIME DEFAULT GETDATE()
            )""")
    if not sutun_var('kullanicilar', 'is_admin'):
        cur.execute("ALTER TABLE kullanicilar ADD is_admin BIT DEFAULT 0")
    if not sutun_var('kullanicilar', 'telefon'):
        cur.execute("ALTER TABLE kullanicilar ADD telefon NVARCHAR(20) NULL")

    if not tablo_var('isletmeler'):
        cur.execute("""
            CREATE TABLE isletmeler(
                id           INT IDENTITY(1,1) PRIMARY KEY,
                ad           NVARCHAR(200) NOT NULL,
                tur          NVARCHAR(50)  NOT NULL,
                adres        NVARCHAR(500) NULL,
                telefon      NVARCHAR(20)  NULL,
                aciklama     NVARCHAR(MAX) NULL,
                aktif        BIT DEFAULT 1,
                kayit_tarihi DATETIME DEFAULT GETDATE()
            )""")
    if not sutun_var('isletmeler', 'aktif'):
        cur.execute("ALTER TABLE isletmeler ADD aktif BIT DEFAULT 1")
    if not sutun_var('isletmeler', 'aciklama'):
        cur.execute("ALTER TABLE isletmeler ADD aciklama NVARCHAR(MAX) NULL")

    if not tablo_var('hizmetler'):
        cur.execute("""
            CREATE TABLE hizmetler(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                ad         NVARCHAR(100) NOT NULL,
                kategori   NVARCHAR(50)  NOT NULL,
                sure       INT           NOT NULL DEFAULT 30,
                ucret      DECIMAL(10,2) NOT NULL DEFAULT 0,
                aktif      BIT DEFAULT 1
            )""")
    if not sutun_var('hizmetler', 'isletme_id'):
        cur.execute("ALTER TABLE hizmetler ADD isletme_id INT NULL")
    if not sutun_var('hizmetler', 'aktif'):
        cur.execute("ALTER TABLE hizmetler ADD aktif BIT DEFAULT 1")

    if not tablo_var('calisanlar'):
        cur.execute("""
            CREATE TABLE calisanlar(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                ad         NVARCHAR(100) NOT NULL,
                uzmanlik   NVARCHAR(50)  NOT NULL DEFAULT 'berber',
                telefon    NVARCHAR(20)  NULL,
                aktif      BIT DEFAULT 1
            )""")
    if not sutun_var('calisanlar', 'isletme_id'):
        cur.execute("ALTER TABLE calisanlar ADD isletme_id INT NULL")
    if not sutun_var('calisanlar', 'aktif'):
        cur.execute("ALTER TABLE calisanlar ADD aktif BIT DEFAULT 1")

    if not tablo_var('randevular'):
        cur.execute("""
            CREATE TABLE randevular(
                id               INT IDENTITY(1,1) PRIMARY KEY,
                kullanici_id     INT NULL,
                isletme_id       INT NOT NULL,
                calisan_id       INT NULL,
                hizmet_id        INT NULL,
                musteri_adi      NVARCHAR(100) NOT NULL,
                musteri_telefon  NVARCHAR(20)  NOT NULL,
                tarih            DATE NOT NULL,
                saat             TIME NOT NULL,
                durum            NVARCHAR(20) DEFAULT 'bekliyor',
                notlar           NVARCHAR(500) NULL,
                olusturma_tarihi DATETIME DEFAULT GETDATE()
            )""")

    # calisma_saatleri — KESİNLİKLE FK CONSTRAINT YOK
    if not tablo_var('calisma_saatleri'):
        cur.execute("""
            CREATE TABLE calisma_saatleri(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                gun_no     INT NOT NULL,
                acilis     TIME NOT NULL,
                kapanis    TIME NOT NULL,
                kapali     BIT NOT NULL DEFAULT 0,
                CONSTRAINT UQ_CS UNIQUE(isletme_id, gun_no)
            )""")

    # tatil_gunleri — KESİNLİKLE FK CONSTRAINT YOK
    if not tablo_var('tatil_gunleri'):
        cur.execute("""
            CREATE TABLE tatil_gunleri(
                id         INT IDENTITY(1,1) PRIMARY KEY,
                isletme_id INT NOT NULL,
                tarih      DATE NOT NULL,
                aciklama   NVARCHAR(200) NULL,
                CONSTRAINT UQ_TG UNIQUE(isletme_id, tarih)
            )""")

    con.commit()

    # ── ADIM 3: Eksik calisma_saatleri satırlarını tamamla ────────
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
    except Exception as e:
        print(f"  calisma_saatleri: {e}")
        try: con.rollback()
        except: pass

    # ── ADIM 4: NULL aktif düzelt ─────────────────────────────────
    try:
        cur.execute("UPDATE hizmetler  SET aktif=1 WHERE aktif IS NULL")
        cur.execute("UPDATE calisanlar SET aktif=1 WHERE aktif IS NULL")
        cur.execute("UPDATE isletmeler SET aktif=1 WHERE aktif IS NULL")
        con.commit()
    except: pass

    con.close()
    print("✅ Veritabanı hazır")

try:
    init_db()
except Exception as ex:
    print(f"⚠️ DB init: {ex}")

# ══════════════════════════════════════════════════════════════════
# SAYFALAR
# ══════════════════════════════════════════════════════════════════
@app.route('/')
def index():
    return render_template('app.html')

@app.route('/admin-panel')
def admin_panel():
    if not session.get('is_admin'):
        return redirect('/')
    return render_template('admin_panel.html')

# ══════════════════════════════════════════════════════════════════
# KULLANICI
# ══════════════════════════════════════════════════════════════════
@app.route('/api/kayit', methods=['POST'])
def kayit():
    try:
        d = request.json or {}
        if not d.get('ad') or not d.get('email') or not d.get('sifre'):
            return jsonify({'success': False, 'message': 'Ad, email ve şifre zorunludur!'}), 400
        if len(d['sifre']) < 6:
            return jsonify({'success': False, 'message': 'Şifre en az 6 karakter!'}), 400
        con = db(); cur = con.cursor()
        cur.execute("SELECT id FROM kullanicilar WHERE email=?", d['email'])
        if cur.fetchone():
            con.close()
            return jsonify({'success': False, 'message': 'Bu email zaten kayıtlı!'}), 400
        cur.execute("INSERT INTO kullanicilar(ad,email,sifre,telefon) VALUES(?,?,?,?)",
                    d['ad'], d['email'], d['sifre'], d.get('telefon', ''))
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Kayıt başarılı!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/giris', methods=['POST'])
def giris():
    try:
        d = request.json or {}
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT id, ad, email, ISNULL(telefon,''), ISNULL(is_admin,0)
            FROM kullanicilar WHERE email=? AND sifre=?
        """, d.get('email', ''), d.get('sifre', ''))
        row = cur.fetchone(); con.close()
        if not row:
            return jsonify({'success': False, 'message': '❌ Email veya şifre hatalı!'}), 401
        session['user_id']    = row[0]
        session['user_name']  = row[1]
        session['user_email'] = row[2]
        session['is_admin']   = bool(row[4])
        return jsonify({'success': True, 'message': '✅ Giriş başarılı!',
                        'user': {'id': row[0], 'ad': row[1], 'email': row[2],
                                 'telefon': row[3], 'is_admin': bool(row[4])}})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/cikis', methods=['POST'])
def cikis():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/oturum')
def oturum():
    if 'user_id' not in session:
        return jsonify({'success': False}), 401
    return jsonify({'success': True, 'user': {
        'id': session['user_id'], 'ad': session['user_name'],
        'email': session['user_email'], 'is_admin': session.get('is_admin', False)
    }})

@app.route('/api/kullanici-guncelle', methods=['POST'])
def kullanici_guncelle():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Giriş yapınız!'}), 401
    d     = request.get_json(force=True, silent=True) or {}
    ad    = (d.get('ad')    or '').strip()
    email = (d.get('email') or '').strip()
    sifre = (d.get('sifre') or '').strip()
    if not ad or not email:
        return jsonify({'success': False, 'message': 'Ad ve e-posta zorunludur!'}), 400
    if sifre and len(sifre) < 6:
        return jsonify({'success': False, 'message': 'Şifre en az 6 karakter!'}), 400
    try:
        con = db(); cur = con.cursor()
        uid = session['user_id']
        # Email başkası tarafından kullanılıyor mu?
        cur.execute("SELECT id FROM kullanicilar WHERE email=? AND id!=?", email, uid)
        if cur.fetchone():
            return jsonify({'success': False, 'message': 'Bu e-posta başka bir hesapta kullanılıyor!'}), 409
        if sifre:
            cur.execute("UPDATE kullanicilar SET ad=?, email=?, sifre=? WHERE id=?", ad, email, sifre, uid)
        else:
            cur.execute("UPDATE kullanicilar SET ad=?, email=? WHERE id=?", ad, email, uid)
        con.commit(); con.close()
        session['user_name']  = ad
        session['user_email'] = email
        return jsonify({'success': True, 'message': 'Profil güncellendi!'})
    except Exception as ex:
        return jsonify({'success': False, 'message': str(ex)}), 500

# ══════════════════════════════════════════════════════════════════
# PUBLIC API
# ══════════════════════════════════════════════════════════════════
@app.route('/api/public/isletmeler')
def public_isletmeler():
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT id, ad, tur, ISNULL(adres,''), ISNULL(telefon,''), ISNULL(aciklama,'')
            FROM isletmeler WHERE ISNULL(aktif,1)=1 ORDER BY kayit_tarihi DESC
        """)
        cols = ['id', 'ad', 'tur', 'adres', 'telefon', 'aciklama']
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        for r in rows: r['id'] = int(r['id'])
        con.close()
        return jsonify({'success': True, 'isletmeler': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/public/hizmetler')
def public_hizmetler():
    isletme_id = (request.args.get('isletme_id') or '').strip()
    kategori   = (request.args.get('kategori') or '').strip()
    try:
        con = db(); cur = con.cursor()
        # JOIN KULLANMIYORUZ - isletmeler aktif kontrolü ayrı
        sql    = "SELECT id, isletme_id, ad, ISNULL(ad_en,''), kategori, sure, CAST(ucret AS FLOAT) FROM hizmetler WHERE ISNULL(aktif,1)=1"
        params = []
        if isletme_id and isletme_id not in ('null', 'undefined'):
            sql += " AND isletme_id=?"
            params.append(int(isletme_id))
        if kategori:
            sql += " AND kategori=?"
            params.append(kategori)
        sql += " ORDER BY kategori, ad"
        cur.execute(sql, params)
        rows = []
        for r in cur.fetchall():
            rows.append({
                'id':         int(r[0]),
                'isletme_id': int(r[1]),
                'ad':         r[2],
                'ad_en':      r[3] or '',
                'kategori':   r[4],
                'sure':       int(r[5]),
                'ucret':      float(r[6])
            })
        con.close()
        print(f"  [public/hizmetler] isletme_id={isletme_id} -> {len(rows)} hizmet")
        return jsonify({'success': True, 'hizmetler': rows})
    except Exception as e:
        print(f"  [public/hizmetler] HATA: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/public/calisanlar')
def public_calisanlar():
    isletme_id = (request.args.get('isletme_id') or '').strip()
    uzmanlik   = (request.args.get('uzmanlik') or '').strip()
    try:
        con = db(); cur = con.cursor()
        sql    = "SELECT id, isletme_id, ad, uzmanlik, ISNULL(telefon,'') FROM calisanlar WHERE ISNULL(aktif,1)=1"
        params = []
        if isletme_id and isletme_id not in ('null', 'undefined'):
            sql += " AND isletme_id=?"
            params.append(int(isletme_id))
        if uzmanlik:
            sql += " AND uzmanlik=?"
            params.append(uzmanlik)
        sql += " ORDER BY ad"
        cur.execute(sql, params)
        rows = []
        for r in cur.fetchall():
            rows.append({
                'id':         int(r[0]),
                'isletme_id': int(r[1]),
                'ad':         r[2],
                'uzmanlik':   r[3],
                'telefon':    r[4]
            })
        con.close()
        return jsonify({'success': True, 'calisanlar': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
# MÜSAİT SAATLER
# ══════════════════════════════════════════════════════════════════
def zaman_str(v):
    if v is None: return '09:00'
    if hasattr(v, 'strftime'): return v.strftime('%H:%M')
    if hasattr(v, 'seconds'):
        s = int(v.seconds)
        return f"{s // 3600:02d}:{(s % 3600) // 60:02d}"
    return str(v)[:5]

@app.route('/api/musait-saatler')
def musait_saatler():
    tarih      = (request.args.get('tarih') or '').strip()
    isletme_id = (request.args.get('isletme_id') or '').strip()
    calisan_id = (request.args.get('calisan_id') or '').strip()

    if not tarih:
        return jsonify({'success': False, 'message': 'Tarih gerekli!'}), 400

    eid = int(isletme_id) if isletme_id and isletme_id not in ('', 'null', 'undefined') else None
    cid = int(calisan_id) if calisan_id and calisan_id not in ('', 'null', 'undefined', '0') else None

    try:
        con = db(); cur = con.cursor()

        if eid:
            cur.execute("SELECT COUNT(*) FROM tatil_gunleri WHERE isletme_id=? AND tarih=?", eid, tarih)
            if cur.fetchone()[0] > 0:
                con.close()
                return jsonify({'success': True, 'musait_saatler': [], 'mesaj': 'Bu tarih tatil günüdür.'})

        acilis  = '09:00'
        kapanis = '19:00'
        kapali  = False

        if eid:
            cur.execute("""
                SELECT acilis, kapanis, kapali FROM calisma_saatleri
                WHERE isletme_id=? AND gun_no=(
                    CASE DATEPART(dw,?) WHEN 1 THEN 7 WHEN 2 THEN 1 WHEN 3 THEN 2
                    WHEN 4 THEN 3 WHEN 5 THEN 4 WHEN 6 THEN 5 WHEN 7 THEN 6 END)
            """, eid, tarih)
            row = cur.fetchone()
            if row:
                acilis  = zaman_str(row[0])
                kapanis = zaman_str(row[1])
                kapali  = bool(row[2])

        if kapali:
            con.close()
            return jsonify({'success': True, 'musait_saatler': [], 'mesaj': 'İşletme bu gün kapalıdır.'})

        def t2m(s):
            h, m = map(int, s.split(':'))
            return h * 60 + m

        slotlar = []
        t = t2m(acilis)
        while t < t2m(kapanis):
            slotlar.append(f"{t // 60:02d}:{t % 60:02d}")
            t += 30

        sql    = "SELECT CONVERT(VARCHAR(5),saat,108) FROM randevular WHERE tarih=? AND durum NOT IN ('iptal')"
        params = [tarih]
        if eid: sql += " AND isletme_id=?"; params.append(eid)
        if cid: sql += " AND calisan_id=?"; params.append(cid)
        cur.execute(sql, params)
        dolu = {r[0] for r in cur.fetchall()}
        con.close()

        # Tüm saatleri dolu/boş bilgisiyle döndür
        tum_slotlar = [{'saat': s, 'dolu': s in dolu} for s in slotlar]
        return jsonify({'success': True,
                        'musait_saatler': [s for s in slotlar if s not in dolu],
                        'tum_saatler': tum_slotlar,
                        'acilis': acilis, 'kapanis': kapanis})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
# RANDEVU AL
# ══════════════════════════════════════════════════════════════════
@app.route('/api/randevu-al', methods=['POST'])
def randevu_al():
    d           = request.get_json(force=True, silent=True) or {}
    musteri_adi = (d.get('musteri_adi') or '').strip()
    musteri_tel = re.sub(r'\D', '', d.get('musteri_telefon') or '')
    tarih       = (d.get('tarih') or '').strip()
    saat        = (d.get('saat') or '').strip()

    if not musteri_adi:         return jsonify({'success': False, 'message': 'Ad Soyad zorunludur!'}), 400
    if len(musteri_tel) < 10:   return jsonify({'success': False, 'message': 'Geçerli telefon girin!'}), 400
    if not d.get('isletme_id'): return jsonify({'success': False, 'message': 'İşletme seçilmedi!'}), 400
    if not tarih:               return jsonify({'success': False, 'message': 'Tarih seçilmedi!'}), 400
    if not saat:                return jsonify({'success': False, 'message': 'Saat seçilmedi!'}), 400

    isletme_id = int(d['isletme_id'])
    calisan_id = int(d['calisan_id']) if d.get('calisan_id') and str(d['calisan_id']) not in ('', '0', 'null') else None
    hizmet_id  = int(d['hizmet_id'])  if d.get('hizmet_id')  and str(d['hizmet_id'])  not in ('', 'null')     else None

    try:
        con = db(); cur = con.cursor()
        cur.execute("SELECT id FROM randevular WHERE isletme_id=? AND tarih=? AND saat=? AND durum NOT IN ('iptal')",
                    isletme_id, tarih, saat)
        if cur.fetchone():
            con.close()
            return jsonify({'success': False, 'message': '❌ Bu saat için randevu dolu!'}), 400

        if calisan_id:
            cur.execute("SELECT id FROM randevular WHERE calisan_id=? AND tarih=? AND saat=? AND durum NOT IN ('iptal')",
                        calisan_id, tarih, saat)
            if cur.fetchone():
                con.close()
                return jsonify({'success': False, 'message': '❌ Bu uzman o saatte meşgul!'}), 400

        cur.execute("""
            INSERT INTO randevular(kullanici_id,isletme_id,calisan_id,hizmet_id,
                                   musteri_adi,musteri_telefon,tarih,saat,notlar)
            VALUES(?,?,?,?,?,?,?,?,?)
        """, session.get('user_id'), isletme_id, calisan_id, hizmet_id,
             musteri_adi, musteri_tel, tarih, saat, d.get('notlar') or '')
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Randevunuz oluşturuldu!'})
    except Exception as e:
        return jsonify({'success': False, 'message': f'❌ Hata: {str(e)}'}), 500

@app.route('/api/randevularim')
def randevularim():
    telefon_param = (request.args.get('telefon') or '').strip()
    if 'user_id' not in session and not telefon_param:
        return jsonify({'success': False, 'message': 'giris_gerekli'}), 401
    try:
        con = db(); cur = con.cursor()
        sql = """
            SELECT r.id, CONVERT(VARCHAR(10),r.tarih,23), CONVERT(VARCHAR(5),r.saat,108),
                   r.durum, ISNULL(r.notlar,''), r.musteri_adi, r.musteri_telefon,
                   ISNULL(i.ad,''), ISNULL(c.ad,''), ISNULL(h.ad,''),
                   CAST(ISNULL(h.ucret,0) AS FLOAT)
            FROM randevular r
            LEFT JOIN isletmeler i ON r.isletme_id=i.id
            LEFT JOIN calisanlar c ON r.calisan_id=c.id
            LEFT JOIN hizmetler  h ON r.hizmet_id=h.id
        """
        cols = ['id','tarih','saat','durum','notlar','musteri_adi','musteri_telefon',
                'isletme_adi','calisan_adi','hizmet_adi','ucret']
        if 'user_id' in session:
            cur.execute(sql + " WHERE r.kullanici_id=? ORDER BY r.tarih DESC,r.saat DESC", session['user_id'])
        else:
            cur.execute(sql + " WHERE r.musteri_telefon=? ORDER BY r.tarih DESC,r.saat DESC",
                        re.sub(r'\D', '', telefon_param))
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        con.close()
        return jsonify({'success': True, 'randevular': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/randevu-iptal/<int:rid>', methods=['POST'])
def randevu_iptal(rid):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Giriş gerekli!'}), 401
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE randevular SET durum='iptal' WHERE id=? AND kullanici_id=?", rid, session['user_id'])
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Randevu iptal edildi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
# ADMİN PANELİ
# ══════════════════════════════════════════════════════════════════
def admin_req(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if not session.get('is_admin'):
            return jsonify({'success': False, 'message': '⛔ Yetkisiz!'}), 403
        return f(*a, **kw)
    return wrapper

@app.route('/api/admin/isletmeler')
@admin_req
def admin_isletmeler():
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT i.id, i.ad, i.tur, ISNULL(i.adres,''), ISNULL(i.telefon,''),
                   ISNULL(i.aciklama,''), ISNULL(i.aktif,1),
                   CONVERT(VARCHAR(16),i.kayit_tarihi,120),
                   (SELECT COUNT(*) FROM hizmetler  h WHERE h.isletme_id=i.id AND ISNULL(h.aktif,1)=1),
                   (SELECT COUNT(*) FROM calisanlar c WHERE c.isletme_id=i.id AND ISNULL(c.aktif,1)=1)
            FROM isletmeler i ORDER BY i.kayit_tarihi DESC
        """)
        cols = ['id','ad','tur','adres','telefon','aciklama','aktif','kayit_tarihi','hizmet_sayisi','calisan_sayisi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(cols, r)); d['aktif'] = bool(d['aktif']); rows.append(d)
        con.close()
        return jsonify({'success': True, 'isletmeler': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-ekle', methods=['POST'])
@admin_req
def admin_isletme_ekle():
    d = request.json or {}
    if not d.get('ad') or not d.get('tur'):
        return jsonify({'success': False, 'message': 'Ad ve tür zorunludur!'}), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("INSERT INTO isletmeler(ad,tur,adres,telefon,aciklama,aktif) VALUES(?,?,?,?,?,1)",
                    d['ad'], d['tur'], d.get('adres',''), d.get('telefon',''), d.get('aciklama',''))
        con.commit()
        cur.execute("SELECT TOP 1 id FROM isletmeler ORDER BY id DESC")
        row = cur.fetchone()
        if row:
            yeni_id = int(row[0])
            for g in range(1, 8):
                cur.execute("SELECT COUNT(*) FROM calisma_saatleri WHERE isletme_id=? AND gun_no=?", yeni_id, g)
                if cur.fetchone()[0] == 0:
                    cur.execute("INSERT INTO calisma_saatleri(isletme_id,gun_no,acilis,kapanis,kapali) VALUES(?,?,'09:00','19:00',?)",
                                yeni_id, g, 1 if g == 7 else 0)
            con.commit()
        con.close()
        return jsonify({'success': True, 'message': '✅ İşletme eklendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-guncelle/<int:iid>', methods=['PUT'])
@admin_req
def admin_isletme_guncelle(iid):
    d = request.json or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE isletmeler SET ad=?,tur=?,adres=?,telefon=?,aciklama=?,aktif=? WHERE id=?",
                    d['ad'], d['tur'], d.get('adres',''), d.get('telefon',''),
                    d.get('aciklama',''), 1 if d.get('aktif',True) else 0, iid)
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ İşletme güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/isletme-sil/<int:iid>', methods=['DELETE'])
@admin_req
def admin_isletme_sil(iid):
    try:
        con = db(); cur = con.cursor()
        cur.execute('DELETE FROM calisma_saatleri WHERE isletme_id=?', iid)
        cur.execute('DELETE FROM tatil_gunleri    WHERE isletme_id=?', iid)
        cur.execute('DELETE FROM isletmeler WHERE id=?', iid)
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ İşletme silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmetler')
@admin_req
def admin_hizmetler():
    iid = request.args.get('isletme_id')
    try:
        con = db(); cur = con.cursor()
        if iid:
            cur.execute("""
                SELECT h.id,h.isletme_id,h.ad,h.kategori,h.sure,CAST(h.ucret AS FLOAT),
                       ISNULL(h.aktif,1),ISNULL(i.ad,'')
                FROM hizmetler h LEFT JOIN isletmeler i ON h.isletme_id=i.id
                WHERE h.isletme_id=? ORDER BY h.kategori,h.ad
            """, int(iid))
        else:
            cur.execute("""
                SELECT h.id,h.isletme_id,h.ad,h.kategori,h.sure,CAST(h.ucret AS FLOAT),
                       ISNULL(h.aktif,1),ISNULL(i.ad,'')
                FROM hizmetler h LEFT JOIN isletmeler i ON h.isletme_id=i.id
                ORDER BY i.ad,h.kategori,h.ad
            """)
        cols = ['id','isletme_id','ad','kategori','sure','ucret','aktif','isletme_adi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(cols,r)); d['aktif']=bool(d['aktif']); d['ucret']=float(d['ucret']); rows.append(d)
        con.close()
        return jsonify({'success': True, 'hizmetler': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-ekle', methods=['POST'])
@admin_req
def admin_hizmet_ekle():
    d = request.json or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("INSERT INTO hizmetler(isletme_id,ad,kategori,sure,ucret,aktif) VALUES(?,?,?,?,?,1)",
                    int(d['isletme_id']), d['ad'], d.get('kategori','berber'),
                    int(d.get('sure',30)), float(d.get('ucret',0)))
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Hizmet eklendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-guncelle/<int:hid>', methods=['PUT'])
@admin_req
def admin_hizmet_guncelle(hid):
    d = request.json or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE hizmetler SET ad=?,kategori=?,sure=?,ucret=?,aktif=? WHERE id=?",
                    d['ad'], d['kategori'], int(d['sure']), float(d['ucret']),
                    1 if d.get('aktif',True) else 0, hid)
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Hizmet güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/hizmet-sil/<int:hid>', methods=['DELETE'])
@admin_req
def admin_hizmet_sil(hid):
    try:
        con = db(); cur = con.cursor()
        cur.execute('DELETE FROM hizmetler WHERE id=?', hid); con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Hizmet silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisanlar')
@admin_req
def admin_calisanlar():
    iid = request.args.get('isletme_id')
    try:
        con = db(); cur = con.cursor()
        if iid:
            cur.execute("""
                SELECT c.id,c.isletme_id,c.ad,c.uzmanlik,ISNULL(c.telefon,''),ISNULL(c.aktif,1),ISNULL(i.ad,'')
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id
                WHERE c.isletme_id=? ORDER BY c.ad
            """, int(iid))
        else:
            cur.execute("""
                SELECT c.id,c.isletme_id,c.ad,c.uzmanlik,ISNULL(c.telefon,''),ISNULL(c.aktif,1),ISNULL(i.ad,'')
                FROM calisanlar c LEFT JOIN isletmeler i ON c.isletme_id=i.id ORDER BY i.ad,c.ad
            """)
        cols = ['id','isletme_id','ad','uzmanlik','telefon','aktif','isletme_adi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(cols,r)); d['aktif']=bool(d['aktif']); rows.append(d)
        con.close()
        return jsonify({'success': True, 'calisanlar': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-ekle', methods=['POST'])
@admin_req
def admin_calisan_ekle():
    d = request.json or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("INSERT INTO calisanlar(isletme_id,ad,uzmanlik,telefon,aktif) VALUES(?,?,?,?,1)",
                    int(d['isletme_id']), d['ad'], d.get('uzmanlik','berber'), d.get('telefon',''))
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Çalışan eklendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-guncelle/<int:cid>', methods=['PUT'])
@admin_req
def admin_calisan_guncelle(cid):
    d = request.json or {}
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE calisanlar SET ad=?,uzmanlik=?,telefon=?,aktif=? WHERE id=?",
                    d['ad'], d['uzmanlik'], d.get('telefon',''),
                    1 if d.get('aktif',True) else 0, cid)
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Çalışan güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/calisan-sil/<int:cid>', methods=['DELETE'])
@admin_req
def admin_calisan_sil(cid):
    try:
        con = db(); cur = con.cursor()
        cur.execute('DELETE FROM calisanlar WHERE id=?', cid); con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Çalışan silindi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/tum-randevular')
@admin_req
def admin_tum_randevular():
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT r.id, CONVERT(VARCHAR(10),r.tarih,23), CONVERT(VARCHAR(5),r.saat,108),
                   r.durum, ISNULL(r.notlar,''), r.musteri_adi, r.musteri_telefon,
                   ISNULL(k.ad,''), ISNULL(i.ad,''), ISNULL(c.ad,''),
                   ISNULL(h.ad,''), CAST(ISNULL(h.ucret,0) AS FLOAT)
            FROM randevular r
            LEFT JOIN kullanicilar k ON r.kullanici_id=k.id
            LEFT JOIN isletmeler   i ON r.isletme_id=i.id
            LEFT JOIN calisanlar   c ON r.calisan_id=c.id
            LEFT JOIN hizmetler    h ON r.hizmet_id=h.id
            ORDER BY r.tarih DESC, r.saat DESC
        """)
        cols = ['id','tarih','saat','durum','notlar','musteri_adi','musteri_telefon',
                'kullanici_adi','isletme_adi','calisan_adi','hizmet_adi','ucret']
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        con.close()
        return jsonify({'success': True, 'randevular': rows})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/randevu-durum-guncelle/<int:rid>', methods=['POST'])
@admin_req
def admin_randevu_durum(rid):
    durum = (request.json or {}).get('durum', '')
    if durum not in ('onaylandi','tamamlandi','iptal','bekliyor'):
        return jsonify({'success': False, 'message': 'Geçersiz durum!'}), 400
    try:
        con = db(); cur = con.cursor()
        cur.execute("UPDATE randevular SET durum=? WHERE id=?", durum, rid)
        con.commit(); con.close()
        return jsonify({'success': True, 'message': '✅ Durum güncellendi!'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/admin/istatistikler')
@admin_req
def admin_istatistikler():
    try:
        con = db(); cur = con.cursor()
        def say(sql): cur.execute(sql); return cur.fetchone()[0]
        stats = {
            'isletme'       : say("SELECT COUNT(*) FROM isletmeler WHERE ISNULL(aktif,1)=1"),
            'calisan'       : say("SELECT COUNT(*) FROM calisanlar WHERE ISNULL(aktif,1)=1"),
            'hizmet'        : say("SELECT COUNT(*) FROM hizmetler  WHERE ISNULL(aktif,1)=1"),
            'toplam_randevu': say("SELECT COUNT(*) FROM randevular"),
            'bekleyen'      : say("SELECT COUNT(*) FROM randevular WHERE durum='bekliyor'"),
            'onaylanan'     : say("SELECT COUNT(*) FROM randevular WHERE durum='onaylandi'"),
            'tamamlanan'    : say("SELECT COUNT(*) FROM randevular WHERE durum='tamamlandi'"),
            'kullanici'     : say("SELECT COUNT(*) FROM kullanicilar WHERE ISNULL(is_admin,0)=0"),
        }
        con.close()
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ══════════════════════════════════════════════════════════════════
if __name__ == '__main__':
    try: local_ip = socket.gethostbyname(socket.gethostname())
    except: local_ip = '127.0.0.1'
    print(f"\n🌐 http://localhost:5000")
    if local_ip != '127.0.0.1': print(f"📱 http://{local_ip}:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)