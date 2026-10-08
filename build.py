#!/usr/bin/env python3
"""Build a single-file search page from a Substack export.

Usage:
  python3 build.py EXPORT_DIR              private build, every published post, full text
  python3 build.py EXPORT_DIR --public     public build, full text for free posts only

EXPORT_DIR is the unzipped Substack export. It must contain posts.csv and a posts/ folder of .html files.
Only those two things are read. The subscriber and open/delivery CSV files in the export are never opened.
Output: dist/index.html (or --out). Needs only the Python standard library.
"""
import argparse, csv, html, json, os, re, sys
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))

class _Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.t = []; self.skip = 0
    def handle_starttag(self, tag, a):
        if tag in ('script', 'style', 'picture', 'figure'): self.skip += 1
        if tag in ('p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'): self.t.append('\n')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'picture', 'figure') and self.skip: self.skip -= 1
    def handle_data(self, d):
        if not self.skip: self.t.append(d)

def post_text(path):
    p = _Text()
    with open(path, encoding='utf-8', errors='replace') as f: p.feed(f.read())
    x = html.unescape(''.join(p.t))
    x = re.sub(r'[ \t\u00a0]+', ' ', x)
    return re.sub(r'\n\s*\n+', '\n\n', x).strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export_dir')
    ap.add_argument('--public', action='store_true', help='full text for free posts only')
    ap.add_argument('--out', default=os.path.join(HERE, 'dist', 'index.html'))
    a = ap.parse_args()

    with open(os.path.join(a.export_dir, 'posts.csv'), encoding='utf-8') as f:
        rows = [r for r in csv.DictReader(f) if r['is_published'] == 'true']
    docs = []
    for r in rows:
        pid = r['post_id']
        slug = pid.split('.', 1)[1] if '.' in pid else pid
        free = r['audience'] == 'everyone'
        locked = a.public and not free
        text = '' if locked else post_text(os.path.join(a.export_dir, 'posts', pid + '.html'))
        docs.append(dict(slug=slug, date=r['post_date'][:10], title=(r['title'] or slug).strip(),
                         sub=(r['subtitle'] or '').strip(), aud=r['audience'], type=r['type'],
                         text=text, locked=locked))

    data = json.dumps(docs, ensure_ascii=False, separators=(',', ':'))
    data = data.replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    with open(os.path.join(HERE, 'src', 'core.js'), encoding='utf-8') as f:
        core = f.read().replace("if (typeof module !== 'undefined') module.exports = Core;", '')
    with open(os.path.join(HERE, 'src', 'template.html'), encoding='utf-8') as f:
        page = f.read()
    note = ('Full text of free posts only. Paid posts show title, date and subtitle.' if a.public
            else 'Includes paid-only posts, so keep this page private. Drafts and subscriber data are not in it.')
    page = page.replace('__NOTE__', note).replace('__DATA__', data).replace('__CORE__', core)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8') as f: f.write(page)
    free_n = sum(1 for d in docs if d['aud'] == 'everyone')
    print(f"{len(docs)} posts ({free_n} free) -> {a.out} ({len(page.encode()) / 1e6:.1f} MB)"
          + ('  [public build]' if a.public else '  [private build, do not publish]'))

if __name__ == '__main__':
    main()
