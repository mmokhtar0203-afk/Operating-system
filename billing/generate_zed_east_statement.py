from decimal import Decimal as D
import html
items = [
("4 Jul 2026","Demolition Works",2400,20,2880),
("4 Jul 2026","Floor Protection Materials",2770,20,3324),
("6 Jul 2026","Electrical Products",860,20,1032),
("6 Jul 2026","1.5mm Electrical Wires",1540,20,1848),
("9 Jul 2026","Electrical Modification Works",2000,20,2400),
("9 Jul 2026","Site Cleaning Works",1250,20,1500),
("10 Jul 2026","Cement & Sand Materials",3450,20,4140),
("20 Jul 2026","Cement Materials",1200,20,1440),
("22 Jul 2026","Plastering Works",11200,20,13440),
("26 Jul 2026","IKEA Furniture & Fixtures Invoice",25390,0,25390),
("28 Jul 2026","Nanny's Bedroom Mattresses",6000,20,7200),
("29 Jul 2026","Dressing Room — Initial Payment",2000,0,2000),
("1 Aug 2026","Shadow Gap Skirting Works",13200,20,15840),
("2 Aug 2026","3mm Electrical Wires",2750,20,3300),
("2 Aug 2026","Uplight Fixtures",298,20,"357.6"),
("7 Aug 2026","Electrical Modification Works",2000,20,2400),
("19 Aug 2026","Site Cleaning Works",1000,20,1200),
("22 Aug 2026","Electrical Wires",26650,20,31980),
("24 Aug 2026","Electrical Materials",10255,20,12306),
("24 Aug 2026","Stone Carving / Nahat Works",1000,20,1200),
("30 Aug 2026","Electrical Technician Works",3000,20,3600),
("11 Sept 2026","Site Labor",1800,20,2160),
("14 Sept 2026","Electrical Supplies",2000,20,2400),
("16 Sept 2026","Gypsum Board Sample",5500,20,6600),
("18 Sept 2026","Electrical Installation Works",15000,20,18000),
("18 Sept 2026","Demolition Works",1600,20,1920),
("18 Sept 2026","Steel Reinforcement Works",18000,20,21600),
("18 Sept 2026","Site Washing & Cleaning Works",5500,20,6600),
("25 Sept 2026","Electrical Installation Works",12000,20,14400),
("1 Oct 2026","Gypsum Board Works — First Installment",20000,20,24000),
("1 Oct 2026","Cement & Sand Materials",4000,20,4800),
("1 Oct 2026","Plastering Materials & Supplies",2130,20,2556),
("1 Oct 2026","Plastering Works",24580,20,29496),
]
services=[("19 Jul 2026","Interior Design Services","Design",50000),("19 Jul 2026","As-Built Documentation Services","Site",10000)]
# --- verification against source document ---
cost_total=D(0); cp_total=D(0)
for d,desc,c,p,orig in items:
    cp=D(c)*(1+D(p)/100)
    assert cp==D(str(orig)), (desc,cp,orig)          # F/G: per-item check vs source
    assert (p==0 and cp==D(c)) or (p==20 and cp==D(c)*D('1.2'))
    cost_total+=D(c); cp_total+=cp
svc=sum(D(a) for *_,a in services)
markup=cp_total-cost_total
grand=svc+cost_total+markup
assert len(items)==33 and svc==60000
assert cost_total==232323 and cp_total==D('273309.6') and markup==D('40986.6')
assert cost_total+markup==cp_total and grand==D('333309.6')
OLD_GRAND=D('333309.6'); OLD_BAL=D('16690.4')
received=OLD_GRAND+OLD_BAL   # implied by source; grand total unchanged
balance=received-grand
assert balance==OLD_BAL
print("cost",cost_total,"cp",cp_total,"markup",markup,"grand",grand,"bal",balance)
print("0% items:",[i[1] for i in items if i[3]==0])

def f(x):
    x=D(x)
    return f"{x:,.2f} EGP" if x!=x.to_integral() else f"{int(x):,} EGP"
e=html.escape
def crow(r):
    d,desc,c,p,_=r; cp=D(c)*(1+D(p)/100)
    return f'<tr><td>{d}</td><td>{e(desc)}</td><td class="n">{f(c)}</td><td class="n c">{p}%</td><td class="n">{f(cp)}</td></tr>'
