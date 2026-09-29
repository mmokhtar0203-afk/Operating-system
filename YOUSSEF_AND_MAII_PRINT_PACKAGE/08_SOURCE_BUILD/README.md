# 08_SOURCE_BUILD: regenerate the package at supplier-confirmed sizes

The vector artwork components and the scripts that assemble every print file. Use this folder when a manufacturer dieline arrives, to regenerate files at new sizes without redrawing anything.

## Components (`components/`)
SVG path data (`d` strings). The circular-logo parts use reference-image-3 pixel units; the invitation parts use reference-image-4 pixel units.

| File | Element |
|---|---|
| `c_mono.d` | M/Y monogram, with rebuilt interlace gaps |
| `c_botfull.d` | Botanical branch as used in the circular logo (joins the arc) |
| `c_bot.d` | Same branch without the arc transition (tambourine, crest sprigs) |
| `c_arc.d` | Thin geometric arc of the circular logo |
| `c_text.d` | Curved text YOUSSEF & MAII • 08-10-2026 (outlined) |
| `c_vineL.d`, `c_vineR.d` | Invitation side vines |
| `reg4.json` | Measured placement (similarity transforms) of the crest parts |

The invitation names and date are generated at build time from `fonts/CrimsonText-Italic.ttf` and outlined.

## Rebuild
Requires Python 3 with `numpy opencv-python-headless scikit-image svgelements pikepdf cairosvg fonttools uharfbuzz pillow`, plus Ghostscript (for the EPS).

```
PKG=/path/to/output python3 build_all.py      # writes 01_MASTER_VECTOR … 05_LOGO
python3 preflight.py /path/to/output          # vector / CMYK / spot / font checks
```

Size constants are at the top of each section of `build_all.py`: `TAMB_D` (tambourine face Ø), `TAMB_BLEED`, `TAMB_SAFE`, `INV_BLEED`, `INV_SAFE`, the invitation width (`TW=127.0`), `CUP_CREST_H` and `CUP_EST`.
Only uniform scaling, rotation and translation are applied, so the identity is never distorted.

Fonts are under the SIL Open Font License (see `fonts/OFL_*.txt`).
