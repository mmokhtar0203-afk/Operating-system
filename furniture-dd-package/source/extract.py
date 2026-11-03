import pymupdf as fitz, json, sys
out={}
for key,f in [('s1','src/04e46206-11.pdf'),('s2','src/8d2a943d-22.pdf')]:
    d=fitz.open(f); p=d[0]; M=p.rotation_matrix
    paths=[]
    for i,dr in enumerate(p.get_drawings()):
        segs=[]
        for it in dr['items']:
            op=it[0]
            if op=='l': pts=[it[1],it[2]]
            elif op=='c': pts=[it[1],it[2],it[3],it[4]]
            elif op=='re': r=it[1]; pts=[r.tl,r.tr,r.br,r.bl]
            elif op=='qu': q=it[1]; pts=[q.ul,q.ur,q.lr,q.ll]
            pts=[(round((fitz.Point(x)*M).x,3),round((fitz.Point(x)*M).y,3)) for x in pts]
            segs.append([op,pts])
        paths.append(dict(i=i,w=dr['width'],dash=dr.get('dashes'),close=dr.get('closePath'),fill=dr.get('fill'),color=dr.get('color'),segs=segs))
    texts=[]
    for b in p.get_text('rawdict')['blocks']:
        if b['type']: continue
        for l in b['lines']:
            for s in l['spans']:
                o=fitz.Point(s['origin'])*M
                bb=fitz.Rect(s['bbox'])*M
                texts.append(dict(t=''.join(c['c'] for c in s['chars']),o=(o.x,o.y),bbox=list(bb),dir=l['dir']))
    imgs=[]
    for im in p.get_image_info(xrefs=True):
        bb=fitz.Rect(im['bbox'])*M; imgs.append(dict(xref=im['xref'],bbox=list(bb)))
        pix=fitz.Pixmap(d,im['xref']); 
        if pix.n>3: pix=fitz.Pixmap(fitz.csRGB,pix)
        pix.save(f'work/{key}_img{im["xref"]}.png')
    out[key]=dict(paths=paths,texts=texts,imgs=imgs,size=(p.rect.width,p.rect.height))
json.dump(out,open('work/geom.json','w'),indent=0)
for k,v in out.items():
    print(k,len(v['paths']),v['imgs'])
    for t in v['texts']: print(t['t'],[round(a,1) for a in t['o']],t['dir'])
