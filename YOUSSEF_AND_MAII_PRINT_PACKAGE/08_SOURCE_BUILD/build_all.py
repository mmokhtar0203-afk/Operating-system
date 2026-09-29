import os, sys, json, subprocess, numpy as np, cairosvg
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import geo
from geo import D, xf, bbox
from svgelements import Matrix, Path
from pdfw import Doc
from svgw import SVG, dstr
from textout import outline
from arc import arc_path
PKG=os.environ.get('PKG',os.path.join(os.path.dirname(os.path.abspath(__file__)),'output'))
FONT_LBL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'fonts','EBGaramond-Regular.ttf')
GOLD_CMYK=(0.32,0.52,0.83,0.13); GOLD_HEX='#A37A4E'
CREAM_CMYK=(0.05,0.08,0.11,0.0); CREAM_HEX='#EFE6DF'
SPOTS={'FOIL_GOLD':GOLD_CMYK,'DIELINE_TBC':(0,1,0,0)}
L_FOIL='FOIL_GOLD - SPOT COLOR (metallic foil, 100% solid)'
L_SIM='CMYK GOLD SIMULATION (4-colour print, not foil)'
L_BG='CMYK PRINT - BACKGROUND'
L_REF='REFERENCE OUTLINE - ASSUMED SIZE, TBC WITH SUPPLIER (non-printing)'
TBC='FINAL DIELINE, PRINTABLE AREA, SCALE, BLEED AND SAFE AREA MUST BE CONFIRMED AGAINST THE MANUFACTURER\'S TEMPLATE BEFORE PRODUCTION.'
def od(*p):
    d=os.path.join(PKG,*p); os.makedirs(d,exist_ok=True); return d
def M(k,tx,ty): return Matrix(k,0,0,k,tx,ty)
def circle(cx,cy,r,rev=False):
    k=0.5522847498*r
    if not rev:  # clockwise in y-down space
        return (f'M{cx+r:.4f} {cy:.4f} C{cx+r:.4f} {cy+k:.4f} {cx+k:.4f} {cy+r:.4f} {cx:.4f} {cy+r:.4f} '
                f'C{cx-k:.4f} {cy+r:.4f} {cx-r:.4f} {cy+k:.4f} {cx-r:.4f} {cy:.4f} '
                f'C{cx-r:.4f} {cy-k:.4f} {cx-k:.4f} {cy-r:.4f} {cx:.4f} {cy-r:.4f} '
                f'C{cx+k:.4f} {cy-r:.4f} {cx+r:.4f} {cy-k:.4f} {cx+r:.4f} {cy:.4f} Z')
    return (f'M{cx+r:.4f} {cy:.4f} C{cx+r:.4f} {cy-k:.4f} {cx+k:.4f} {cy-r:.4f} {cx:.4f} {cy-r:.4f} '
            f'C{cx-k:.4f} {cy-r:.4f} {cx-r:.4f} {cy-k:.4f} {cx-r:.4f} {cy:.4f} '
            f'C{cx-r:.4f} {cy+k:.4f} {cx-k:.4f} {cy+r:.4f} {cx:.4f} {cy+r:.4f} '
            f'C{cx+k:.4f} {cy+r:.4f} {cx+r:.4f} {cy+k:.4f} {cx+r:.4f} {cy:.4f} Z')
def annulus(cx,cy,r,w): return circle(cx,cy,r+w/2)+' '+circle(cx,cy,r-w/2,True)
def disc(cx,cy,r): return circle(cx,cy,r)
def rect(x,y,w,h): return f'M{x} {y} L{x+w} {y} L{x+w} {y+h} L{x} {y+h} Z'
def label(txt,size,x,y,anchor='l'):
    d,w=outline(txt,size,0.0,0,0,font=FONT_LBL)
    dx={'l':0,'c':-w/2,'r':-w}[anchor]
    return xf(d,Matrix.translate(x+dx,y))
def render_png(svgfile,png,width,bg=None):
    cairosvg.svg2png(url=svgfile,write_to=png,output_width=width,background_color=bg)

# ----------------------------------------------------------------------------------
def placed(parts, k, tx, ty):
    """parts in source px -> mm dict"""
    m=M(k,tx,ty); return {n:xf(d,m) for n,d in parts.items()}

