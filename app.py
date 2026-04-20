# -*- coding: utf-8 -*-
from flask import Flask, render_template, request, jsonify, session, redirect
from flask_cors import CORS
import os
import pyodbc, re, socket
from translation_service import TranslationService

app = Flask(__name__)
app.secret_key = 'berber-randevu-2024-xyz'
CORS(app)
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def add_no_cache_headers(resp):
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '0'
    return resp

SERVER   = 'DESKTOP-T20P6DA\\SQLEXPRESS'
DATABASE = 'BerberRandevu'
CONN_STR = f'DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

def db():
    return pyodbc.connect(CONN_STR, timeout=10)

translation_service = TranslationService(db)

# ??????????????????????????????????????????????????????????????????
# VER?TABANI HAZIRLIK
# ??????????????????????????????????????????????????????????????????
def init_db():
    con = db()
    cur = con.cursor()

    # ?? ADIM 1: FK onar?m? (normalde kapal?) ??????????????????????
    # Her a??l??ta FK DROP i?lemi yava? oldu?u i?in varsay?lan olarak kapat?ld?.
    db_repair = (os.getenv('APP_DB_REPAIR', '0').strip().lower() in ('1', 'true', 'yes', 'on'))
    if db_repair:
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
            print("? FK constraint'ler temizlendi")
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

    # ?? ADIM 2: Tablolar ??????????????????????????????????????????

    if not tablo_var('kullanicilar'):
        cur.execute("""
            CREATE TABLE kullanicilar(
                id           INT IDENTITY(1,1) PRIMARY KEY,
                ad           NVARCHAR(100) NOT NULL,
                email        NVARCHAR(100) NOT NULL UNIQUE,
                sifre        NVARCHAR(200) NOT NULL,
                telefon      NVARCHAR(20)  NULL,
                kayit_tarihi DATETIME DEFAULT GETDATE()
            )""")
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
    if not sutun_var('isletmeler', 'latitude'):
        cur.execute("ALTER TABLE isletmeler ADD latitude FLOAT NULL")
    if not sutun_var('isletmeler', 'longitude'):
        cur.execute("ALTER TABLE isletmeler ADD longitude FLOAT NULL")

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
    if not sutun_var('hizmetler', 'ad_en'):
        cur.execute("ALTER TABLE hizmetler ADD ad_en NVARCHAR(100) NULL")
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

    # calisma_saatleri ? KES?NL?KLE FK CONSTRAINT YOK
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

    # tatil_gunleri ? KES?NL?KLE FK CONSTRAINT YOK
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

    # ?? ADIM 3: Eksik calisma_saatleri sat?rlar?n? toplu tamamla ????
    try:
        cur.execute("""
            ;WITH gunler AS (
                SELECT 1 AS gun_no UNION ALL SELECT 2 UNION ALL SELECT 3
                UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7
            )
            INSERT INTO calisma_saatleri(isletme_id, gun_no, acilis, kapanis, kapali)
            SELECT i.id, g.gun_no, '09:00', '19:00',
                   CASE WHEN g.gun_no = 7 THEN 1 ELSE 0 END
            FROM isletmeler i
            CROSS JOIN gunler g
            LEFT JOIN calisma_saatleri cs
              ON cs.isletme_id = i.id AND cs.gun_no = g.gun_no
            WHERE cs.id IS NULL
        """)
        con.commit()
    except Exception as e:
        print(f"  calisma_saatleri: {e}")
        try: con.rollback()
        except: pass

    # ?? ADIM 4: NULL aktif d?zelt ?????????????????????????????????
    try:
        cur.execute("UPDATE hizmetler  SET aktif=1 WHERE aktif IS NULL")
        cur.execute("UPDATE calisanlar SET aktif=1 WHERE aktif IS NULL")
        cur.execute("UPDATE isletmeler SET aktif=1 WHERE aktif IS NULL")
        con.commit()
    except: pass

    con.close()
    print("Veritabanı hazır")
    try:
        translation_service.ensure_schema()
    except Exception as ex:
        print(f"Çeviri cache init hatası: {ex}")

try:
    init_db()
