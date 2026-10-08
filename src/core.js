const Core = (function () {
  const SYN = { kiev: 'kyiv', kharkov: 'kharkiv', lvov: 'lviv', chernobyl: 'chornobyl', zaporozhye: 'zaporizhia', nikolaev: 'mykolaiv', odessa: 'odesa' };
  const tokRe = /[\p{L}\p{N}]+/gu;
  const normText = (s) => s.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ё/g, 'е');
  function loose(t) {
    if (SYN[t]) t = SYN[t];
    if (/[a-z]/.test(t)) t = t.replace(/zhzh/g, 'zh').replace(/(?:yi|iy)$/, 'y').replace(/(.)\1+/g, '$1');
    return t;
  }
  const key = (raw) => loose(normText(raw));
  const tokens = (s) => Array.from(s.matchAll(tokRe), (m) => key(m[0]));
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function build(docs) {
    const post = new Map();
    const add = (i, s, w) => {
      for (const m of s.matchAll(tokRe)) {
        const k = key(m[0]);
        let d = post.get(k);
        if (!d) { d = new Map(); post.set(k, d); }
        d.set(i, (d.get(i) || 0) + w);
      }
    };
    docs.forEach((d, i) => { add(i, d.title, 4); add(i, d.sub, 2); add(i, d.text, 1); d.low = normText(d.text); });
    return { post, keys: Array.from(post.keys()).sort(), docs, N: docs.length };
  }

  function lower(keys, p) {
    let lo = 0, hi = keys.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid] < p) lo = mid + 1; else hi = mid; }
    return lo;
  }

  function termScores(idx, kq) {
    const out = new Map();
    const addMap = (m, wt) => {
      const idf = Math.log(1 + idx.N / m.size);
      for (const [i, tf] of m) out.set(i, (out.get(i) || 0) + wt * idf * (1 + Math.log(tf)));
    };
    const ex = idx.post.get(kq);
    if (ex) addMap(ex, 1);
    if (kq.length >= 4) {
      for (let j = lower(idx.keys, kq); j < idx.keys.length && idx.keys[j].startsWith(kq); j++) {
        if (idx.keys[j] !== kq) addMap(idx.post.get(idx.keys[j]), 0.5);
      }
    }
    return out;
  }

  function parse(q) {
    const phrases = [];
    q = q.replace(/"([^"]+)"/g, (_, p) => { phrases.push(normText(p).trim()); return ' '; });
    const words = [], excl = [];
    for (const w of q.split(/\s+/).filter(Boolean)) {
      if (w[0] === '-' && w.length > 1) excl.push(...tokens(w.slice(1)));
      else words.push(...tokens(w));
    }
    return { words, phrases: phrases.filter(Boolean), excl };
  }

  function search(idx, q) {
    const p = parse(q);
    const hl = p.words.concat(...p.phrases.map(tokens));
    if (!p.words.length && !p.phrases.length) return { results: null, terms: [] };
    let cand = null;
    for (const kq of p.words) {
      const m = termScores(idx, kq);
      if (cand === null) cand = m;
      else { const nxt = new Map(); for (const [i, s] of cand) if (m.has(i)) nxt.set(i, s + m.get(i)); cand = nxt; }
    }
    if (cand === null) { cand = new Map(); idx.docs.forEach((_, i) => cand.set(i, 0)); }
    for (const ph of p.phrases) {
      for (const i of Array.from(cand.keys())) {
        const d = idx.docs[i];
        if (d.low.includes(ph) || normText(d.title).includes(ph) || normText(d.sub).includes(ph)) cand.set(i, cand.get(i) + 5);
        else cand.delete(i);
      }
    }
    for (const kq of p.excl) for (const i of termScores(idx, kq).keys()) cand.delete(i);
    return { results: Array.from(cand, ([i, score]) => ({ i, score })), terms: hl };
  }

  const hit = (k, terms) => terms.some((t) => k === t || (t.length >= 4 && k.startsWith(t)));

  function highlight(str, terms) {
    let out = '', last = 0;
    for (const m of str.matchAll(tokRe)) {
      if (terms.length && hit(key(m[0]), terms)) {
        out += esc(str.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
        last = m.index + m[0].length;
      }
    }
    return out + esc(str.slice(last));
  }

  function snippet(doc, terms, len) {
    len = len || 240;
    const t = doc.text;
    if (!t) return '';
    let at = -1;
    if (terms.length) for (const m of t.matchAll(tokRe)) { if (hit(key(m[0]), terms)) { at = m.index; break; } }
    let a = at < 0 ? 0 : Math.max(0, at - 90);
    if (a > 0) { const sp = t.indexOf(' ', a); if (sp > -1 && sp < at) a = sp + 1; }
    let b = Math.min(t.length, a + len);
    if (b < t.length) { const sp = t.lastIndexOf(' ', b); if (sp > a + 40) b = sp; }
    return (a > 0 ? '… ' : '') + highlight(t.slice(a, b).replace(/\s+/g, ' '), terms) + (b < t.length ? ' …' : '');
  }

  return { build, search, snippet, highlight, esc, key, parse };
})();
if (typeof module !== 'undefined') module.exports = Core;
