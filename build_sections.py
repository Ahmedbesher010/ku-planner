#!/usr/bin/env python3
"""يبني ملف sections.json من ملفات الشعب.

الاستخدام (سحب تلقائي من بانر، يكتشف رمز الفصل الحالي بنفسه):
  python build_sections.py --fetch
  python build_sections.py --fetch --cols 22,00                (كليات محددة؛ الافتراضي 00,06,08,09,22 والجنسان)
  python build_sections.py --fetch --term 144830              (فرض رمز فصل معيّن)
  python build_sections.py --peek 22                           (يطبع صفوفاً خاماً من بانر لفحص الأعمدة)
  python build_sections.py --scan -o /tmp/scan.json           (يفحص كل الكليات 00 إلى 49 ويحفظ النتيجة في ملف مؤقت)
الاستخدام (من ملفات):
  python build_sections.py data.js
  python build_sections.py engineering.html science.html cs.html
  python build_sections.py data.js banner1.html --date 2026-11-21

المدخلات المقبولة: data.js (من موقع الشعب) أو صفحات بانر المحفوظة (html / mht).
الخيارات: --men / --women (جنس واحد) ، --only-if-changed ، --force ، -o ملف_الخرج ، --date YYYY-MM-DD
تاريخ آخر تحديث: أحدث تاريخ بين تاريخ بيانات data.js وتاريخ حفظ صفحات بانر، أو ما تحدده بـ --date."""
import sys, re, json, email, datetime, pathlib, time, urllib.request
from html.parser import HTMLParser

DAYS = 'حنثرخ'
ALLCOLS = ['%02d' % n for n in range(0, 50)]   # للفحص (--scan) فقط
DEFCOLS = ['00', '06', '08', '09', '22', '33']        # 00 اللغة الإنجليزية ومتطلبات الجامعة، 06 الأعمال، 08 العلوم، 09 الحاسب، 22 الهندسة
NMC = {}
TYPES = {'نظري', 'عملي', 'بحث', 'اختياري', 'تدريب', 'محاضرة', 'معمل'}
DX = {'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4}
ST = {'available': 'متاحه', 'full': 'ممتلئة'}

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.rows = []; s.cells = []; s.out = []
    def handle_starttag(s, t, a):
        if t == 'tr': s.rows.append([])
        elif t in ('td', 'th'): s.cells.append([])
    def handle_endtag(s, t):
        if t in ('td', 'th') and s.cells:
            c = ' '.join(''.join(s.cells.pop()).split())
            if s.rows and t == 'td': s.rows[-1].append(c)
        elif t == 'tr' and s.rows: s.out.append(s.rows.pop())
    def handle_data(s, d):
        for c in s.cells: c.append(d)

def tm(x): return int(x[:2]) * 60 + int(x[2:4])

def banner(html, m, sx=''):
    p = P(); p.feed(html)
    for t in p.out:
        if len(t) != 13 or not t[1].isdigit(): continue
        try: u = int(t[5])
        except ValueError: u = 0
        o = m.setdefault(sx + ':' + t[1], {'num': t[0], 'crn': t[1], 'sec': t[2], 'st': t[3], 'u': u, 't': t[9], 'col': t[11], 'maj': t[12], 'm': []})
        if sx: o['sx'] = sx
        if t[4]: NMC.setdefault(t[0], t[4])
        ab = [x.strip() for x in t[8].split('-')]
        if len(ab) != 2 or not all(x[:4].isdigit() for x in ab): continue
        for ch in t[6].split():
            d = DAYS.find(ch)
            q = {'d': d, 's': tm(ab[0]), 'e': tm(ab[1])}
            if d >= 0 and q not in o['m']: o['m'].append(q)

LIST = 'https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Pages/SSMain.aspx'
BANNER = 'https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code={t}&p_col_code={c}&p_sex_code={s}'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'ar,en;q=0.8'}

def decode(b):
    for enc in ('utf-8', 'cp1256'):
        try: return b.decode(enc)
        except UnicodeDecodeError: pass
    return b.decode('utf-8', 'replace')

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()