def write_art(basename, folder, w, h, art, bleed=0.0, marks=False, bg=None, guides=None, title='', desc='', svg=True, pdf_cmyk=True, pdf_foil=True, foil_only_page=True, refline=None, svg_name=None, cmyk_name=None, foil_name=None):
    """art: dict name->d (mm, origin=trim top-left). bg: d for CMYK background (mm) or None."""
    out={}
    notes=f'{title}. FOIL_GOLD is a SPOT/special colour for metallic foil - its CMYK alternate is for screen display only. Text is outlined. {TBC}'
    if pdf_cmyk:
        doc=Doc(title+' - CMYK version',{})
        p=doc.page(w,h,bleed=bleed,slug=12 if marks else 0,marks=marks)
        if bg: p.fill(L_BG,bg,('cmyk',CREAM_CMYK))
        for n,d in art.items(): p.fill(L_SIM,d,('cmyk',GOLD_CMYK))
        fn=os.path.join(folder,cmyk_name or f'{basename}_CMYK.pdf'); doc.save(fn,notes); out['cmyk']=fn
    if pdf_foil:
        doc=Doc(title+' - FOIL_GOLD production',SPOTS)
        p=doc.page(w,h,bleed=bleed,slug=12 if marks else 0,marks=marks)
        if bg: p.fill(L_BG,bg,('cmyk',CREAM_CMYK))
        for n,d in art.items(): p.fill(L_FOIL,d,('spot','FOIL_GOLD',1.0),overprint=True)
        if refline: p.fill(L_REF,refline,('spot','DIELINE_TBC',1.0),overprint=True)
        if foil_only_page:
            p2=doc.page(w,h,bleed=bleed,slug=12 if marks else 0,marks=marks)
            for n,d in art.items(): p2.fill(L_FOIL+' [foil-die page]',d,('spot','FOIL_GOLD',1.0),overprint=True)
        fn=os.path.join(folder,foil_name or f'{basename}_FOIL_GOLD.pdf'); doc.save(fn,notes+' Page 1 = combined (CMYK background + foil). Page 2 = foil elements only, for foil-die making.'); out['foil']=fn
    if svg:
        W,H=w+2*bleed,h+2*bleed; o=Matrix.translate(bleed,bleed)
        s=SVG(W,H,title,desc+' | FOIL_GOLD layer = spot colour for metallic foil (display colour '+GOLD_HEX+'). '+TBC)
        if guides:
            g=s.layer('GUIDES - NON-PRINTING','guides',locked=True)
            for gg in guides: s.raw(g,gg.replace('$O',f'translate({bleed} {bleed})'))
        if bg:
            L=s.layer(L_BG,'cmyk_background'); s.path(L,bg,CREAM_HEX,'background',m=o)
        L=s.layer(L_FOIL,'FOIL_GOLD')
        for n,d in art.items():
            s.raw(L,f'<g id="{n}" inkscape:label="{n}">'); s.path(L,d,GOLD_HEX,None,m=o); s.raw(L,'</g>')
        fn=os.path.join(folder,svg_name or f'{basename}_Master.svg'); s.save(fn); out['svg']=fn
    return out

def preview_svg(fn, w, h, art, bg_color=CREAM_HEX, bgpath=None, pad=0.0):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {w+2*pad} {h+2*pad}">'
    if bg_color and not bgpath: s+=f'<rect x="{-pad}" y="{-pad}" width="{w+2*pad}" height="{h+2*pad}" fill="{bg_color}"/>'
    if bgpath: s+=bgpath
    s+=''.join(f'<path d="{dstr(d)}" fill="{GOLD_HEX}"/>' for d in art.values())+'</svg>'
    open(fn,'w').write(s)

