"""Minimal, explicit print-PDF writer (pikepdf).
- Vector paths only (no raster), fills only, nonzero winding.
- Colour spaces: DeviceCMYK and Separation spot colours (e.g. FOIL_GOLD) with a CMYK alternate for on-screen display.
- Named layers as PDF Optional Content Groups.
- MediaBox / BleedBox / TrimBox; crop marks in Registration (/All) colour.
"""
import pikepdf, numpy as np
from pikepdf import Name, Dictionary, Array, Stream
from svgelements import Path, Move, Line, CubicBezier, QuadraticBezier, Close, Arc, Matrix
MM=72/25.4
def _fmt(v): return ('%.4f'%v).rstrip('0').rstrip('.') if abs(v)>1e-9 else '0'
def path_ops(d, m):
    """d in artwork units; m maps artwork units -> PDF points (already y-flipped)."""
    p=Path(d); p*=m; out=[]
    for seg in p.segments():
        if isinstance(seg,Move): out.append('%s %s m'%(_fmt(seg.end.x),_fmt(seg.end.y)))
        elif isinstance(seg,Line): out.append('%s %s l'%(_fmt(seg.end.x),_fmt(seg.end.y)))
        elif isinstance(seg,CubicBezier): out.append(' '.join(_fmt(v) for v in (seg.control1.x,seg.control1.y,seg.control2.x,seg.control2.y,seg.end.x,seg.end.y))+' c')
        elif isinstance(seg,QuadraticBezier):
            s,c,e=seg.start,seg.control,seg.end
            c1=(s.x+2/3*(c.x-s.x),s.y+2/3*(c.y-s.y)); c2=(e.x+2/3*(c.x-e.x),e.y+2/3*(c.y-e.y))
            out.append(' '.join(_fmt(v) for v in (*c1,*c2,e.x,e.y))+' c')
        elif isinstance(seg,Close): out.append('h')
        elif isinstance(seg,Arc):
            for cb in seg.as_cubic_curves():
                out.append(' '.join(_fmt(v) for v in (cb.control1.x,cb.control1.y,cb.control2.x,cb.control2.y,cb.end.x,cb.end.y))+' c')
        else: raise ValueError(type(seg))
    return '\n'.join(out)

class Page:
    def __init__(self, trim_w, trim_h, bleed=0.0, slug=12.0, marks=True):
        self.tw,self.th,self.bl,self.sl=trim_w,trim_h,bleed,slug
        self.W=trim_w+2*(bleed+slug); self.H=trim_h+2*(bleed+slug)
        self.items=[]   # (layer, kind, payload)
        self.marks=marks
    def to_pdf(self):
        """artwork mm coords (origin = trim top-left, y down) -> PDF pt"""
        o=self.bl+self.sl
        return Matrix(MM,0,0,-MM,o*MM,(self.H-o)*MM)
    def fill(self, layer, d, color, overprint=False, m=None):
        """color: ('cmyk',(c,m,y,k) 0-1) | ('spot',name,tint) """
        self.items.append((layer,d,color,overprint,m))