except Exception as ex:
    print(f"DB init hatası: {ex}")

@app.route('/api/translation-config')
def translation_config():
    try:
        translation_service.ensure_schema()
    except Exception:
        pass
    return jsonify(success=True, **translation_service.status())

@app.route('/api/translate', methods=['POST'])
def api_translate():
    try:
        try:
            translation_service.ensure_schema()
        except Exception:
            pass
        d = request.get_json(force=True, silent=True) or {}
        texts = d.get('texts') or []
        if isinstance(texts, str):
            texts = [texts]
        source_lang = (d.get('source_lang') or 'tr').strip().lower()
        target_lang = (d.get('target_lang') or 'en').strip().lower()
        fmt = (d.get('format') or 'text').strip().lower()
        translated = translation_service.translate_batch(texts, source_lang=source_lang, target_lang=target_lang, fmt=fmt)
        return jsonify(success=True, provider=translation_service.provider, translations=translated)
    except Exception as ex:
        return jsonify(success=False, message=str(ex)), 500

# ??????????????????????????????????????????????????????????????????
# SAYFALAR
# ??????????????????????????????????????????????????????????????????
@app.route('/')
def index():
    try:
        css_path = os.path.join(app.root_path, 'static', 'css', 'app.css')
        js_path = os.path.join(app.root_path, 'static', 'js', 'app.js')
        css_mtime = int(os.path.getmtime(css_path)) if os.path.exists(css_path) else 0
        js_mtime = int(os.path.getmtime(js_path)) if os.path.exists(js_path) else 0
        asset_v = max(css_mtime, js_mtime)
    except Exception:
        asset_v = 0
    return render_template('app.html', asset_v=asset_v)

