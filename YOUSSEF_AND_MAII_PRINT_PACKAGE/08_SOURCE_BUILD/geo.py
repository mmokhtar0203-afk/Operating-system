import os
"""Geometry of every production composition, reconstructed from the reference images.
All component path data is traced/constructed; this module only positions them (similarity transforms: uniform scale, rotation, translation - no distortion)."""
import json, numpy as np, os
from svgelements import Path, Matrix
B=os.path.join(os.path.dirname(os.path.abspath(__file__)),'components')
def D(name): return open(os.path.join(B,f'c_{name}.d')).read()
def xf(d, m):
    p=Path(d); p*=m; return p.d()
def sim(s,th_deg,tx,ty):
    # x' = s R x + t  (svgelements Matrix: a b c d e f)
    th=np.radians(th_deg); c,sn=np.cos(th)*s,np.sin(th)*s
    return Matrix(c,sn,-sn,c,tx,ty)
def bbox(ds):
    bs=[Path(d).bbox() for d in ds if d]; bs=[b for b in bs if b]
    return (min(b[0] for b in bs),min(b[1] for b in bs),max(b[2] for b in bs),max(b[3] for b in bs))

# ---------- reference-derived constants (see QC report) ----------
ARC_CIRCLE=(639.466,640.279,409.888)      # image-3 px: fitted circle of the thin arc
ARC_STROKE=4.6                              # image-3 px
TAMB_FACE=(651.199,593.922,469.473)        # tambourine printable face mapped into image-3 px
CARD=(68,164,958,1359)                      # invitation card edges in image-4 px
# crest registration in image-4 px (similarity, fitted by template matching + NCC refinement)
_reg=json.load(open(os.path.join(B,'reg4.json')))

def logo_parts():
    """Circular logo (reference image 3) - native image-3 px."""
    return {'mono':D('mono'),'botanical':D('botfull'),'text':D('text'),'arc':D('arc')}

def tambourine_parts():
    """Tambourine face (reference image 2): same artwork as circular logo without the thin arc."""
    return {'mono':D('mono'),'botanical':D('bot'),'text':D('text')}

def crest_parts():
    """Crest used on cups + invitation (references 1 & 4), in image-4 px.
    Global tilt of the rendered monogram (+0.68deg, a rendering artefact) is removed about the crest centre."""
    rm=_reg['mono']; tilt=np.degrees(rm[1])
    mono_m=sim(rm[0],np.degrees(rm[1]),rm[2],rm[3])
    right_m=sim(*[_reg['right'][0],np.degrees(_reg['right'][1]),_reg['right'][2],_reg['right'][3]])
    left_m=sim(*[_reg['left'][0],np.degrees(_reg['left'][1]),_reg['left'][2],_reg['left'][3]])
    parts={'mono':xf(D('mono'),mono_m),'sprig_right':xf(D('bot'),right_m),'sprig_left':xf(D('bot'),left_m)}
    x0,y0,x1,y1=bbox(parts.values()); cx,cy=(x0+x1)/2,(y0+y1)/2
    un=Matrix(f'rotate({-tilt} {cx} {cy})')
    return {k:xf(v,un) for k,v in parts.items()}

def invitation_parts():
    from textout import outline
    p=crest_parts()
    p['vine_left']=D('vineL'); p['vine_right']=D('vineR')
    card_cx=(CARD[0]+CARD[2])/2
    def line(txt,size,tr,top):
        d,_=outline(txt,size,tr,0,0); x0,y0,x1,y1=Path(d).bbox()
        return xf(d,Matrix.translate(card_cx-(x0+x1)/2, top-y0))
    # sizes/tracking fitted to the reference's "Youssef & Mai" line, then set with the CORRECT spelling
    p['title']=line('Youssef & Maii',72.67,0.04,535)
    p['date']=line('8th of October, 2026',39.64,0.0275,617)
    return p
BUTTERFLY_ZONE=(345,770,690,1065)   # image-4 px, physical 3-D element placement (non-printing)
