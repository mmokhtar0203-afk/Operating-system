"""Generate the furniture DD presentation sheets.

Geometry is re-plotted verbatim from the vector paths of the source PDFs
(geom.json, extracted by extract.py).  Source drawings are at 1:25 on A3
(1 m = 113.386 pt).  We only apply a uniform scale + translation per drawing.
Dimension values are the original labels; each one is checked against the
geometry below.
"""
import json, math, random, html, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
G = json.load(open(os.path.join(HERE, 'geom.json')))
PT_PER_M = 1000 / 25 * 72 / 25.4          # source: 1:25 -> 113.386 pt per metre
PT_MM = 25.4 / 72

# ---------------------------------------------------------------- palette
BG = '#F3EFE7'; INK = '#262523'; INK2 = '#4A4743'; GREY = '#8A857D'
CTX = '#A9A399'; RULE = '#CFC8BC'; ACC = '#A08A6A'
FILL = '#E6DCCB'; VEIN = '#CDBDA3'; FILL2 = '#EDE6DA'
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"

W_PRI, W_SEC, W_CTX, W_DIM, W_TICK = 0.35, 0.2, 0.13, 0.13, 0.3
DIM_TXT = 2.3

CHECK = []   # (sheet, label, measured_m)


class Drawing:
    def __init__(self, sheet, scale, origin_pt, place_mm):
        self.sheet, self.scale = sheet, scale
        self.ox, self.oy = origin_pt
        self.px, self.py = place_mm
        self.f = PT_MM * 25 / scale
        self.out = []

    def T(self, p):
        return (self.px + (p[0] - self.ox) * self.f, self.py + (p[1] - self.oy) * self.f)

    # ---- source paths
    def path_d(self, ids):
        d = []; last = None
        for i in ids:
            for op, pts in G[self.sheet]['paths'][i]['segs']:
                q = [self.T(p) for p in pts]
                if last is None or math.dist(last, q[0]) > 0.01:
                    d.append('M%.3f %.3f' % q[0])
                if op == 'l':
                    d.append('L%.3f %.3f' % q[1])
                elif op == 'c':
                    d.append('C%.3f %.3f %.3f %.3f %.3f %.3f' % (*q[1], *q[2], *q[3]))
                else:
                    raise ValueError(op)
                last = q[-1]
        return ' '.join(d)

    def chain_d(self, ids, tol=0.8):
        """Join segments of several paths into one closed outline (for fills)."""
        segs = []
        for i in ids:
            for op, pts in G[self.sheet]['paths'][i]['segs']:
                segs.append([op, [tuple(p) for p in pts]])
        cur = segs.pop(0); order = [cur]
        while segs:
            end = order[-1][1][-1]
            for k, s in enumerate(segs):
                if math.dist(s[1][0], end) < tol:
                    order.append(segs.pop(k)); break
                if math.dist(s[1][-1], end) < tol:
                    s = segs.pop(k); order.append([s[0], s[1][::-1]]); break
            else:
                raise RuntimeError('chain broken at %s (%d left)' % (end, len(segs)))
        d = ['M%.3f %.3f' % self.T(order[0][1][0])]
        for op, pts in order:
            q = [self.T(p) for p in pts]
            d.append(('L%.3f %.3f' % q[1]) if op == 'l' else
                     'C%.3f %.3f %.3f %.3f %.3f %.3f' % (*q[1], *q[2], *q[3]))
        return ' '.join(d) + ' Z'

    def stroke(self, ids, w, col=INK, extra=''):
        self.out.append(f'<path d="{self.path_d(ids)}" fill="none" stroke="{col}" '
                        f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>')

    def fill(self, ids, col=FILL, veins=None, seed=1):
        d = self.chain_d(ids)
        cid = f'clip{self.sheet}{ids[0]}{seed}'
        self.out.append(f'<clipPath id="{cid}"><path d="{d}"/></clipPath>')
        self.out.append(f'<path d="{d}" fill="{col}" stroke="none"/>')
        if veins:  # restrained travertine veining, clipped to outline
            xs = [float(v) for v in d.replace('M', ' ').replace('L', ' ').replace('C', ' ').replace('Z', ' ').split()]
            X, Y = xs[0::2], xs[1::2]
            x0, x1, y0, y1 = min(X), max(X), min(Y), max(Y)
            rnd = random.Random(seed); g = ['<g clip-path="url(#%s)" stroke="%s" fill="none">' % (cid, VEIN)]
            y = y0 + rnd.uniform(0.3, 1.0)
            while y < y1:
                pts = []; xx = x0 - 2; yy = y
                while xx < x1 + 2:
                    pts.append('%.2f %.2f' % (xx, yy)); xx += rnd.uniform(6, 14)
                    yy += rnd.uniform(-0.12, 0.12) * veins
                pts.append('%.2f %.2f' % (x1 + 2, yy))
                g.append(f'<polyline points="{" ".join(pts)}" stroke-width="{rnd.choice([0.06,0.08,0.1,0.14])}" '
                         f'opacity="{rnd.uniform(0.35, 0.9):.2f}"/>')
                y += rnd.uniform(0.5, 2.2) * veins
            g.append('</g>'); self.out.append(''.join(g))

    # ---- dimensions
    def _text(self, x, y, s, ang=0, anchor='middle', size=DIM_TXT, col=INK2, weight=400, base=''):
        b = f' dominant-baseline="{base}"' if base else ''
        self.out.append(f'<text x="{x:.3f}" y="{y:.3f}"{b} font-size="{size}" fill="{col}" '
                        f'font-weight="{weight}" text-anchor="{anchor}" '
                        f'transform="rotate({ang:.3f} {x:.3f} {y:.3f})">{html.escape(s)}</text>')

    def _line(self, a, b, w=W_DIM, col=INK2, dash=None):
        da = f' stroke-dasharray="{dash}"' if dash else ''
        self.out.append(f'<line x1="{a[0]:.3f}" y1="{a[1]:.3f}" x2="{b[0]:.3f}" y2="{b[1]:.3f}" '
                        f'stroke="{col}" stroke-width="{w}" stroke-linecap="round"{da}/>')

    def _tick(self, p, ang):
        L = 1.1; a = ang + math.radians(45)
        self._line((p[0] - L * math.cos(a), p[1] - L * math.sin(a)), (p[0] + L * math.cos(a), p[1] + L * math.sin(a)), W_TICK, INK)

    def dim(self, label, p1, p2, line_at, axis, note=None, expect=True):
        """axis 'h': p1,p2 measured along x, dim line at y=line_at (pt).
           axis 'v': measured along y, dim line at x=line_at (pt)."""
        if axis == 'h':
            m = abs(p2[0] - p1[0]) / PT_PER_M
            a, b = (p1[0], line_at), (p2[0], line_at)
        else:
            m = abs(p2[1] - p1[1]) / PT_PER_M
            a, b = (line_at, p1[1]), (line_at, p2[1])
        CHECK.append((self.sheet, label, m, expect))
        A, B = self.T(a), self.T(b)
        for P, Q in ((p1, a), (p2, b)):              # extension lines
            P, Q = self.T(P), self.T(Q)
            v = (Q[0] - P[0], Q[1] - P[1]); L = math.hypot(*v)
            if L < 0.01: continue
            u = (v[0] / L, v[1] / L)
            s = (P[0] + u[0] * 0.8, P[1] + u[1] * 0.8) if L > 1.6 else P
            self._line(s, (Q[0] + u[0] * 1.4, Q[1] + u[1] * 1.4), W_DIM, GREY)
        over = 1.2
        if axis == 'h':
            x0, x1 = sorted([A[0], B[0]])
            self._line((x0 - over, A[1]), (x1 + over, A[1]))
            self._tick((x0, A[1]), 0); self._tick((x1, A[1]), 0)
            self._text((x0 + x1) / 2, A[1] - 1.0, label + (note or ''))
        else:
            y0, y1 = sorted([A[1], B[1]])
            self._line((A[0], y0 - over), (A[0], y1 + over))
            self._tick((A[0], y0), math.pi / 2); self._tick((A[0], y1), math.pi / 2)
            self._text(A[0] - 1.0, (y0 + y1) / 2, label, ang=-90)

    def dim_aligned(self, label, p1, p2, side=1, along=0.5, gap=1.0):
        m = math.dist(p1, p2) / PT_PER_M
        CHECK.append((self.sheet, label, m, True))
        A, B = self.T(p1), self.T(p2)
        v = (B[0] - A[0], B[1] - A[1]); L = math.hypot(*v); u = (v[0] / L, v[1] / L)
        self._line((A[0] - u[0] * 1.0, A[1] - u[1] * 1.0), (B[0] + u[0] * 1.0, B[1] + u[1] * 1.0))
        ang = math.atan2(v[1], v[0])
        self._tick(A, ang); self._tick(B, ang)
        deg = math.degrees(ang)
        if deg > 90: deg -= 180
        if deg < -90: deg += 180
        n = (-u[1], u[0])  # normal
        M = (A[0] + v[0] * along + n[0] * side * gap, A[1] + v[1] * along + n[1] * side * gap)
        # baseline offset: for side text sits fully on that side
        self._text(M[0], M[1], label, ang=deg, base='central')

    def svg(self):
        return '\n'.join(self.out)


# ------------------------------------------------------------ sheet chrome
def title_block(num, total_title, sub, scale_txt, notes, active, extra_notes=()):
    x = 330; o = []
    T = lambda x, y, s, size=2.2, col=INK, w=400, ls=0, anchor='start': o.append(
        f'<text x="{x}" y="{y}" font-size="{size}" fill="{col}" font-weight="{w}" '
        f'letter-spacing="{ls}" text-anchor="{anchor}">{html.escape(s)}</text>')
    R = lambda y, x0=x, x1=404, col=RULE, w=0.15: o.append(
        f'<line x1="{x0}" y1="{y}" x2="{x1}" y2="{y}" stroke="{col}" stroke-width="{w}"/>')
    o.append(f'<line x1="322" y1="16" x2="322" y2="281" stroke="{RULE}" stroke-width="0.15"/>')
    T(x, 21.5, 'DESIGN DEVELOPMENT', 1.8, GREY, 500, 0.45)
    T(x, 31, 'Bespoke Furniture', 5.4, INK, 300)
    T(x, 37.5, 'Stone furniture collection', 2.4, GREY, 400)
    R(44)
    T(x, 50.5, 'SHEET', 1.7, GREY, 500, 0.4)
    T(x, 57.5, total_title, 3.8, INK, 500)
    T(x, 62.6, sub, 2.4, INK2, 400)
    R(69)
    T(x, 75.5, 'DRAWING INDEX', 1.7, GREY, 500, 0.4)
    y = 81.5
    for n, t in [('DD-01', 'Bench — elevation'), ('DD-02', 'Dining table — plan'), ('DD-03', 'Coffee table — plan & elevation')]:
        col = INK if n == active else GREY; w = 500 if n == active else 400
        if n == active:
            o.append(f'<rect x="{x - 3.2}" y="{y - 2.1}" width="1.1" height="2.6" fill="{ACC}"/>')
        T(x, y, n, 2.1, col, w); T(x + 13, y, t, 2.1, col, w); y += 5
    R(y - 1)
    y += 5
    T(x, y, 'NOTES', 1.7, GREY, 500, 0.4); y += 6
    for line in notes:
        for k, part in enumerate(line):
            T(x + (3.2 if k else 0), y, part if k else part, 1.95, INK2); y += 3.6
        y += 1.2
    for line in extra_notes:
        for k, part in enumerate(line):
            T(x, y, part, 1.95, ACC if k == 0 else INK2, 500 if k == 0 else 400); y += 3.6
        y += 1.2
    R(y); y += 6
    # legend
    T(x, y, 'LINE KEY', 1.7, GREY, 500, 0.4); y += 5.5
    for w, col, txt, dash in [(W_PRI, INK, 'Furniture outline', None), (W_SEC, INK2, 'Secondary / internal edge', None),
                              (W_CTX, CTX, 'Context (wall, chairs, floor)', None), (W_DIM, GREY, 'Dimension / extension line', None)]:
        o.append(f'<line x1="{x}" y1="{y - 0.7}" x2="{x + 9}" y2="{y - 0.7}" stroke="{col}" stroke-width="{w}"/>')
        T(x + 13, y, txt, 1.95, INK2); y += 4.6
    y += 2; R(y); y += 6
    T(x, y, 'MATERIAL (INDICATIVE)', 1.7, GREY, 500, 0.4); y += 4
    o.append(f'<rect x="{x}" y="{y}" width="9" height="9" fill="{FILL}"/>')
    for k in range(6):
        yy = y + 1.2 + k * 1.4 + (k % 2) * 0.3
        o.append(f'<line x1="{x}" y1="{yy:.2f}" x2="{x + 9}" y2="{yy + 0.15:.2f}" stroke="{VEIN}" stroke-width="0.12"/>')
    T(x + 13, y + 3.6, 'Travertine', 2.3, INK, 500)
    T(x + 13, y + 7.4, 'Finish & grade to be confirmed — refer reference imagery', 1.8, GREY)
    y += 15; R(y)
    # fields
    y = 236
    R(y - 5)
    fields = [('Client', '—'), ('Project no.', '—'), ('Issue', 'Design development'), ('Date', '03.11.2026'),
              ('Revision', 'P01'), ('Units', 'Metres')]
    for k, (a, b) in enumerate(fields):
        cx = x + (k % 2) * 38; cy = y + (k // 2) * 8
        T(cx, cy, a.upper(), 1.6, GREY, 500, 0.35); T(cx, cy + 3.8, b, 2.1, INK)
    R(262)
    T(x, 276, num, 9, INK, 300)
    T(404, 270.5, 'SCALE', 1.6, GREY, 500, 0.35, 'end')
    T(404, 276, scale_txt, 2.4, INK, 400, 0, 'end')
    return '\n'.join(o)


def header(num):
    return (f'<text x="16" y="21.5" font-size="1.8" fill="{GREY}" font-weight="500" letter-spacing="0.45">'
            f'BESPOKE FURNITURE  ·  DESIGN DEVELOPMENT PACKAGE</text>'
            f'<text x="312" y="21.5" font-size="1.8" fill="{GREY}" font-weight="500" letter-spacing="0.45" text-anchor="end">{num}</text>'
            f'<line x1="16" y1="25" x2="312" y2="25" stroke="{RULE}" stroke-width="0.15"/>'
            f'<line x1="16" y1="281" x2="404" y2="281" stroke="{RULE}" stroke-width="0.15"/>'
            f'<text x="16" y="286" font-size="1.6" fill="{GREY}" letter-spacing="0.3">Dimensions in metres. Written dimensions govern — do not scale. '
            f'Verify all dimensions before fabrication.</text>'
            f'<text x="404" y="286" font-size="1.6" fill="{GREY}" letter-spacing="0.3" text-anchor="end">A3 LANDSCAPE</text>')


def drawing_title(x, y, n, title, sub, scale):
    return (f'<line x1="{x}" y1="{y - 6}" x2="{x + 10}" y2="{y - 6}" stroke="{INK}" stroke-width="0.35"/>'
            f'<text x="{x}" y="{y}" font-size="2.0" fill="{ACC}" font-weight="600" letter-spacing="0.3">{n}</text>'
            f'<text x="{x + 7}" y="{y}" font-size="3.0" fill="{INK}" font-weight="500" letter-spacing="0.55">{html.escape(title)}</text>'
            f'<text x="{x + 7}" y="{y + 4.6}" font-size="2.1" fill="{GREY}">{html.escape(sub)}  ·  {scale}</text>')


def scale_bar(x, y, scale, metres, step):
    mm = 1000 / scale; o = []
    n = int(round(metres / step))
    for k in range(n):
        if k % 2 == 0:
            o.append(f'<rect x="{x + k * step * mm:.3f}" y="{y}" width="{step * mm:.3f}" height="1.1" fill="{INK}"/>')
    o.append(f'<rect x="{x}" y="{y}" width="{metres * mm:.3f}" height="1.1" fill="none" stroke="{INK}" stroke-width="0.12"/>')
    for k in range(n + 1):
        v = k * step
        if k in (0, n) or abs(v - round(v)) < 1e-6 or n <= 4:
            o.append(f'<text x="{x + v * mm:.3f}" y="{y + 4}" font-size="1.7" fill="{GREY}" text-anchor="middle">{v:g}</text>')
    o.append(f'<text x="{x + metres * mm + 2.5:.3f}" y="{y + 1.1}" font-size="1.7" fill="{GREY}">m</text>')
    return '\n'.join(o)


def image(x, y, w, src, aspect, caption):
    h = w / aspect
    return (f'<image href="{src}" x="{x}" y="{y}" width="{w}" height="{h:.3f}" preserveAspectRatio="none"/>'
            f'<text x="{x}" y="{y + h + 4.5:.3f}" font-size="1.7" fill="{ACC}" font-weight="600" letter-spacing="0.35">REFERENCE</text>'
            f'<text x="{x + 15}" y="{y + h + 4.5:.3f}" font-size="1.9" fill="{GREY}">{html.escape(caption)}</text>'), h


def sheet(body):
    return (f'<section class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297" '
            f'width="420mm" height="297mm" font-family="{FONT}">'
            f'<rect width="420" height="297" fill="{BG}"/>{body}</svg></section>')


# ================================================================ SHEET 01
def sheet1():
    d = Drawing('s1', 20, (152.2, 217.8), (38.0, 38.0))
    # context: wall elevation + floor
    d.stroke([1, 2, 3, 5, 6, 8], W_CTX, CTX)
    d.stroke([7], 0.25, INK2)                              # floor line
    # bench body
    d.fill([10, 11, 12, 13, 14, 15, 16, 17, 9], veins=1.0, seed=3)
    d.stroke([4], W_CTX, CTX)
    d.stroke([10, 11, 12, 13, 14, 15, 16, 17, 9], W_PRI)
    # dimensions (values = source labels)
    d.dim('2.25', (267.9, 501.2), (523.0, 467.2), 430.0, 'h')
    d.dim('0.60', (267.9, 501.2), (336.0, 501.2), 450.0, 'h')
    d.dim('0.75', (336.0, 501.2), (420.9, 471.2), 450.0, 'h')
    d.dim('0.90', (420.9, 471.2), (523.0, 467.2), 450.0, 'h')
    d.dim('0.30', (267.9, 501.2), (267.9, 535.2), 257.0, 'v')
    d.dim('0.30', (523.0, 467.2), (523.0, 501.2), 538.0, 'v')
    d.dim('0.60', (523.0, 467.2), (523.0, 535.2), 553.0, 'v')
    d.dim_aligned('0.50', (420.9, 471.2), (442.05, 523.85), side=-1, along=0.40, gap=2.0)
    d.dim_aligned('0.20', (434.85, 502.35), (442.05, 523.85), side=1, along=0.50, gap=2.0)
    body = [header('DD-01'), d.svg()]
    body.append(drawing_title(38, 198, '01', 'FRONT ELEVATION', 'Bench / stepped ledge with curved transition', '1:20'))
    body.append(scale_bar(45, 210, 20, 2, 0.5))
    im, h = image(160.0, 192.0, 129.5, 'ref_bench.png', 1418 / 799, 'Form and material intent')
    body.append(im)
    notes = [('Wall lines shown for context only;',), ('panel joints align with bench set-out.',),
             ('Inclined dimensions 0.50 and 0.20 are',), ('measured along the dimension lines shown.',),
             ('Edge radii as drawn.',)]
    body.append(title_block('DD-01', 'Bench', 'Front elevation', '1:20 @ A3', notes, 'DD-01'))
    return sheet('\n'.join(body))


# ================================================================ SHEET 02
def sheet2():
    d = Drawing('s2', 20, (133.2, 86.4), (44.0, 36.0))
    chairs = list(range(14, 146))
    d.fill([2, 3, 4, 5, 7, 8, 11, 12], col=FILL, veins=1.6, seed=7)
    d.stroke(chairs, W_CTX, CTX)
    d.stroke([6, 9, 10, 13], W_SEC, INK2)           # pedestal footprint
    d.stroke([174, 175, 176, 177, 178], W_SEC, INK2)  # round leg + crescent
    d.stroke([2, 3, 4, 5, 7, 8, 11, 12], W_PRI)      # table top
    d.dim('3.40', (195.1, 227.6), (591.9, 227.6), 362.0, 'h', note='*', expect=False)
    d.dim('1.20', (535.3, 148.2), (535.3, 284.3), 668.0, 'v')
    d.dim('0.40', (263.1, 193.6), (263.1, 238.9), 250.5, 'v')
    d.dim('1.25', (263.1, 238.9), (404.8, 238.9), 255.2, 'h')
    # R0.50 radial leader (top-right corner arc, centre 535.2,204.9)
    c = (535.2, 204.9); r = 56.7; a = math.radians(-30)
    CHECK.append(('s2', 'R0.50', r / PT_PER_M, True))
    C = d.T(c); P = d.T((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    d._line(C, P); d._tick(P, a)
    d.out.append(f'<circle cx="{C[0]:.3f}" cy="{C[1]:.3f}" r="0.35" fill="{INK2}"/>')
    mid = ((C[0] + P[0]) / 2, (C[1] + P[1]) / 2)
    d._text(mid[0] + 0.55, mid[1] - 0.95, 'R0.50', ang=math.degrees(a))
    body = [header('DD-02'), d.svg()]
    body.append(drawing_title(44, 186, '02', 'PLAN', 'Dining table with 12 chairs', '1:20'))
    body.append(scale_bar(51, 198, 20, 2, 0.5))
    im, h = image(181.0, 172.0, 104.0, 'ref_dining.png', 1208 / 1120, 'Form and material intent')
    body.append(im)
    notes = [('Internal outlines indicate pedestal and',), ('leg footprints below the top, as drawn.',),
             ('Leg positions and sizes not dimensioned',), ('— shown as drawn, not to be scaled.',),
             ('Chairs indicative of layout only.',)]
    extra = [('* Overall length — to be confirmed',), ('Written dimension is 3.40. The drawn outline',),
             ('(R0.50 ends, 1.20 wide) scales to 3.50.',), ('Geometry reproduced unaltered from source.',)]
    body.append(title_block('DD-02', 'Dining table', 'Plan', '1:20 @ A3', notes, 'DD-02', extra))
    return sheet('\n'.join(body))


# ================================================================ SHEET 03
def sheet3():
    plan = Drawing('s3', 10, (305.0, 726.8), (36.0, 40.0))
    plan.sheet = 's2'
    # elevation shares the plan's x-alignment (projection); shifted down only
    elev = Drawing('s2', 10, (305.0, 726.8), (36.0, 40.0 + 12.0))
    plan.fill([198, 199, 200, 201, 202, 203, 204, 205], col=FILL, veins=1.2, seed=11)
    plan.stroke([206, 207, 208, 209, 210, 211, 212, 213], W_SEC, INK2)     # edge line
    plan.stroke([303, 304, 305, 306], W_SEC, INK2)                         # inner outline
    plan.stroke([198, 199, 200, 201, 202, 203, 204, 205], W_PRI)
    plan.dim('1.30', (321.6, 811.8), (468.9, 811.8), 824.2, 'h')
    plan.dim('0.75', (468.9, 726.8), (468.9, 811.8), 479.0, 'v')

    elev.fill([241, 242, 244, 245, 247, 248, 249, 251], col=FILL, veins=1.0, seed=5)
    a, b = elev.T((344.2, 881.5)), elev.T((446.2, 890.6))       # plinth tone
    elev.out.append(f'<rect x="{a[0]:.3f}" y="{a[1]:.3f}" width="{b[0]-a[0]:.3f}" height="{b[1]-a[1]:.3f}" fill="{FILL2}"/>')
    gy = 890.6
    elev._line(elev.T((300, gy)), elev.T((500, gy)), 0.25, INK2)           # ground line
    elev.stroke([243, 301, 302], W_SEC, INK2)                              # top edge line
    elev.stroke([240, 241, 242, 244, 245, 246, 247, 248, 249, 250, 251], W_PRI)
    elev.dim('1.30', (321.6, 875.9), (468.9, 875.9), 917.0, 'h')
    elev.dim('0.90', (344.2, 890.6), (446.2, 890.6), 904.0, 'h')
    elev.dim('0.30', (468.9, 856.6), (468.9, 890.6), 492.0, 'v')
    elev.dim('0.22', (321.6, 856.6), (321.6, 881.4), 312.0, 'v')
    elev.dim('0.08', (321.6, 881.4), (321.6, 890.6), 312.0, 'v')
    body = [header('DD-03'), plan.svg(), elev.svg()]
    y_plan_t = 40 + (826 - 726.8) * plan.f + 9
    body.append(drawing_title(36, y_plan_t, '03', 'PLAN', 'Coffee table', '1:10'))
    y_el_t = 52 + (918 - 726.8) * plan.f + 9
    body.append(drawing_title(36, y_el_t, '04', 'ELEVATION', 'Coffee table — top on recessed plinth', '1:10'))
    body.append(scale_bar(43, y_el_t + 12, 10, 1, 0.25))
    im, h = image(206.0, 40.0, 102.0, 'ref_coffee.png', 896 / 873, 'Form and material intent')
    body.append(im)
    notes = [('Elevation projected directly from plan.',), ('Inner rounded outline in plan aligns with',),
             ('the 0.90 plinth in elevation (not separately',), ('dimensioned). Edge line and corner radii',),
             ('as drawn.',)]
    body.append(title_block('DD-03', 'Coffee table', 'Plan & elevation', '1:10 @ A3', notes, 'DD-03'))
    return sheet('\n'.join(body))


CSS = f"""
@page {{ size: 420mm 297mm; margin: 0; }}
html, body {{ margin: 0; padding: 0; background: {BG}; }}
.sheet {{ width: 420mm; height: 297mm; page-break-after: always; break-after: page; overflow: hidden; }}
.sheet:last-child {{ page-break-after: auto; break-after: auto; }}
svg {{ display: block; font-feature-settings: 'tnum' 1, 'lnum' 1; text-rendering: geometricPrecision; }}
"""

if __name__ == '__main__':
    sheets = [sheet1(), sheet2(), sheet3()]
    doc = f'<!doctype html><html><head><meta charset="utf-8"><title>Furniture DD Package</title><style>{CSS}</style></head><body>{"".join(sheets)}</body></html>'
    open(os.path.join(HERE, 'package.html'), 'w').write(doc)
    bad = 0
    for s, label, m, exp in CHECK:
        val = float(label.strip('R'))
        ok = abs(m - val) < 0.006
        flag = 'OK ' if ok else ('FLAG' if not exp else 'FAIL')
        if not ok and exp: bad += 1
        print(f'{flag} {s} {label:>6}  geometry {m:.4f} m')
    print('failures:', bad)
