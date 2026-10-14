# Builds privacy/index.html (English, Français, العربية) from the app's own strings,
# so the web page always matches the in-app policy. Run after editing the policy text.
import os, re, html
ROOT = os.path.join(os.path.dirname(__file__), '..')
RES = os.path.join(ROOT, 'BoumerdesStays', 'Resources')
EMAIL = 'support@boumerdesstays.app'  # TODO: keep in sync with AppInfo.supportEmail
SECTIONS = ['summary', 'device', 'content', 'apps', 'reports', 'listings', 'children', 'changes', 'contact']

def load(lang):
    t = {}
    for m in re.finditer(r'^"((?:[^"\\]|\\.)*)" = "((?:[^"\\]|\\.)*)";', open(os.path.join(RES, f'{lang}.lproj/Localizable.strings'), encoding='utf-8').read(), re.M):
        t[m.group(1)] = m.group(2).replace('\\"', '"')
    return t

blocks = []
for lang, label, d in [('en', 'English', 'ltr'), ('fr', 'Français', 'ltr'), ('ar', 'العربية', 'rtl')]:
    t = load(lang)
    title = t.get('Privacy policy', 'Privacy policy')
    updated = t.get('Last updated %@', 'Last updated %@').replace('%@', '11/10/2026')
    body = ''.join(
        f'<h2>{html.escape(t[f"privacy.{s}.title"])}</h2><p>{html.escape(t[f"privacy.{s}.body"])}</p>' for s in SECTIONS)
    body += f'<p><a href="mailto:{EMAIL}">{EMAIL}</a></p>'
    blocks.append(f'<section id="{lang}" lang="{lang}" dir="{d}"><h1>{html.escape(title)}</h1><p class="muted">{html.escape(updated)}</p>{body}</section>')

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zalumo · Privacy policy</title>
<style>
:root {{ --bg:#FFFBE5; --fg:#1d1d1b; --muted:#6b6b60; --accent:#2A7C13; --line:#E8D5AE; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0E1509; --fg:#f2f2ea; --muted:#9aa393; --accent:#76C457; --line:#2F3F27; }} }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:17px/1.6 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }}
main {{ max-width:720px; margin:0 auto; padding:24px 16px 64px; }}
nav {{ display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px; }}
nav a, a {{ color:var(--accent); font-weight:600; }}
section {{ border-top:1px solid var(--line); padding-top:16px; margin-top:24px; }}
h1 {{ font-size:28px; margin:0 0 4px; }} h2 {{ font-size:19px; margin:24px 0 4px; }}
.muted {{ color:var(--muted); margin:0; font-size:15px; }}
</style>
</head>
<body><main>
<p><strong>Zalumo</strong></p>
<nav><a href="#en">English</a><a href="#fr">Français</a><a href="#ar">العربية</a></nav>
{"".join(blocks)}
</main></body></html>
'''
out = os.path.join(ROOT, 'privacy', 'index.html')
open(out, 'w', encoding='utf-8').write(page)
print('wrote', out)