# ============================ 05 LOGO =============================================
def build_logo():
    f=od('05_LOGO'); res={}
    lp=geo.logo_parts(); x0,y0,x1,y1=bbox(lp.values()); W=100.0; k=W/(x1-x0); mg=5
    full=placed(lp,k,mg-x0*k,mg-y0*k); fw,fh=W+2*mg,(y1-y0)*k+2*mg
    res['full']=(full,fw,fh,k)
    write_art('Logo_Full',f,fw,fh,full,title='Youssef & Maii - Full circular logo',desc='Monogram + botanical + thin arc + curved text YOUSSEF & MAII • 08-10-2026. Master scale: 100 mm artwork width (scalable).',svg_name='Logo_Full.svg',cmyk_name='Logo_Full.pdf',foil_name='Logo_Full_FOIL_GOLD.pdf',foil_only_page=False)
    mono={'monogram':lp['mono']}; x0,y0,x1,y1=bbox(mono.values()); W=50.0; k=W/(x1-x0)
    mono=placed(mono,k,mg-x0*k,mg-y0*k); mw,mh=W+2*mg,(y1-y0)*k+2*mg; res['mono']=(mono,mw,mh,k)
    write_art('Logo_Monogram',f,mw,mh,mono,title='Youssef & Maii - Monogram only',desc='Intertwined M/Y monogram. Master scale: 50 mm width (scalable).',svg_name='Logo_Monogram.svg',cmyk_name='Logo_Monogram.pdf',foil_name='Logo_Monogram_FOIL_GOLD.pdf',foil_only_page=False)
    cp=geo.crest_parts(); x0,y0,x1,y1=bbox(cp.values()); W=80.0; k=W/(x1-x0)
    crest=placed(cp,k,mg-x0*k,mg-y0*k); cw,ch=W+2*mg,(y1-y0)*k+2*mg; res['crest']=(crest,cw,ch,k)
    write_art('Logo_Crest',f,cw,ch,crest,title='Youssef & Maii - Monogram with botanical sprigs (crest)',desc='Monogram flanked by botanical sprigs, as on cups and invitation. Master scale: 80 mm width (scalable).',svg_name='Logo_Crest_Botanical.svg',cmyk_name='Logo_Crest_Botanical.pdf',foil_name='Logo_Crest_Botanical_FOIL_GOLD.pdf',foil_only_page=False)
    # previews + transparent PNGs
    for key,nm in [('full','Logo_Full'),('mono','Logo_Monogram'),('crest','Logo_Crest_Botanical')]:
        art,w,h,_=res[key]
        preview_svg(os.path.join(PKG,'_tmp_preview.svg'),w,h,art,bg_color=None)
        render_png(os.path.join(PKG,'_tmp_preview.svg'),os.path.join(f,f'{nm}_transparent.png'),3000)
    # combined preview sheet
    fa,fw_,fh_,_=res['full']; ma,mw_,mh_,_=res['mono']; ca,cw_,ch_,_=res['crest']
    sheet={}
    for n,d in fa.items(): sheet['f'+n]=d
    for n,d in ma.items(): sheet['m'+n]=xf(d,Matrix.translate(fw_+5,(fh_-mh_)/2-18))
    for n,d in ca.items(): sheet['c'+n]=xf(d,Matrix.translate(fw_-8,fh_-ch_+4))
    W=fw_+cw_; H=fh_+6
    # simple 3-up preview
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fw_+mw_+cw_+20} {max(fh_,ch_)+20}"><rect width="100%" height="100%" fill="{CREAM_HEX}"/>'
    for (art,w,h,_),ox in [(res['full'],10),(res['mono'],fw_+10),(res['crest'],fw_+mw_+10)]:
        oy=10+(max(fh_,ch_)-h)/2
        s+=''.join(f'<path d="{dstr(d,Matrix.translate(ox,oy))}" fill="{GOLD_HEX}"/>' for d in art.values())
    s+='</svg>'; open(os.path.join(PKG,'_tmp_preview.svg'),'w').write(s)
    render_png(os.path.join(PKG,'_tmp_preview.svg'),os.path.join(f,'Logo_Preview.png'),3000)
    return res

