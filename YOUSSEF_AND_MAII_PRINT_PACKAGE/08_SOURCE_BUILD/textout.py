import os
"""Shape text with HarfBuzz and return outlined SVG path data (y-down units)."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
FONT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'fonts','CrimsonText-Italic.ttf')
_cache={}
def _load(fp):
    if fp not in _cache:
        tt=TTFont(fp); _cache[fp]=(open(fp,'rb').read(),tt,tt.getGlyphSet(),tt['head'].unitsPerEm)
    return _cache[fp]
def outline(text, size, tracking=0.0, x=0.0, y=0.0, font=FONT):
    """size in output units per em; tracking in em; (x,y) = baseline start. returns d, advance width."""
    _blob,_tt,_gs,UPM=_load(font)
    face=hb.Face(_blob); font=hb.Font(face)
    buf=hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font,buf,{'kern':True,'liga':True})
    names=_tt.getGlyphOrder()
    sc=size/UPM; pen=SVGPathPen(_gs); cx=0
    for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
        g=names[info.codepoint]
        tp=TransformPen(pen,(sc,0,0,-sc,x+(cx+pos.x_offset)*sc,y-pos.y_offset*sc))
        _gs[g].draw(tp)
        cx+=pos.x_advance+tracking*UPM
    return pen.getCommands(), (cx-tracking*UPM)*sc