class Doc:
    def __init__(self, title, spots):
        """spots: {name: (c,m,y,k)} alternate CMYK used only for on-screen display/proofing."""
        self.title=title; self.spots=spots; self.pages=[]; self.layer_order=[]
    def page(self,*a,**k):
        p=Page(*a,**k); self.pages.append(p); return p
    def save(self, fn, notes=''):
        pdf=pikepdf.new()
        pdf.docinfo['/Title']=self.title
        pdf.docinfo['/Creator']='Youssef & Maii print package - vector production build'
        pdf.docinfo['/Subject']=notes[:900]
        # colour spaces
        cs={}
        def sep(name,alt):
            fn=Dictionary(FunctionType=2,Domain=[0,1],C0=[0,0,0,0],C1=list(alt),N=1)
            return Array([Name.Separation,Name('/'+name),Name.DeviceCMYK,pdf.make_indirect(fn)])
        used={it[2][1] for p in self.pages for it in p.items if it[2][0]=='spot'}
        for i,(n,alt) in enumerate(self.spots.items()):
            if n in used: cs[n]=('CS%d'%i,pdf.make_indirect(sep(n,alt)))
        if any(p.marks for p in self.pages): cs['All']=('CSR',pdf.make_indirect(sep('All',(1,1,1,1))))
        # layers
        layers=[]
        for p in self.pages:
            for it in p.items:
                if it[0] not in layers: layers.append(it[0])
            if p.marks and 'CROP MARKS (outside trim - non-artwork)' not in layers: layers.append('CROP MARKS (outside trim - non-artwork)')
        ocg={L:pdf.make_indirect(Dictionary(Type=Name.OCG,Name=pikepdf.String(L))) for L in layers}
        pdf.Root.OCProperties=Dictionary(OCGs=Array(list(ocg.values())),D=Dictionary(Order=Array(list(ocg.values())),ON=Array(list(ocg.values())),Name=pikepdf.String('Default')))
        gs_op=pdf.make_indirect(Dictionary(Type=Name.ExtGState,OP=True,op=True,OPM=1))
        gs_ko=pdf.make_indirect(Dictionary(Type=Name.ExtGState,OP=False,op=False))
        for p in self.pages:
            ops=[]; M=p.to_pdf()
            byl={}
            for it in p.items: byl.setdefault(it[0],[]).append(it)
            for li,L in enumerate(layers):
                content=[]
                for (_,d,col,op,m) in byl.get(L,[]):
                    mm=Matrix(m)*M if m is not None else M
                    content.append('/%s gs'%('GSop' if op else 'GSko'))
                    if col[0]=='cmyk': content.append('%s %s %s %s k'%tuple(_fmt(v) for v in col[1]))
                    else: content.append('/%s cs %s scn'%(cs[col[1]][0],_fmt(col[2])))
                    content.append(path_ops(d,mm)); content.append('f')
                if L.startswith('CROP MARKS') and p.marks:
                    content.append(self._marks(p,cs))
                if content:
                    ops.append('/OC /OC%d BDC q'%li); ops+=content; ops.append('Q EMC')
            stream=pdf.make_stream('\n'.join(ops).encode())
            res=Dictionary(ColorSpace=Dictionary({'/'+v[0]:v[1] for v in cs.values()}),
                           ExtGState=Dictionary(GSop=gs_op,GSko=gs_ko),
                           Properties=Dictionary({'/OC%d'%i:ocg[L] for i,L in enumerate(layers)}))
            W,H=float(p.W*MM),float(p.H*MM); o=float(p.sl*MM); t=float((p.sl+p.bl)*MM)
            pg=pikepdf.Page(Dictionary(Type=Name.Page,MediaBox=[0,0,W,H],
                BleedBox=[o,o,W-o,H-o],TrimBox=[t,t,W-t,H-t],CropBox=[0,0,W,H],
                Contents=stream,Resources=res))
            pdf.pages.append(pg)
        pdf.save(fn)
    def _marks(self,p,cs):
        """Crop marks: 0.25pt Registration lines, offset outside bleed."""
        o=p.sl+p.bl; W,H=p.W,p.H; L=[]
        off=p.bl+2.0; ln=min(8.0,p.sl-1.0)
        L.append('/%s CS 1 SCN 0.25 w /GSko gs'%cs['All'][0])
        for x in (o,o+p.tw):
            for y,dirn in ((o,-1),(o+p.th,1)):
                # vertical tick
                y0=y+dirn*off; y1=y+dirn*(off+ln)
                L.append('%s %s m %s %s l S'%(_fmt(x*MM),_fmt((H-y0)*MM),_fmt(x*MM),_fmt((H-y1)*MM)))
        for y in (o,o+p.th):
            for x,dirn in ((o,-1),(o+p.tw,1)):
                x0=x+dirn*off; x1=x+dirn*(off+ln)
                L.append('%s %s m %s %s l S'%(_fmt(x0*MM),_fmt((H-y*1)*MM),_fmt(x1*MM),_fmt((H-y)*MM)))
        return '\n'.join(L)