# ============================ 03 TAMBOURINE =======================================
TAMB_D=150.0; TAMB_BLEED=3.0; TAMB_SAFE=5.0
def build_tambourine():
    f=od('03_TAMBOURINE')
    fx,fy,fr=geo.TAMB_FACE; R=TAMB_D/2; k=R/fr
    art=placed(geo.tambourine_parts(),k,R-fx*k,R-fy*k)
    face_ref=annulus(R,R,R,0.25)
    bg=disc(R,R,R+TAMB_BLEED)
    guides=[f'<g transform="$O" fill="none" stroke-width="0.25">'
            f'<circle cx="{R}" cy="{R}" r="{R}" stroke="#E6007E"/>'
            f'<circle cx="{R}" cy="{R}" r="{R+TAMB_BLEED}" stroke="#00A0E6" stroke-dasharray="2 1"/>'
            f'<circle cx="{R}" cy="{R}" r="{R-TAMB_SAFE}" stroke="#00B050" stroke-dasharray="1 1"/>'
            f'<circle cx="{R}" cy="{R}" r="{R+4}" stroke="#999" stroke-width="6" opacity="0.25"/>'
            '</g>']
    write_art('Tambourine',f,TAMB_D,TAMB_D,art,bleed=TAMB_BLEED,marks=True,bg=None,guides=guides,refline=face_ref,
        title='Youssef & Maii - Tambourine face (ASSUMED printable face diameter 150 mm - TBC)',
        desc='Magenta = assumed printable face Ø150 mm (TBC); blue dashed = 3 mm bleed; green dotted = 5 mm recommended safe area; grey band = physical metal hoop shown in reference (not printed).')
    # CMYK version with optional cream background disc
    doc=Doc('Youssef & Maii - Tambourine - CMYK version',{'DIELINE_TBC':(0,1,0,0)})
    p=doc.page(TAMB_D,TAMB_D,bleed=TAMB_BLEED,slug=12,marks=True)
    p.fill('CMYK PRINT - OPTIONAL CREAM BACKGROUND (omit if the head is already cream)',bg,('cmyk',CREAM_CMYK))
    for d in art.values(): p.fill(L_SIM,d,('cmyk',GOLD_CMYK))
    p.fill(L_REF,face_ref,('spot','DIELINE_TBC',1.0),overprint=True)
    doc.save(os.path.join(f,'Tambourine_CMYK.pdf'),'CMYK 4-colour fallback. '+TBC)
    # OPTIONAL alternative: identical artwork, uniformly scaled about the face centre so every element sits inside the 5 mm safe area
    fa=os.path.join(f,'ALTERNATIVE_uniformly_scaled_to_safe_area'); os.makedirs(fa,exist_ok=True)
    import qc
    ink=qc.raster(art,TAMB_D,TAMB_D); ys,xs=np.nonzero(ink); rmax=float(np.hypot(xs/qc.PX-R,ys/qc.PX-R).max())
    sc=(R-TAMB_SAFE)/rmax
    alt={n:xf(d,Matrix(f'translate({R} {R}) scale({sc}) translate({-R} {-R})')) for n,d in art.items()}
    pct=int(np.floor(sc*1000))/10
    write_art('Tambourine_ALT_%g_percent'%pct,fa,TAMB_D,TAMB_D,alt,bleed=TAMB_BLEED,marks=True,guides=guides,refline=face_ref,
        title='Youssef & Maii - Tambourine face - OPTIONAL ALTERNATIVE: same artwork uniformly scaled to %g%% so all elements sit inside the 5 mm safe area (no distortion, no redesign)'%pct,
        desc='Optional. Use only if the supplier requires the 5 mm safe area. Primary files in the parent folder reproduce the reference composition at 100%.')
    doc=Doc('Tambourine ALT - CMYK version',{'DIELINE_TBC':(0,1,0,0)})
    p=doc.page(TAMB_D,TAMB_D,bleed=TAMB_BLEED,slug=12,marks=True)
    p.fill('CMYK PRINT - OPTIONAL CREAM BACKGROUND (omit if the head is already cream)',bg,('cmyk',CREAM_CMYK))
    for d in alt.values(): p.fill(L_SIM,d,('cmyk',GOLD_CMYK))
    p.fill(L_REF,face_ref,('spot','DIELINE_TBC',1.0),overprint=True)
    doc.save(os.path.join(fa,'Tambourine_ALT_%g_percent_CMYK.pdf'%pct),'CMYK 4-colour fallback. '+TBC)
    global TAMB_ALT_PCT; TAMB_ALT_PCT=pct
    preview_svg(os.path.join(PKG,'_tmp_preview.svg'),TAMB_D,TAMB_D,art,bg_color=None,bgpath=f'<circle cx="{R}" cy="{R}" r="{R+6}" fill="#C9A461"/><circle cx="{R}" cy="{R}" r="{R}" fill="{CREAM_HEX}"/>',pad=8)
    render_png(os.path.join(PKG,'_tmp_preview.svg'),os.path.join(f,'Tambourine_Preview.png'),2400,bg='#FFFFFF')
    return art

