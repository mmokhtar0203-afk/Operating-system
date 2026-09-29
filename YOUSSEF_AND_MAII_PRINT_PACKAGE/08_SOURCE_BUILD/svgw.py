"""Layered SVG writer. Paths are baked into mm coordinates (no nested transforms)."""
from svgelements import Path, Move, Line, CubicBezier, QuadraticBezier, Close, Arc, Matrix
def f(v): 
    s='%.3f'%v; s=s.rstrip('0').rstrip('.'); return '0' if s in('-0','') else s
def dstr(d, m=None):
    p=Path(d)
    if m is not None: p*=m
    o=[]
    for s in p.segments():
        if isinstance(s,Move): o.append('M%s %s'%(f(s.end.x),f(s.end.y)))
        elif isinstance(s,Line): o.append('L%s %s'%(f(s.end.x),f(s.end.y)))
        elif isinstance(s,CubicBezier): o.append('C%s %s %s %s %s %s'%tuple(f(v) for v in (s.control1.x,s.control1.y,s.control2.x,s.control2.y,s.end.x,s.end.y)))
        elif isinstance(s,QuadraticBezier): o.append('Q%s %s %s %s'%tuple(f(v) for v in (s.control.x,s.control.y,s.end.x,s.end.y)))
        elif isinstance(s,Close): o.append('Z')
        elif isinstance(s,Arc):
            for c in s.as_cubic_curves(): o.append('C%s %s %s %s %s %s'%tuple(f(v) for v in (c.control1.x,c.control1.y,c.control2.x,c.control2.y,c.end.x,c.end.y)))
    return ''.join(o)
class SVG:
    def __init__(self, w, h, title, desc=''):
        self.w,self.h,self.title,self.desc=w,h,title,desc; self.layers=[]
    def layer(self, label, lid, visible=True, locked=False, printing=True):
        L={'label':label,'id':lid,'vis':visible,'lock':locked,'items':[]}; self.layers.append(L); return L
    def path(self, L, d, fill, pid=None, m=None, extra=''):
        L['items'].append('<path%s d="%s" fill="%s" fill-rule="nonzero"%s/>'%(f' id="{pid}"' if pid else '',dstr(d,m),fill,extra))
    def raw(self, L, s): L['items'].append(s)
    def save(self, fn):
        o=['<?xml version="1.0" encoding="UTF-8"?>',
           f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="{f(self.w)}mm" height="{f(self.h)}mm" viewBox="0 0 {f(self.w)} {f(self.h)}">',
           f'<title>{self.title}</title>', f'<desc>{self.desc}</desc>']
        for L in self.layers:
            st='' if L['vis'] else ' style="display:none"'
            lk=' sodipodi:insensitive="true"' if L['lock'] else ''
            o.append(f'<g id="{L["id"]}" inkscape:groupmode="layer" inkscape:label="{L["label"]}"{st}{lk}>')
            o+=L['items']; o.append('</g>')
        o.append('</svg>')
        open(fn,'w').write('\n'.join(o))
