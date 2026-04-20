from pathlib import Path
path = Path('app.py')
text = path.read_text()
pattern = chr(64) +  app.route /admin-panel 
start = text.find(pattern)
if start != -1:
    end = text.find(chr(64) +  app.route /api/kayit )
    if end != -1:
        text = text[:start] + text[end:]
pattern = chr(64) +  app.route /api/admin/isletmeler 
start = text.find(pattern)
if start != -1:
    end = text.find(chr(64) +  app.route /api/public/isletmeler )
    if end != -1:
        text = text[:start] + text[end:]
path.write_text(text)