# ============================ 04 INVITATION =======================================
INV_BLEED=3.0; INV_SAFE=5.0
def build_invitation():
    f=od('04_INVITATION')
    x0,y0,x1,y1=geo.CARD; TW=127.0; k=TW/(x1-x0); TH=round((y1-y0)*k,2)
    parts=geo.invitation_parts()
    art=placed(parts,k,-x0*k,-y0*k)
    bg=rect(-INV_BLEED,-INV_BLEED,TW+2*INV_BLEED,TH+2*INV_BLEED)
    bx0,by0,bx1,by1=geo.BUTTERFLY_ZONE
    bz=((bx0-x0)*k,(by0-y0)*k,(bx1-bx0)*k,(by1-by0)*k)
    guides=[f'<g transform="$O" fill="none" stroke-width="0.25">'
            f'<rect x="0" y="0" width="{TW}" height="{TH}" stroke="#E6007E"/>'
            f'<rect x="{-INV_BLEED}" y="{-INV_BLEED}" width="{TW+2*INV_BLEED}" height="{TH+2*INV_BLEED}" stroke="#00A0E6" stroke-dasharray="2 1"/>'
            f'<rect x="{INV_SAFE}" y="{INV_SAFE}" width="{TW-2*INV_SAFE}" height="{TH-2*INV_SAFE}" stroke="#00B050" stroke-dasharray="1 1"/>'
            f'<ellipse cx="{bz[0]+bz[2]/2}" cy="{bz[1]+bz[3]/2}" rx="{bz[2]/2}" ry="{bz[3]/2}" stroke="#E6007E" stroke-dasharray="3 1.5"/>'
            '</g>']
    write_art('Invitation',f,TW,TH,art,bleed=INV_BLEED,marks=True,bg=bg,guides=guides,
        title=f'Youssef & Maii - Invitation card (ASSUMED trim {TW:g} x {TH:g} mm - TBC)',
        desc='Magenta = trim; blue dashed = 3 mm bleed; green dotted = 5 mm safe area; magenta dashed ellipse = placement zone of the physical 3-D butterfly (NOT printed).')
    preview_svg(os.path.join(PKG,'_tmp_preview.svg'),TW,TH,art)
    render_png(os.path.join(PKG,'_tmp_preview.svg'),os.path.join(f,'Invitation_Preview.png'),1800)
    return art,TW,TH,bz

# ============================ 02 CUPS =============================================
CUP_CREST_H=48.0
CUP_EST=dict(top_d=82.0,bottom_d=68.0,height=61.0,curl=5.0,base=6.0,seam=6.0)
def cup_development():
    e=CUP_EST; D,d,H=e['top_d'],e['bottom_d'],e['height']
    s=np.hypot(H,(D-d)/2); Ro=s*D/(D-d); Ri=Ro-s; ang=np.pi*D/Ro
    return s,Ro,Ri,ang