def next_term(t):
    # الرمز = سنة هجرية (4 أرقام) + 10 أول / 20 ثاني / 30 صيفي، مثل 144820
    y, k = int(t[:4]), int(t[4:6])
    return '%d%d' % (y, k + 10) if k < 30 else '%d10' % (y + 1)

def has_rows(term):
    try:
        p = P(); p.feed(decode(get(BANNER.format(t=term, c='22', s='11'))))
        return any(len(t) == 13 and t[1].isdigit() for t in p.out)
    except Exception:
        return False

def current_term(prev=''):
    # صفحة الفهرس تضع رمز الفصل الحالي في div مخفي، فيتغير الرمز هنا تلقائياً كل فصل.
    # شبكة أمان: إن لم تُرجع هذه الصفحة شعباً (لم يُحدَّث الـ div بعد) جرّب الفصل التالي،
    # وإن تعذّرت قراءة الصفحة نفسها فابدأ من آخر فصل محفوظ.
    try: m = re.search(r'id="studyYearDiv"[^>]*>\s*(\d{6})', decode(get(LIST)))
    except Exception: m = None
    t = m.group(1) if m else (prev if re.fullmatch(r'\d{6}', prev or '') else None)
    if not t: return None
    if has_rows(t): return t
    nx = next_term(t)
    return nx if has_rows(nx) else t

def read(path):
    b = pathlib.Path(path).read_bytes()
    if re.match(rb'\s*(MIME-Version|From:|Content-Type|Subject|Date)', b[:300], re.I):
        out = ''
        for part in email.message_from_bytes(b).walk():
            if part.get_content_type() == 'text/html':
                out += part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', 'replace')
        return out
    for enc in ('utf-8', 'cp1256'):
        try: return b.decode(enc)
        except UnicodeDecodeError: pass
    return b.decode('utf-8', 'replace')

def names_from(secs):
    # يلتقط اسم المادة من العمود الخامس إن بدا اسماً (وليس نوعاً أو اسم كلية متكرراً)
    nums = {x['num'] for x in secs}; cnt = {}
    for n in nums:
        if NMC.get(n): cnt.setdefault(NMC[n], set()).add(n)
    return {n: NMC[n] for n in sorted(nums) if NMC.get(n) and NMC[n] not in TYPES and re.search(r'[\u0600-\u06FF]{3}', NMC[n]) and len(cnt[NMC[n]]) <= 3}

def kfu_data(txt, m, sexes):
    j = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    for x in j['sections']:
        sx = '12' if x['college'].endswith('F') else '11'
        if sx not in sexes: continue
        mt = []
        for g in x['meetings']:
            for d in g.get('days', []):
                q = {'d': DX.get(d, -1), 's': (g.get('time') or [0, 0])[0], 'e': (g.get('time') or [0, 0])[1]}
                if q['d'] >= 0 and g.get('time') and q not in mt: mt.append(q)
        m[sx + ':' + x['crn']] = {'sx': sx, 'num': x['course'], 'crn': x['crn'], 'sec': x['section'], 'st': ST.get(x['status'], 'x'), 'u': int(x['credits']), 't': x['instructor'], 'm': mt}
    return j['meta']['updated']