chead='<table class="t con"><colgroup><col style="width:17%"><col style="width:40%"><col style="width:15%"><col style="width:9%"><col style="width:19%"></colgroup><thead><tr><th>DATE</th><th>DESCRIPTION</th><th class="r">UNIT COST</th><th class="c">MARKUP</th><th class="r">CLIENT PRICE</th></tr></thead><tbody>'
def footer(n): return f'<div class="foot"><div>YAM Construction &nbsp;· Two.architects@gmail.com<br><span>Generated 5 October 2026 at 20:33</span></div><div>Page {n} of 3</div></div>'
cont='<div class="cont">YAM Construction &nbsp;— Zed East Project (continued)</div>'
pages=[items[:8],items[8:23],items[23:]]
p1=f'''<section class="page">
<header><div><div class="brand">YAM Construction</div><div class="sub">ARCHITECT STUDIO OS</div></div>
<div class="meta">Project: Zed East Project<br>Client: Dr. Ahmed Mokhtar<br>Date generated: 5 October 2026<br>Document No: INV-2026-014</div></header>
<h1>Client Billing Statement</h1><div class="period">Statement Period: Full project to date</div>
<div class="cards">
<div><label>SERVICES TOTAL</label><b>{f(svc)}</b></div>
<div><label>TOTAL MARKUP VALUE</label><b>{f(markup)}</b></div>
<div><label>CONSTRUCTION TOTAL</label><b>{f(cost_total)}</b></div>
<div class="g"><label>GRAND TOTAL</label><b>{f(grand)}</b></div>
</div>
<h2>Services</h2>
<table class="t"><colgroup><col style="width:17%"><col style="width:41%"><col style="width:22%"><col style="width:20%"></colgroup><thead><tr><th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th><th class="r">AMOUNT</th></tr></thead><tbody>
{''.join(f'<tr><td>{d}</td><td>{e(s)}</td><td>{c}</td><td class="n">{f(a)}</td></tr>' for d,s,c,a in services)}
</tbody><tfoot><tr><td colspan="3">Services Total</td><td class="n">{f(svc)}</td></tr></tfoot></table>
<h2>Construction</h2>
{chead}{''.join(map(crow,pages[0]))}</tbody></table>
{footer(1)}</section>'''
p2=f'<section class="page">{cont}{chead}{"".join(map(crow,pages[1]))}</tbody></table>{footer(2)}</section>'
p3=f'''<section class="page">{cont}{chead}{"".join(map(crow,pages[2]))}</tbody>
<tfoot><tr><td colspan="2">Column Totals</td><td class="n">{f(cost_total)}</td><td></td><td class="n">{f(cp_total)}</td></tr></tfoot></table>
<div class="recon">Construction Total {f(cost_total)} + Total Markup Value {f(markup)} = Total Client Prices {f(cp_total)}</div>
<div class="sum">
<div class="l"><span>Services Total</span><span class="n">{f(svc)}</span></div>
<div class="l"><span>Total Markup Value</span><span class="n">{f(markup)}</span></div>
<div class="l"><span>Construction Total <em>(before markup)</em></span><span class="n">{f(cost_total)}</span></div>
<div class="gt"><span>GRAND TOTAL</span><span class="n">{f(grand)}</span></div>
</div>
<div class="status"><h3>Status: Project Cash Flow Status</h3><p>Sufficient project cash is available to continue the works.</p>
<p class="bal">Available Project Balance: &nbsp;<span class="n">{f(balance)}</span></p></div>
{footer(3)}</section>'''
css='''
@page{size:A4;margin:0}*{box-sizing:border-box}
body{margin:0;background:#fff;font-family:"Liberation Sans",Helvetica,Arial,sans-serif;color:#222}
.page{width:210mm;height:297mm;padding:17mm 16mm 0;position:relative;page-break-after:always;overflow:hidden}
.page:last-child{page-break-after:auto}
.n{font-family:"Liberation Mono",Courier,monospace;text-align:right;white-space:nowrap}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5pt solid #b89a5c;padding-bottom:7pt}
.brand{font-weight:bold;font-size:17.5pt}.sub{font-size:7.5pt;color:#777;margin-top:5pt;letter-spacing:.3pt}
.meta{text-align:right;font-size:9pt;color:#777;line-height:1.5}
h1{font-size:15.5pt;margin:16pt 0 4pt}.period{font-size:8.5pt;color:#777}
.cards{display:flex;background:#f7f6f2;margin:24pt 0 12pt;padding:12pt 12pt 11pt}
.cards div{flex:1}.cards label{display:block;font-size:7pt;font-weight:bold;color:#666;margin-bottom:6pt;letter-spacing:.2pt}
.cards b{font-family:"Liberation Mono",Courier,monospace;font-size:12.5pt}
.cards .g b{font-size:13.5pt}
h2{font-size:12pt;margin:22pt 0 18pt}
.t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}
.t th{font-size:7.5pt;color:#777;text-align:left;padding:0 5pt 9pt;border-bottom:1pt solid #333;font-weight:bold;letter-spacing:.2pt}
.t th.r{text-align:right}.t th.c,.t td.c{text-align:center}
.t td{padding:8pt 5pt;vertical-align:top;line-height:1.35}
.t tbody tr:first-child td{padding-top:15pt}
.t tbody tr:nth-child(odd) td{background:#f7f6f2}
.t tbody tr:first-child td{background:linear-gradient(#fff 7pt,#f7f6f2 7pt)}
.t tfoot td{font-weight:bold;color:#777;padding:4pt 5pt 0;font-size:10pt}
.t tfoot td.n{color:#222}
.hint{font-weight:normal;font-size:8.5pt}
.recon{font-size:8.5pt;color:#777;text-align:right;margin-top:6pt;padding-right:5pt}
.cont{font-size:8.5pt;color:#777;margin:0 0 25pt}
.sum{width:62%;margin:40pt 0 0 auto;border-top:1pt solid #ccc;padding-top:8pt;font-size:9.5pt;color:#777}
.sum .l{display:flex;justify-content:space-between;padding:4pt 0 6pt}
.sum em{font-style:normal;font-size:8pt}
.sum .gt{display:flex;justify-content:space-between;color:#222;font-weight:bold;font-size:14pt;border-top:1pt solid #ccc;margin-top:4pt;padding-top:9pt}
.sum .gt .n{font-size:13.5pt}
.status{background:#f7f6f2;border-left:3pt solid #4b8a52;margin-top:36pt;padding:11pt 16pt}
.status h3{color:#4b8a52;font-size:12pt;margin:0 0 8pt}.status p{font-size:9pt;margin:0 0 6pt}
.status .bal{color:#4b8a52;font-weight:bold;margin:0}
.foot{position:absolute;left:16mm;right:16mm;bottom:12mm;display:flex;justify-content:space-between;font-size:7.5pt;color:#777;line-height:1.5}
.foot span{font-size:7pt}
'''
open('statement.html','w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>Zed East Project — Client Billing Statement</title><style>{css}</style></head><body>{p1}{p2}{p3}</body></html>')