def build_cup():
    f=od('02_CUPS')
    cp=geo.crest_parts(); x0,y0,x1,y1=bbox(cp.values()); k=CUP_CREST_H/(y1-y0); cw=(x1-x0)*k; mg=5
    art=placed(cp,k,mg-x0*k,mg-y0*k); W,H=cw+2*mg,CUP_CREST_H+2*mg
    write_art('Cup',f,W,H,art,svg=False,title=f'Youssef & Maii - Cup crest artwork at recommended {CUP_CREST_H:g} mm height (TBC)')
    # master svg = illustrative flat development with placement
    s_,Ro,Ri,ang=cup_development(); e=CUP_EST
    half=ang/2; pad=8
    Wd=2*Ro*np.sin(half)+2*pad; top=Ro; bottom=Ri*np.cos(half)
    Hd=Ro-Ri*np.cos(half)+2*pad
    ax,ay=Wd/2, pad+Ro   # apex (below drawing)
    def pt(r,a): return (ax+r*np.sin(a), ay-r*np.cos(a))
    def arcd(r,a0,a1):
        p0=pt(r,a0); p1=pt(r,a1); return f'M{p0[0]:.3f} {p0[1]:.3f} A{r:.3f} {r:.3f} 0 0 1 {p1[0]:.3f} {p1[1]:.3f}'
    seam_a=e['seam']/Ro
    guides=['<g fill="none" stroke-width="0.3">',
        f'<path d="{arcd(Ro,-half,half)} L{pt(Ri,half)[0]:.3f} {pt(Ri,half)[1]:.3f} A{Ri:.3f} {Ri:.3f} 0 0 0 {pt(Ri,-half)[0]:.3f} {pt(Ri,-half)[1]:.3f} Z" stroke="#E6007E"/>',
        f'<path d="{arcd(Ro-e["curl"],-half,half)}" stroke="#00B050" stroke-dasharray="1.5 1"/>',
        f'<path d="{arcd(Ri+e["base"],-half,half)}" stroke="#00B050" stroke-dasharray="1.5 1"/>',
        f'<path d="M{pt(Ro,half-seam_a)[0]:.3f} {pt(Ro,half-seam_a)[1]:.3f} L{pt(Ri,half-seam_a)[0]:.3f} {pt(Ri,half-seam_a)[1]:.3f}" stroke="#00A0E6" stroke-dasharray="2 1"/>',
        f'<path d="M{ax:.3f} {pt(Ro,0)[1]-3:.3f} L{ax:.3f} {pt(Ri,0)[1]+3:.3f}" stroke="#999" stroke-dasharray="0.6 0.6"/>',
        '</g>']
    rmid=Ri+e['base']+(s_-e['base']-e['curl'])/2
    cx,cy=pt(rmid,0)
    placed_art={n:xf(d,Matrix.translate(cx-W/2,cy-H/2)) for n,d in art.items()}
    sv=SVG(Wd,Hd,'Youssef & Maii - Cup: ILLUSTRATIVE flat development + recommended placement (NOT a manufacturer dieline)',
        'ILLUSTRATIVE ONLY. Frustum development computed from ESTIMATED dimensions (top Ø%.0f, bottom Ø%.0f, height %.0f mm) derived from the 270 ml reference photo. Magenta = estimated blank outline; green dashed = assumed rim-curl (%.0f mm) and base-fold (%.0f mm) no-print bands; blue dashed = assumed %.0f mm side-seam overlap; grey = front centre line. The crest is placed unwarped for placement reference; production artwork on a conical cup must be arc-distorted by the supplier to their dieline. %s'%(e['top_d'],e['bottom_d'],e['height'],e['curl'],e['base'],e['seam'],TBC))
    g=sv.layer('GUIDES - ILLUSTRATIVE DEVELOPMENT - NOT A DIELINE (non-printing)','guides',locked=True)
    for gg in guides: sv.raw(g,gg)
    L=sv.layer(L_FOIL,'FOIL_GOLD')
    for n,d in placed_art.items(): sv.raw(L,f'<g id="{n}" inkscape:label="{n}">'); sv.path(L,d,GOLD_HEX); sv.raw(L,'</g>')
    sv.save(os.path.join(f,'Cup_Master.svg'))
    # also a crest-only artwork svg at production size
    sv2=SVG(W,H,'Youssef & Maii - Cup crest artwork (recommended %g mm high - TBC)'%CUP_CREST_H,TBC)
    L=sv2.layer(L_FOIL,'FOIL_GOLD')
    for n,d in art.items(): sv2.raw(L,f'<g id="{n}" inkscape:label="{n}">'); sv2.path(L,d,GOLD_HEX); sv2.raw(L,'</g>')
    sv2.save(os.path.join(f,'Cup_Crest_Artwork.svg'))
    # preview: development with placement
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wd} {Hd}"><rect width="100%" height="100%" fill="#fff"/>'+''.join(guides).replace('stroke-width="0.3"','stroke-width="0.35"')
    s+=''.join(f'<path d="{dstr(d)}" fill="{GOLD_HEX}"/>' for d in placed_art.values())+'</svg>'
    open(os.path.join(PKG,'_tmp_preview.svg'),'w').write(s); render_png(os.path.join(PKG,'_tmp_preview.svg'),os.path.join(f,'Cup_Preview.png'),3000)
    return art,W,H,dict(s=s_,Ro=Ro,Ri=Ri,ang=np.degrees(ang),crest_w=cw)

