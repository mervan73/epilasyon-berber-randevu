import hashlib
import html
import json
import os
import urllib.parse
import urllib.request as urllib_req


def _truthy(value):
    return str(value or '').strip().lower() in ('1', 'true', 'yes', 'on')


class TranslationService:
    def __init__(self, db_factory=None):
        self.db_factory = db_factory
        self.timeout = int(os.getenv('TRANSLATION_TIMEOUT', '12') or '12')

    @property
    def provider(self):
        configured = (os.getenv('TRANSLATION_PROVIDER') or '').strip().lower()
        if configured in ('deepl', 'google', 'google_public', 'none'):
            return configured
        if os.getenv('DEEPL_API_KEY'):
            return 'deepl'
        if os.getenv('GOOGLE_TRANSLATE_API_KEY') or os.getenv('GOOGLE_CLOUD_TRANSLATE_API_KEY'):
            return 'google'
        if _truthy(os.getenv('ALLOW_PUBLIC_TRANSLATE_FALLBACK', '1')):
            return 'google_public'
        return 'none'

    def status(self):
        provider = self.provider
        return {
            'enabled': provider != 'none',
            'provider': provider,
            'using_public_fallback': provider == 'google_public',
            'deepl_configured': bool(os.getenv('DEEPL_API_KEY')),
            'google_configured': bool(os.getenv('GOOGLE_TRANSLATE_API_KEY') or os.getenv('GOOGLE_CLOUD_TRANSLATE_API_KEY')),
        }

    def ensure_schema(self):
        if not self.db_factory:
            return
        con = self.db_factory()
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM sysobjects WHERE name='ceviri_cache' AND xtype='U'")
        if cur.fetchone()[0] == 0:
            cur.execute("""
                CREATE TABLE ceviri_cache(
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    provider        NVARCHAR(50) NOT NULL,
                    source_lang     NVARCHAR(10) NOT NULL,
                    target_lang     NVARCHAR(10) NOT NULL,
                    source_hash     NVARCHAR(64) NOT NULL,
                    source_text     NVARCHAR(MAX) NOT NULL,
                    translated_text NVARCHAR(MAX) NOT NULL,
                    created_at      DATETIME DEFAULT GETDATE(),
                    CONSTRAINT UQ_ceviri_cache UNIQUE(provider, source_lang, target_lang, source_hash)
                )
            """)
        con.commit()
        con.close()

    def translate_text(self, text, source_lang='tr', target_lang='en', fmt='text'):
        return self.translate_batch([text], source_lang=source_lang, target_lang=target_lang, fmt=fmt)[0]

    def translate_batch(self, texts, source_lang='tr', target_lang='en', fmt='text'):
        normalized = list(texts or [])
        if not normalized:
            return []

        if source_lang == target_lang:
            return normalized

        provider = self.provider
        if provider == 'none':
            return normalized

        results = [None] * len(normalized)
        pending = []
        pending_positions = []

        for idx, text in enumerate(normalized):
            raw = str(text or '')
            if not raw.strip():
                results[idx] = raw
                continue
            cached = self._get_cached(provider, source_lang, target_lang, raw)
            if cached is not None:
                results[idx] = cached
                continue
            pending.append(raw)
            pending_positions.append(idx)

        if pending:
            translated = self._translate_remote(pending, source_lang=source_lang, target_lang=target_lang, fmt=fmt)
            for idx, source_text, translated_text in zip(pending_positions, pending, translated):
                translated_text = translated_text or source_text
                results[idx] = translated_text
                self._set_cached(provider, source_lang, target_lang, source_text, translated_text)

        return [item if item is not None else '' for item in results]

    def _hash(self, text):
        return hashlib.sha256((text or '').encode('utf-8')).hexdigest()

    def _get_cached(self, provider, source_lang, target_lang, text):
        if not self.db_factory:
            return None
        try:
            con = self.db_factory()
            cur = con.cursor()
            cur.execute("""
                SELECT translated_text
                FROM ceviri_cache
                WHERE provider=? AND source_lang=? AND target_lang=? AND source_hash=? AND source_text=?
            """, provider, source_lang, target_lang, self._hash(text), text)
            row = cur.fetchone()
            con.close()
            return row[0] if row else None
        except Exception:
            return None

    def _set_cached(self, provider, source_lang, target_lang, text, translated_text):
        if not self.db_factory:
            return
        try:
            con = self.db_factory()
            cur = con.cursor()
            cur.execute("""
                MERGE ceviri_cache AS target
                USING (SELECT ? AS provider, ? AS source_lang, ? AS target_lang, ? AS source_hash) AS src
                ON target.provider=src.provider
                   AND target.source_lang=src.source_lang
                   AND target.target_lang=src.target_lang
                   AND target.source_hash=src.source_hash
                WHEN MATCHED THEN
                    UPDATE SET source_text=?, translated_text=?
                WHEN NOT MATCHED THEN
                    INSERT(provider, source_lang, target_lang, source_hash, source_text, translated_text)
                    VALUES(?, ?, ?, ?, ?, ?);
            """,
            provider, source_lang, target_lang, self._hash(text),
            text, translated_text,
            provider, source_lang, target_lang, self._hash(text), text, translated_text)
            con.commit()
            con.close()
        except Exception:
            try:
                con.close()
            except Exception:
                pass

    def _translate_remote(self, texts, source_lang='tr', target_lang='en', fmt='text'):
        provider = self.provider
        if provider == 'deepl':
            return self._translate_with_deepl(texts, source_lang=source_lang, target_lang=target_lang)
        if provider == 'google':
            return self._translate_with_google(texts, source_lang=source_lang, target_lang=target_lang, fmt=fmt)
        if provider == 'google_public':
            return [self._translate_with_google_public(text, source_lang=source_lang, target_lang=target_lang) for text in texts]
        return texts

    def _translate_with_deepl(self, texts, source_lang='tr', target_lang='en'):
        api_key = os.getenv('DEEPL_API_KEY', '').strip()
        if not api_key:
            return texts

        api_url = (os.getenv('DEEPL_API_URL') or '').strip()
        if not api_url:
            api_url = 'https://api-free.deepl.com/v2/translate' if _truthy(os.getenv('DEEPL_FREE_API', '1')) else 'https://api.deepl.com/v2/translate'

        payload = json.dumps({
            'text': texts,
            'source_lang': source_lang.upper(),
            'target_lang': target_lang.upper()
        }).encode('utf-8')
        req = urllib_req.Request(
            api_url,
            data=payload,
            headers={
                'Authorization': f'DeepL-Auth-Key {api_key}',
                'Content-Type': 'application/json',
                'User-Agent': 'MBX-Randevu/1.0'
            },
            method='POST'
        )
        with urllib_req.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        items = data.get('translations') or []
        return [html.unescape((item.get('text') or '').strip()) for item in items]

    def _translate_with_google(self, texts, source_lang='tr', target_lang='en', fmt='text'):
        api_key = (os.getenv('GOOGLE_TRANSLATE_API_KEY') or os.getenv('GOOGLE_CLOUD_TRANSLATE_API_KEY') or '').strip()
        if not api_key:
            return texts

        body = {
            'q': texts,
            'target': target_lang,
            'format': 'html' if fmt == 'html' else 'text'
        }
        if source_lang:
            body['source'] = source_lang

        req = urllib_req.Request(
            f'https://translation.googleapis.com/language/translate/v2?key={urllib.parse.quote(api_key)}',
            data=json.dumps(body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'MBX-Randevu/1.0'
            },
            method='POST'
        )
        with urllib_req.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        items = ((data.get('data') or {}).get('translations')) or []
        return [html.unescape((item.get('translatedText') or '').strip()) for item in items]

    def _translate_with_google_public(self, text, source_lang='tr', target_lang='en'):
        if not text or not text.strip():
            return text
        params = urllib.parse.urlencode({
            'client': 'gtx',
            'sl': source_lang,
            'tl': target_lang,
            'dt': 't',
            'q': text.strip()
        })
        req = urllib_req.Request(
            f'https://translate.googleapis.com/translate_a/single?{params}',
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib_req.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        return html.unescape((data[0][0][0] or '').strip())
