# YOUSSEF & MAII: Print Production Package

Vector print-production reconstruction of the existing **Youssef & Maii** engagement identity (8th of October, 2026), built from the four supplied reference images.
**The identity has not been redesigned.** Every deviation and every uncertainty is listed in `06_PRINT_SPECIFICATIONS/Preflight_QC_Report.pdf`.

> **FINAL DIELINE, PRINTABLE AREA, SCALE, BLEED AND SAFE AREA MUST BE CONFIRMED AGAINST THE MANUFACTURER'S TEMPLATE BEFORE PRODUCTION.**
> All physical sizes in this package are **assumed or estimated** and labelled *TBC*. General prepress values are labelled
> **RECOMMENDED GENERAL PREPRESS SPECIFICATION — FINAL VALUES TO BE CONFIRMED WITH SUPPLIER**.

## Folders
| Folder | What it is |
|---|---|
| `01_MASTER_VECTOR/` | Master component library: `.svg` (editable, layered), `.pdf` (FOIL_GOLD spot), `.eps` |
| `02_CUPS/` | Crest artwork at the recommended 48 mm height (CMYK + FOIL_GOLD PDFs), illustrative flat development (`Cup_Master.svg`, **not a dieline**), spec |
| `03_TAMBOURINE/` | Face artwork at an assumed Ø150 mm (CMYK + FOIL_GOLD), master SVG, spec, and an optional uniformly scaled safe-area variant |
| `04_INVITATION/` | Card at an assumed 127 × 170.5 mm with 3 mm bleed (CMYK + FOIL_GOLD), master SVG, spec |
| `05_LOGO/` | Full circular logo, monogram only, and crest (monogram + botanical sprigs): SVG, CMYK PDF, FOIL_GOLD PDF, transparent PNG |
| `06_PRINT_SPECIFICATIONS/` | Production, Colour, Font specs; Supplier Checklist; Preflight & QC Report; QC overlay; reference font files |
| `07_PREVIEWS/` | **MOCKUPS ONLY, not print artwork** |
| `08_SOURCE_BUILD/` | Component vector data + scripts to regenerate everything at supplier-confirmed sizes |
| `09_FINAL_DELIVERY/` | V1 client/printer-ready PDFs and PNGs + README.pdf |
| `10_IDENTITY_V2_NATURAL_FLOWER/` | **V2 application system**: ivory paper, champagne/gold print, optional tonal ivory botanical pattern, and one physical natural green stem with leaves (no flower head). Invitation V2, cups (monogram only), stickers, flower tag, flower wrapping, thank-you card, envelope, napkin and favour box, plus mockups and `Identity_V2_Guide.pdf`. Logo, monogram, botanicals and typography unchanged |

## Which file goes to the printer
* **Foil job:** `*_FOIL_GOLD.pdf`. Page 1 is the combined file (CMYK background layer + `FOIL_GOLD` spot layer, overprint). Page 2 is the foil elements only, for die making.
* **No foil (4-colour only):** `*_CMYK.pdf`. The gold here is a **CMYK GOLD SIMULATION** (C32 M52 Y83 K13), not foil.
* **Editing:** `*_Master.svg` (layers: GUIDES non-printing / CMYK background / FOIL_GOLD).

## Key facts
* Names are always **Youssef & Maii** (two i's). Curved text: **YOUSSEF & MAII • 08-10-2026**. Date: **8th of October, 2026**.
  *The invitation reference image itself reads "Mai"; this package corrects it.*
* Foil spot colour: **`FOIL_GOLD`** (Separation, 100 % tint, overprint). Rename to the printer's RIP convention if required.
* All print files: 100 % vector, CMYK/spot only, text outlined, no raster images, no transparency or effects (verified by the automated preflight).
* Invitation lettering: Crimson Text Italic (closest match; outlined). Monogram and curved text: traced from the reference (outlined).

## Open decisions (see `Supplier_Checklist.pdf`)
1. Cup dieline, printable area, number of placements, foil vs metallic ink.
2. Tambourine face diameter and print method. The botanical touches the face edge as in the reference; a 93.3 % safe-area variant is provided.
3. Invitation trim size and stock. The vines sit 0.6 / 1.3 mm from trim as in the reference.
4. Crest fine detail on the invitation and cups is below general foil minimums; a supplier test strike is recommended.