# ??????????????????????????????????????????????????????????????????
# KULLANICI
# ??????????????????????????????????????????????????????????????????
@app.route('/api/kayit', methods=['POST'])
def kayit():
    try:
        d = request.json or {}
        if not d.get('ad') or not d.get('email') or not d.get('sifre'):
            return jsonify({'success': False, 'message': 'Ad, e-posta ve şifre zorunludur!'}), 400
        if len(d['sifre']) < 6:
            return jsonify({'success': False, 'message': 'Şifre en az 6 karakter olmalıdır!'}), 400
        con = db(); cur = con.cursor()
        cur.execute("SELECT id FROM kullanicilar WHERE email=?", d['email'])
        if cur.fetchone():
            con.close()
            return jsonify({'success': False, 'message': 'Bu e-posta zaten kayıtlı!'}), 400
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
            SELECT id, ad, email, ISNULL(telefon,'')
            FROM kullanicilar WHERE email=? AND sifre=?
        """, d.get('email', ''), d.get('sifre', ''))
        row = cur.fetchone(); con.close()
        if not row:
            return jsonify({'success': False, 'message': '❌ E-posta veya şifre hatalı!'}), 401
        session['user_id']    = row[0]
        session['user_name']  = row[1]
        session['user_email'] = row[2]
        return jsonify({'success': True, 'message': '✅ Giriş başarılı!',
                        'user': {'id': row[0], 'ad': row[1], 'email': row[2],
                                 'telefon': row[3]}})
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
    return jsonify({
        'success': True,
        'user': {
            'id': session['user_id'],
            'ad': session.get('user_name', ''),
            'email': session.get('user_email', '')
        }
    })

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
        return jsonify({'success': False, 'message': 'Şifre en az 6 karakter olmalıdır!'}), 400
    try:
        con = db(); cur = con.cursor()
        uid = session['user_id']
        # E-posta başkası tarafından kullanılıyor mu?
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

# ??????????????????????????????????????????????????????????????????
# PUBLIC API
# ??????????????????????????????????????????????????????????????????
@app.route('/api/public/isletmeler')
def public_isletmeler():
    try:
        con = db(); cur = con.cursor()
        cur.execute("""
            SELECT
                i.id,
                i.ad,
                i.tur,
                ISNULL(i.adres,''),
                ISNULL(i.telefon,''),
                ISNULL(i.aciklama,''),
                CAST(ISNULL(i.latitude, 0) AS FLOAT),
                CAST(ISNULL(i.longitude, 0) AS FLOAT),
                ISNULL(h.hizmet_sayisi, 0) AS hizmet_sayisi,
                ISNULL(c.calisan_sayisi, 0) AS calisan_sayisi
            FROM isletmeler i
            LEFT JOIN (
                SELECT isletme_id, COUNT(*) AS hizmet_sayisi
                FROM hizmetler
                WHERE ISNULL(aktif,1)=1
                GROUP BY isletme_id
            ) h ON h.isletme_id = i.id
            LEFT JOIN (
                SELECT isletme_id, COUNT(*) AS calisan_sayisi
                FROM calisanlar
                WHERE ISNULL(aktif,1)=1
                GROUP BY isletme_id
            ) c ON c.isletme_id = i.id
            WHERE ISNULL(i.aktif,1)=1
            ORDER BY i.kayit_tarihi DESC
        """)
        cols = ['id', 'ad', 'tur', 'adres', 'telefon', 'aciklama', 'latitude', 'longitude', '_hizmetSayisi', '_calisanSayisi']
        rows = []
        for r in cur.fetchall():
            d = dict(zip(cols, r))
            d['id'] = int(d['id'])
            d['latitude'] = float(d['latitude']) if d.get('latitude') else None
            d['longitude'] = float(d['longitude']) if d.get('longitude') else None
            d['_hizmetSayisi'] = int(d.get('_hizmetSayisi') or 0)
            d['_calisanSayisi'] = int(d.get('_calisanSayisi') or 0)
            rows.append(d)
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
        # JOIN KULLANMIYORUZ - isletmeler aktif kontrol? ayr?
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

# ??????????????????????????????????????????????????????????????????
# M?SA?T SAATLER
# ??????????????????????????????????????????????????????????????????
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
            return jsonify({'success': True, 'musait_saatler': [], 'mesaj': 'İşletme bugün kapalıdır.'})

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

        # T?m saatleri dolu/bo? bilgisiyle d?nd?r
        tum_slotlar = [{'saat': s, 'dolu': s in dolu} for s in slotlar]
        return jsonify({'success': True,
                        'musait_saatler': [s for s in slotlar if s not in dolu],
                        'tum_saatler': tum_slotlar,
                        'acilis': acilis, 'kapanis': kapanis})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# ??????????????????????????????????????????????????????????????????
# RANDEVU AL
# ??????????????????????????????????????????????????????????????????
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
                   r.isletme_id, r.hizmet_id,
                   ISNULL(i.ad,''), ISNULL(c.ad,''), ISNULL(h.ad,''), ISNULL(h.ad_en,''),
                   CAST(ISNULL(h.ucret,0) AS FLOAT)
            FROM randevular r
            LEFT JOIN isletmeler i ON r.isletme_id=i.id
            LEFT JOIN calisanlar c ON r.calisan_id=c.id
            LEFT JOIN hizmetler  h ON r.hizmet_id=h.id
        """
        cols = ['id','tarih','saat','durum','notlar','musteri_adi','musteri_telefon',
                'isletme_id','hizmet_id','isletme_adi','calisan_adi','hizmet_adi','hizmet_adi_en','ucret']
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

# ??????????????????????????????????????????????????????????????????
def _detect_local_ip():
    # LAN IP detection for link sharing on same network.
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"
    finally:
        sock.close()


if __name__ == '__main__':
    host = os.getenv('APP_HOST', '0.0.0.0')
    port = int(os.getenv('APP_PORT', '5000'))
    # Varsayılanı prod-benzeri tut: debug kapalı, istenirse env ile aç.
    debug = os.getenv('APP_DEBUG', '0').strip().lower() in ('1', 'true', 'yes', 'on')
    use_reloader = os.getenv('APP_RELOADER', '0').strip().lower() in ('1', 'true', 'yes', 'on')

    local_ip = _detect_local_ip()
    print(f"\nLocal: http://localhost:{port}")
    if local_ip != '127.0.0.1':
        print(f"LAN:   http://{local_ip}:{port}")
    print("=" * 50)

    app.run(debug=debug, host=host, port=port, use_reloader=use_reloader)








