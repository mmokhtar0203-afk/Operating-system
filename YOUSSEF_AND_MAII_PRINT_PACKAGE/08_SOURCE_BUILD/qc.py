import os, sys, json, numpy as np, cv2, cairosvg, io, subprocess
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import geo
from geo import xf, bbox
from svgelements import Matrix
from svgw import dstr
from PIL import Image
from skimage.morphology import skeletonize
PX=40  # px per mm
def raster(art, w, h):
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="#fff"/>'+''.join(f'<path d="{dstr(d)}" fill="#000"/>' for d in art.values())+'</svg>'
    png=cairosvg.svg2png(bytestring=svg.encode(),output_width=int(w*PX))
    return np.asarray(Image.open(io.BytesIO(png)).convert('L'))<128
def widths(ink):
    dt=cv2.distanceTransform(ink.astype(np.uint8),cv2.DIST_L2,5)
    sk=skeletonize(ink)
    v=2*dt[sk]/PX
    v=v[v>0]
    return v
def gaps(ink):
    # background gaps that lie between artwork (inside the artwork's closed hull region)
    bg=~ink
    k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(int(1.2*PX)|1,int(1.2*PX)|1))
    region=cv2.morphologyEx(ink.astype(np.uint8),cv2.MORPH_CLOSE,k)>0
    inner=bg&region
    dt=cv2.distanceTransform(bg.astype(np.uint8),cv2.DIST_L2,5)
    sk=skeletonize(inner)
    v=2*dt[sk]/PX; return v[v>0]
def metrics(name, art, w, h):
    ink=raster(art,w,h)
    W=widths(ink); G=gaps(ink)
    return {'item':name,'min_line_mm_p1':round(float(np.percentile(W,1)),3),'min_line_mm_p5':round(float(np.percentile(W,5)),3),
            'typical_fine_line_mm_median_of_lines_below_1mm':round(float(np.median(W[W<1.0])) if (W<1.0).any() else 0,3),
            'min_gap_mm_p1':round(float(np.percentile(G,1)),3),'min_gap_mm_p5':round(float(np.percentile(G,5)),3)}
if __name__=='__main__':
    import build_all as B
    res={}
    logo=B.build_logo()
    for k,(art,w,h,_) in logo.items(): res['logo_'+k]=metrics('Logo '+k,art,w,h)
    tamb=B.build_tambourine(); R=B.TAMB_D/2
    res['tambourine']=metrics('Tambourine face Ø150 (assumed)',tamb,B.TAMB_D,B.TAMB_D)
    ink=raster(tamb,B.TAMB_D,B.TAMB_D); ys,xs=np.nonzero(ink); r=np.hypot(xs/PX-R,ys/PX-R)
    res['tambourine']['min_clearance_to_face_edge_mm']=round(float(R-r.max()),2)
    # clearance per element
    for nm,d in tamb.items():
        ink=raster({nm:d},B.TAMB_D,B.TAMB_D); ys,xs=np.nonzero(ink); r=np.hypot(xs/PX-R,ys/PX-R)
        res['tambourine']['clearance_'+nm+'_mm']=round(float(R-r.max()),2)
    art,TW,TH,bz=B.build_invitation()
    res['invitation']=metrics('Invitation',art,TW,TH)
    for nm,d in art.items():
        x0,y0,x1,y1=bbox([d]); res['invitation']['clear_'+nm]=[round(float(v),2) for v in (x0,y0,TW-x1,TH-y1)]
    for nm in ['mono','sprig_left','sprig_right','vine_left','vine_right','title','date']:
        res['invitation_'+nm]=metrics('Invitation '+nm,{nm:art[nm]},TW,TH)
    cart,W,H,meta=B.build_cup()
    res['cup']=metrics('Cup crest 48 mm',cart,W,H)
    res['cup_meta']={k:float(v) for k,v in meta.items()}
    json.dump(res,open(os.path.join(B.PKG,'qc.json'),'w'),indent=1)
    print(json.dumps(res,indent=1))