def main():
    a = sys.argv[1:]; out = 'sections.json'; date = None; women = False; files = []; i = 0
    fetch = False; peek = None; term = None; cols = DEFCOLS; sexes = ['11', '12']; scan = False; force = False; only_changed = False
    while i < len(a):
        if a[i] == '--women': sexes = ['12']
        elif a[i] == '--men': sexes = ['11']
        elif a[i] == '-o': i += 1; out = a[i]
        elif a[i] == '--date': i += 1; date = a[i]
        elif a[i] == '--fetch': fetch = True
        elif a[i] == '--peek': i += 1; peek = a[i]
        elif a[i] == '--force': force = True
        elif a[i] == '--only-if-changed': only_changed = True
        elif a[i] == '--term': i += 1; term = a[i]
        elif a[i] == '--cols': i += 1; cols = a[i].split(',')
        elif a[i] == '--scan': fetch = scan = True; cols = ALLCOLS
        else: files.append(a[i])
        i += 1
    if peek:
        term = term or current_term() or sys.exit('تعذر معرفة رمز الفصل')
        p = P(); p.feed(decode(get(BANNER.format(t=term, c=peek, s='11'))))
        for r in [t for t in p.out if len(t) == 13 and t[1].isdigit()][:4]: print(r)
        return
    if not files and not fetch: sys.exit(__doc__)
    m = {}; dates = []
    try: oldj = json.load(open(out, encoding='utf-8'))
    except Exception: oldj = {}
    for f in files:
        txt = read(f)
        if 'KFU_DATA' in txt[:200]: dates.append(kfu_data(txt, m, sexes))
        else:
            banner(txt, m)
            dates.append(datetime.date.fromtimestamp(pathlib.Path(f).stat().st_mtime).isoformat())
        print(f, '->', len(m), 'شعبة حتى الآن')
    counts = {}; failed = []
    if fetch:
        term = term or current_term(oldj.get('term', '')) or sys.exit('تعذر معرفة رمز الفصل، مرّره بـ --term 144820')
        print('رمز الفصل:', term)
        for sx in sexes:
            for c in cols:
                for attempt in (1, 2):
                    try: h = decode(get(BANNER.format(t=term, c=c, s=sx))); break
                    except Exception as e:
                        if attempt == 2: failed.append(c + '/' + sx); print('فشل', c, sx, e)
                        else: time.sleep(3)
                else: continue
                n0 = len(m); banner(h, m, sx); n = len(m) - n0
                if n: counts[c + '-' + sx] = n; print('كلية %s (%s): %d شعبة' % (c, 'طلاب' if sx == '11' else 'طالبات', n))
                time.sleep(0.4)
        dates.append(datetime.date.today().isoformat())
    if not m: sys.exit('لم أجد أي شعبة في الملفات.')
    secs = sorted(m.values(), key=lambda x: (x.get('sx', ''), x['crn']))
    old = oldj.get('secs', [])
    # نفس النطاق = نفس الفصل ونفس الكليات؛ عند تغيّر أيٍّ منهما (فصل جديد أو تعديل قائمة الكليات) يُسمح باختلاف العدد
    same_scope = bool(fetch) and oldj.get('term') == term and oldj.get('cols') == cols and oldj.get('sexes') == sexes
    if fetch and failed and not force:
        sys.exit('تعذر سحب: %s. لن أعدّل الملف حتى لا تضيع شعب. أعد المحاولة أو استخدم --force.' % ' '.join(failed))
    if old and not force and (same_scope or not fetch) and len(secs) < 0.5 * len(old):
        sys.exit('عدد الشعب الجديد (%d) أقل بكثير من القديم (%d)، لن أستبدل الملف. استخدم --force لتجاوز ذلك.' % (len(secs), len(old)))
    if fetch and same_scope:
        for k, n in (oldj.get('counts') or {}).items():
            if k not in counts: print('تنبيه: الكلية-الجنس %s كان فيها %d شعبة ولم تعد تُرجع شيئاً (ربما تغيّر الرابط).' % (k, n))
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    nums = {x['num'] for x in secs}
    names = {n: v for n, v in (oldj.get('names') or {}).items() if n in nums}   # لا يضيع اسم التُقط سابقاً
    names.update(names_from(secs))
    scope = {'term': term or '', 'cols': cols if fetch else [], 'sexes': sexes if fetch else []}
    changed = old != secs
    if only_changed and not changed and oldj.get('cols') == scope['cols'] and (oldj.get('checked_at') or '')[:10] == now[:10]:
        print('لا تغيير في الشعب، لم أعدّل الملف.'); return
    ua = now if changed or not oldj.get('updated_at') else oldj['updated_at']
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump({'updated': date or ua[:10], 'updated_at': ua, 'checked_at': now, **scope, 'counts': counts, 'names': names, 'secs': secs}, fh, ensure_ascii=False, separators=(',', ':'))
    print('تم: %d شعبة، آخر تغيير %s، الملف %s' % (len(secs), ua, out))

main()
