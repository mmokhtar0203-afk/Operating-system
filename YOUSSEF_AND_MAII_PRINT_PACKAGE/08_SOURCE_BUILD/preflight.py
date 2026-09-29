import os
import pikepdf, os, re, json, glob, sys
PKG=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'output')
def check_pdf(fn):
    pdf=pikepdf.open(fn); r={'file':os.path.relpath(fn,PKG),'pages':len(pdf.pages)}
    imgs=0; fonts=0; cs=set(); spots=set(); rgb_ops=0; gray_ops=0; tints=set(); ocgs=[]
    if '/OCProperties' in pdf.Root: ocgs=[str(o.Name) for o in pdf.Root.OCProperties.OCGs]
    boxes=[]
    for p in pdf.pages:
        res=p.obj.get('/Resources',{})
        xo=res.get('/XObject',{})
        for k in xo.keys():
            if xo[k].get('/Subtype')=='/Image': imgs+=1
        if '/Font' in res: fonts+=len(res.Font.keys())
        for k,v in res.get('/ColorSpace',{}).items():
            if isinstance(v,pikepdf.Array) and v[0]=='/Separation': spots.add(str(v[1])[1:])
            else: cs.add(str(v))
        data=p.obj.Contents.read_bytes().decode('latin1')
        rgb_ops+=len(re.findall(r'(?m)(?:^|\s)[\d.]+ [\d.]+ [\d.]+ (?:rg|RG)\b',data))
        gray_ops+=len(re.findall(r'(?m)(?:^|\s)[\d.]+ (?:g|G)\b',data))
        tints|=set(re.findall(r'cs ([\d.]+) scn',data))
        boxes.append({b:[round(float(x)*25.4/72,2) for x in p.obj[b]] for b in ('/MediaBox','/TrimBox','/BleedBox') if b in p.obj})
    r.update(raster_images=imgs,fonts=fonts,device_rgb_or_gray_ops=rgb_ops+gray_ops,spot_colours=sorted(spots),spot_tints=sorted(tints),layers=ocgs,boxes_mm=boxes[0])
    r['PASS']=imgs==0 and fonts==0 and rgb_ops+gray_ops==0 and (not tints or tints<={'1'})
    return r
def check_svg(fn):
    s=open(fn).read()
    r={'file':os.path.relpath(fn,PKG),'text_elements':len(re.findall(r'<text\b',s)),'image_elements':len(re.findall(r'<image\b',s)),
       'filters_or_gradients':len(re.findall(r'<(filter|linearGradient|radialGradient|mask|clipPath)\b',s)),
       'layers':re.findall(r'inkscape:groupmode="layer" inkscape:label="([^"]+)"',s)}
    r['PASS']=r['text_elements']==0 and r['image_elements']==0 and r['filters_or_gradients']==0
    return r
def check_eps(fn):
    s=open(fn,'rb').read().decode('latin1')
    body=s[s.find('%%EndProlog'):]
    r={'file':os.path.relpath(fn,PKG),'has_FOIL_GOLD_separation':'FOIL_GOLD' in s,'embedded_images':body.count('/ImageType')+body.count(' image\n')+body.count('imagemask'),'fonts':s.count('%%BeginResource: font')}
    r['PASS']=r['has_FOIL_GOLD_separation'] and r['embedded_images']==0 and r['fonts']==0
    return r
if __name__=='__main__':
    out=[]
    for fn in sorted(glob.glob(PKG+'/0[1-5]_*/**/*.pdf',recursive=True)):
        if '_Spec' in os.path.basename(fn): continue   # documentation, not print artwork
        out.append(check_pdf(fn))
    for fn in sorted(glob.glob(PKG+'/0[1-5]_*/**/*.svg',recursive=True)): out.append(check_svg(fn))
    for fn in sorted(glob.glob(PKG+'/**/*.eps',recursive=True)): out.append(check_eps(fn))
    json.dump(out,open(os.path.join(PKG,'preflight.json'),'w'),indent=1)
    for r in out: print(('PASS ' if r['PASS'] else 'FAIL '),r['file'], {k:v for k,v in r.items() if k in ('spot_colours','spot_tints','raster_images','fonts','device_rgb_or_gray_ops','text_elements','image_elements','has_FOIL_GOLD_separation')})