# ============================ 01 MASTER ===========================================
def build_master(logo):
    f=od('01_MASTER_VECTOR')
    SW,SH=420.0,297.0
    items=[]; labels=[]
    def put(art,w,h,x,y,lbl):
        for n,d in art.items(): items.append((lbl+'/'+n,xf(d,Matrix.translate(x,y))))
        labels.append(label(lbl,3.2,x,y-3))
    fa,fw,fh,_=logo['full']; put(fa,fw,fh,15,28,'A  FULL CIRCULAR LOGO  (monogram + botanical + arc + curved text)')
    ma,mw,mh,_=logo['mono']; put(ma,mw,mh,150,28,'B  MONOGRAM')
    ca,cw,ch,_=logo['crest']; put(ca,cw,ch,150,120,'C  CREST  (monogram + botanical sprigs)')
    lp=geo.logo_parts(); k=100/ (bbox(lp.values())[2]-bbox(lp.values())[0])
    bot={'botanical':lp['botanical']}; x0,y0,x1,y1=bbox(bot.values())
    put(placed(bot,k,-x0*k,-y0*k),0,0,245,28,'D  BOTANICAL BRANCH (single)')
    txt={'curved_text':lp['text']}; x0,y0,x1,y1=bbox(txt.values())
    put(placed(txt,k,-x0*k,-y0*k),0,0,15,160,'E  CURVED TEXT LOCKUP  YOUSSEF & MAII • 08-10-2026 (outlined)')
    ip=geo.invitation_parts(); ki=127/890
    for key,lbl,x,y in [('vine_left','F  INVITATION VINE - LEFT',250,120),('vine_right','G  INVITATION VINE - RIGHT',300,120)]:
        a={key:ip[key]}; x0,y0,x1,y1=bbox(a.values()); put(placed(a,ki,-x0*ki,-y0*ki),0,0,x,y,lbl)
    for key,lbl,x,y in [('title','H  INVITATION NAMES (Crimson Text Italic, outlined)',15,215),('date','I  INVITATION DATE (Crimson Text Italic, outlined)',15,245)]:
        a={key:ip[key]}; x0,y0,x1,y1=bbox(a.values()); put(placed(a,ki*1.6,-x0*ki*1.6,-y0*ki*1.6),0,0,x,y,lbl)
    hdr=[label('YOUSSEF & MAII - MASTER VECTOR ARTWORK LIBRARY',5,15,14),
         label('All artwork = vector outlines. Gold elements = FOIL_GOLD spot (metallic foil). Labels are non-printing. Scale freely (uniformly) - do not distort.',3,15,290)]
    # SVG
    sv=SVG(SW,SH,'Youssef & Maii - Master vector artwork library','Component library reconstructed from the supplied reference images. '+TBC)
    Ll=sv.layer('LABELS - NON-PRINTING','labels',locked=True)
    for d in labels+hdr: sv.path(Ll,d,'#555555')
    Lf=sv.layer(L_FOIL,'FOIL_GOLD')
    groups={}
    for n,d in items: groups.setdefault(n.split('/')[0],[]).append((n,d))
    for gname,lst in groups.items():
        gid=gname.split('  ')[0]
        sv.raw(Lf,f'<g id="element_{gid}" inkscape:label="{gname}">')
        for n,d in lst: sv.path(Lf,d,GOLD_HEX,None)
        sv.raw(Lf,'</g>')
    sv.save(os.path.join(f,'Youssef_Maii_Master.svg'))
    doc=Doc('Youssef & Maii - Master vector artwork library',SPOTS)
    p=doc.page(SW,SH,bleed=0,slug=0,marks=False)
    for d in labels+hdr: p.fill('LABELS - NON-PRINTING',d,('cmyk',(0,0,0,0.7)))
    for n,d in items: p.fill(L_FOIL,d,('spot','FOIL_GOLD',1.0),overprint=True)
    doc.save(os.path.join(f,'Youssef_Maii_Master.pdf'),'Master library. FOIL_GOLD = spot colour for metallic foil. '+TBC)
    subprocess.run(['gs','-q','-dNOPAUSE','-dBATCH','-dSAFER','-sDEVICE=eps2write','-dNoOutputFonts',f'-sOutputFile={os.path.join(f,"Youssef_Maii_Master.eps")}',os.path.join(f,'Youssef_Maii_Master.pdf')],check=True)

if __name__=='__main__':
    logo=build_logo(); print('logo ok')
    t=build_tambourine(); print('tambourine ok')
    inv=build_invitation(); print('invitation ok')
    cup=build_cup(); print('cup ok', cup[3])
    build_master(logo); print('master ok')
    pass
