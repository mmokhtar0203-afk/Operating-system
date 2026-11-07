// Demonstration data. Seeding is additive and idempotent: it never overwrites
// existing user records (sample projects use fixed ids and are skipped if present).
import { db } from '../services/db.js';
import { ProjectService } from '../services/project-service.js';
import { LibraryService } from '../services/library-service.js';
import { SpecService } from '../services/spec-service.js';
import { FileService } from '../services/file-service.js';
import { TemplateService } from '../services/template-service.js';
import { defaultTemplates } from './templates.js';
import { makeTexture, makePlanDrawing, makeCover } from './textures.js';
import { round, nowISO } from '../core/utils.js';

export const DEMO_PROJECT_IDS = ['prj_demo_zed', 'prj_demo_wesal', 'prj_demo_allegria'];

/* --------------------------------------------------------------------------
   Library — [demoKey, category, data, texture]
   -------------------------------------------------------------------------- */
const S = (k, v) => ({ k, v });
const LIB = [
  // Flooring
  ['oak', 'flooring', { name: 'Natural Oak Engineered Plank', manufacturer: 'Listone Giordano', brand: 'Natural Genius', reference: 'NG-OAK-190-NAT', dimensions: '1800 × 190 × 14 mm', colour: 'Natural oak', colourHex: '#B98F5E', finish: 'Matt natural oil', description: 'Three-layer engineered European oak, 4 mm wear layer, micro-bevelled long edges.', specs: [S('Wear layer', '4 mm'), S('Grade', 'Nature / rustic mix'), S('Installation', 'Full-bond glue-down'), S('Fire class', 'Cfl-s1')], unit: 'm²', unitPrice: 2650, supplier: { name: 'Woodcraft Egypt', contact: 'Hany Samir', phone: '+20 100 555 0182', email: 'sales@woodcraft.example', website: '' } }, { t: 'wood', color: '#B98F5E' }],
  ['oak_hb', 'flooring', { name: 'Smoked Oak Herringbone', manufacturer: 'Listone Giordano', brand: 'Classica', reference: 'CL-HB-90-SMK', dimensions: '600 × 90 × 11 mm', colour: 'Smoked oak', colourHex: '#7A5A3C', finish: 'Brushed, hard-wax oil', description: 'Solid-top herringbone blocks for formal reception spaces.', specs: [S('Pattern', 'Herringbone 90°'), S('Wear layer', '3.5 mm')], unit: 'm²', unitPrice: 3400 }, { t: 'herringbone', color: '#7A5A3C' }],
  // Tiles
  ['porc', 'tiles', { name: 'Porcelain Stone-look 60 × 120', manufacturer: 'Marazzi', brand: 'Grande Stone Look', reference: 'MZ-GSL-60120-WG', dimensions: '1200 × 600 × 9 mm', colour: 'Warm grey', colourHex: '#B4ADA2', finish: 'Matt R10', description: 'Rectified through-body porcelain for kitchens and wet areas.', specs: [S('Slip rating', 'R10 / DCOF ≥ 0.42'), S('Water absorption', '≤ 0.5 %'), S('Grout', '2 mm, colour-matched')], unit: 'm²', unitPrice: 1150 }, { t: 'tile', color: '#B4ADA2', cols: 2, rows: 4, groutColor: '#A39C91', vary: 6 }],
  ['zellige', 'tiles', { name: 'Zellige-look Glazed Wall Tile', manufacturer: 'Equipe Cerámicas', brand: 'Artisan', reference: 'EQ-ART-1010-WHT', dimensions: '100 × 100 × 9 mm', colour: 'Off-white', colourHex: '#EDE8DD', finish: 'Gloss, hand-made effect', description: 'Irregular glazed wall tile for shower walls and splashbacks.', specs: [S('Use', 'Walls only'), S('Grout', '1.5 mm, epoxy')], unit: 'm²', unitPrice: 1800 }, { t: 'tile', color: '#EDE8DD', cols: 6, rows: 6, groutColor: '#d4cec3', vary: 22, gloss: true, grout: 4 }],
  // Marble & stone
  ['calacatta', 'stone', { name: 'Calacatta Oro Marble', manufacturer: 'Antolini', brand: '', reference: 'ANT-CALORO-20H', dimensions: 'Slab / 600 × 600 × 20 mm', colour: 'White with gold veining', colourHex: '#F2EEE7', finish: 'Honed', description: 'Book-matched where visible. Impregnating sealer, 2 coats.', specs: [S('Origin', 'Carrara, Italy'), S('Sealer', 'Penetrating, oleophobic')], unit: 'm²', unitPrice: 9800 }, { t: 'marble', color: '#F2EEE7', vein: '#A8936A', veins: 10, thick: 3 }],
  ['galala', 'stone', { name: 'Galala Cream Marble', manufacturer: 'Egyptian Stone Co.', brand: '', reference: 'ESC-GAL-6060-P', dimensions: '600 × 600 × 20 mm', colour: 'Cream beige', colourHex: '#E6D8BF', finish: 'Polished', description: 'Egyptian Galala, first selection, calibrated tiles.', specs: [S('Origin', 'Galala Mountains, Egypt'), S('Joints', '1 mm, lippage < 0.5 mm')], unit: 'm²', unitPrice: 1450 }, { t: 'marble', color: '#E6D8BF', vein: '#C3AE8B', veins: 6, thick: 1.4 }],
  ['travertine', 'stone', { name: 'Travertine Classico', manufacturer: 'Egyptian Stone Co.', brand: '', reference: 'ESC-TRV-6040-HF', dimensions: '600 × 400 × 20 mm', colour: 'Classic beige', colourHex: '#D8C6A6', finish: 'Honed & filled, anti-slip', description: 'Exterior-grade travertine pavers for terraces.', specs: [S('Slip rating', 'R11'), S('Setting', 'On pedestals / mortar bed')], unit: 'm²', unitPrice: 1650 }, { t: 'stone', color: '#D8C6A6', joints: true }],
  // Paint
  ['p_timeless', 'paint', { name: 'Rich Matt Emulsion — Timeless', manufacturer: 'Jotun', brand: 'Fenomastic Pure Colours', reference: 'JOT-1024', dimensions: '—', colour: '1024 Timeless', colourHex: '#E8E2D6', finish: 'Rich matt', description: 'Washable interior emulsion. 1 coat primer + 2 finish coats.', specs: [S('Coverage', '10–12 m²/L/coat'), S('VOC', 'Low')], unit: 'm²', unitPrice: 95 }, { t: 'paint', color: '#E8E2D6' }],
  ['p_grey', 'paint', { name: 'Rich Matt Emulsion — Comfort Grey', manufacturer: 'Jotun', brand: 'Fenomastic Pure Colours', reference: 'JOT-12078', dimensions: '—', colour: '12078 Comfort Grey', colourHex: '#C9C2B6', finish: 'Rich matt', description: 'Washable interior emulsion.', specs: [S('Coverage', '10–12 m²/L/coat')], unit: 'm²', unitPrice: 95 }, { t: 'paint', color: '#C9C2B6' }],
  ['p_ceiling', 'paint', { name: 'Ceiling Flat — Classic White', manufacturer: 'Jotun', brand: 'Fenomastic Ceiling', reference: 'JOT-9918', dimensions: '—', colour: '9918 Classic White', colourHex: '#F3F1EA', finish: 'Dead flat', description: 'Non-reflective ceiling paint.', specs: [S('Sheen', '< 3 %')], unit: 'm²', unitPrice: 70 }, { t: 'paint', color: '#F3F1EA' }],
  ['p_moist', 'paint', { name: 'Moisture-resistant Emulsion', manufacturer: 'Jotun', brand: 'Fenomastic Wonderwall', reference: 'JOT-WW-1024', dimensions: '—', colour: '1024 Timeless', colourHex: '#E8E2D6', finish: 'Matt, anti-mould', description: 'For bathrooms above tiling height.', specs: [S('Anti-fungal', 'Yes')], unit: 'm²', unitPrice: 120 }, { t: 'paint', color: '#E4DED2' }],
  // Wall finishes
  ['marmorino', 'wall', { name: 'Marmorino Lime Plaster', manufacturer: 'Oikos', brand: 'Marmorino Classico', reference: 'OIK-MAR-SAND', dimensions: '—', colour: 'Sand', colourHex: '#D8CBB6', finish: 'Burnished, wax-sealed', description: 'Hand-trowelled natural lime plaster, 3 coats.', specs: [S('Coats', '3 + wax'), S('Applicator', 'Certified only')], unit: 'm²', unitPrice: 850 }, { t: 'plaster', color: '#D8CBB6' }],
  ['fluted', 'wall', { name: 'Fluted Oak Wall Panel', manufacturer: 'Custom joinery', brand: '', reference: 'CUST-FLT-OAK', dimensions: '2700 × 600 × 22 mm, 30 mm flutes', colour: 'Natural oak', colourHex: '#B98F5E', finish: 'Matt lacquer', description: 'Solid oak fluted cladding on MR MDF backing.', specs: [S('Flute', '30 mm half-round'), S('Fixing', 'Concealed French cleat')], unit: 'm²', unitPrice: 4200 }, { t: 'fluted', color: '#B98F5E' }],
  // Wood & veneer
  ['v_oak', 'wood', { name: 'Oak Veneer — Crown Cut', manufacturer: 'Decospan', brand: 'Querkus', reference: 'DSP-QK-CC-OAK', dimensions: '2800 × 1300 mm sheets', colour: 'Natural oak', colourHex: '#C49A68', finish: 'Matt lacquer 10 gloss', description: 'Book-matched crown-cut oak on MDF.', specs: [S('Matching', 'Book match, balanced')], unit: 'm²', unitPrice: 1350 }, { t: 'wood', color: '#C49A68', veneer: true, plank: 640 }],
  ['v_walnut', 'wood', { name: 'American Walnut Veneer', manufacturer: 'Decospan', brand: '', reference: 'DSP-WAL-QC', dimensions: '2800 × 1300 mm sheets', colour: 'Walnut', colourHex: '#5E4130', finish: 'Satin lacquer', description: 'Quarter-cut walnut for feature joinery.', specs: [], unit: 'm²', unitPrice: 1900 }, { t: 'wood', color: '#5E4130', veneer: true, plank: 640 }],
  // Joinery materials
  ['mdf', 'joinery', { name: 'MR MDF 18 mm', manufacturer: 'Egger', brand: 'Eurospan MR', reference: 'EGG-MDF-MR-18', dimensions: '2800 × 2070 × 18 mm', colour: 'Green core', colourHex: '#8E9C7C', finish: 'Raw', description: 'Moisture-resistant MDF carcass board.', specs: [S('Emission', 'E1')], unit: 'm²', unitPrice: 520 }, { t: 'solid', color: '#9AA58A', noise: 22 }],
  ['fenix', 'joinery', { name: 'FENIX NTM Grigio Londra', manufacturer: 'Arpa Industriale', brand: 'FENIX NTM', reference: 'FNX-0718', dimensions: '3050 × 1300 × 0.9 mm', colour: 'Grigio Londra', colourHex: '#8B8781', finish: 'Super-matt, anti-fingerprint', description: 'Nano-tech laminate for fronts and worktops.', specs: [S('Thermal repair', 'Yes')], unit: 'm²', unitPrice: 2100 }, { t: 'solid', color: '#8B8781', noise: 6 }],
  // Hardware
  ['tipon', 'hardware', { name: 'Push-to-open Hinge System', manufacturer: 'Blum', brand: 'CLIP top BLUMOTION + TIP-ON', reference: 'BLM-71B3550', dimensions: '110° opening', colour: 'Nickel', colourHex: '#B9B6AF', finish: 'Nickel-plated', description: 'Soft-close concealed hinge with mechanical push-to-open.', specs: [S('Opening', '110°')], unit: 'pcs', unitPrice: 320 }, { t: 'product', draw: 'hinge' }],
  ['handle', 'hardware', { name: 'Recessed Brass Pull', manufacturer: 'Häfele', brand: '', reference: 'HAF-151.37.640', dimensions: '160 × 40 mm', colour: 'Brushed brass', colourHex: '#B5975B', finish: 'Brushed, lacquered', description: 'Flush-routed recessed pull.', specs: [], unit: 'pcs', unitPrice: 480 }, { t: 'product', draw: 'handle', bg: '#EDE4D1' }],
  // Lighting
  ['dl', 'lighting', { name: 'Recessed Downlight 8 W', manufacturer: 'Delta Light', brand: 'Reo', reference: 'DL-REO-82733-B', dimensions: 'Ø85 × 70 mm, cut-out Ø75', colour: 'Matt white', colourHex: '#F2F0EA', finish: 'Powder coat', description: 'Deep-recessed anti-glare spot, fixed.', attrs: { wattage: 8, cct: 2700, beam: 36, cri: '≥ 90', ip: 'IP44', lumens: 620, dimming: 'DALI' }, specs: [S('UGR', '< 16')], unit: 'pcs', unitPrice: 1450 }, { t: 'product', draw: 'downlight' }],
  ['dl65', 'lighting', { name: 'Wet-area Downlight IP65', manufacturer: 'Delta Light', brand: 'Reo IP', reference: 'DL-REOIP-82730', dimensions: 'Ø85 × 75 mm', colour: 'Matt white', colourHex: '#F2F0EA', finish: 'Powder coat', description: 'Sealed downlight for showers (zone 1).', attrs: { wattage: 7, cct: 3000, beam: 40, cri: '≥ 90', ip: 'IP65', lumens: 560, dimming: 'DALI' }, specs: [], unit: 'pcs', unitPrice: 1750 }, { t: 'product', draw: 'downlight', bg: '#E6EAEA' }],
  ['pendant', 'lighting', { name: 'Opal Globe Pendant Ø300', manufacturer: 'Flos', brand: '', reference: 'FL-GLB-300-BR', dimensions: 'Ø300 mm, drop adjustable to 2000 mm', colour: 'Opal / brushed brass', colourHex: '#E9E1CF', finish: 'Mouth-blown glass', description: 'Decorative pendant over dining / island.', attrs: { wattage: 12, cct: 2700, beam: 360, cri: '≥ 90', ip: 'IP20', lumens: 900, dimming: 'Phase-cut (TRIAC)' }, specs: [], unit: 'pcs', unitPrice: 14500 }, { t: 'product', draw: 'pendant', bg: '#EDE6D6' }],
  ['strip', 'lighting', { name: 'LED Profile Strip 10 W/m', manufacturer: 'Delta Light', brand: 'Ultra Slim', reference: 'DL-US-10W-27', dimensions: '16 × 8 mm profile', colour: 'Aluminium', colourHex: '#C9C9C6', finish: 'Opal diffuser', description: 'Cove and joinery integrated linear light.', attrs: { wattage: 10, cct: 2700, beam: 120, cri: '≥ 90', ip: 'IP20', lumens: 900, dimming: 'DALI' }, specs: [S('Per', 'metre run')], unit: 'm', unitPrice: 950 }, { t: 'product', draw: 'linear' }],
  ['washer', 'lighting', { name: 'Linear Wall Washer', manufacturer: 'iGuzzini', brand: 'Laser Blade', reference: 'IGZ-LB-XS-5', dimensions: '400 × 30 mm', colour: 'Black', colourHex: '#2A2723', finish: 'Matt', description: 'Recessed linear wall-wash for feature walls.', attrs: { wattage: 9, cct: 2700, beam: 60, cri: '≥ 90', ip: 'IP20', lumens: 700, dimming: 'DALI' }, specs: [], unit: 'pcs', unitPrice: 6200 }, { t: 'product', draw: 'washer' }],
  ['outwall', 'lighting', { name: 'Outdoor Wall Light IP65', manufacturer: 'Flos', brand: 'Outdoor', reference: 'FL-OWL-UD', dimensions: '300 × 90 mm', colour: 'Bronze', colourHex: '#5C4A38', finish: 'Anodised', description: 'Up/down facade wall light.', attrs: { wattage: 2 * 6, cct: 3000, beam: 30, cri: '≥ 80', ip: 'IP65', lumens: 800, dimming: 'Non-dimmable' }, specs: [], unit: 'pcs', unitPrice: 5400 }, { t: 'product', draw: 'wall_light' }],
  // Electrical
  ['sock2', 'electrical', { name: 'Double Switched Socket 13 A', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5732-WH', dimensions: '146 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: 'BS 1363 twin switched socket outlet.', attrs: { type: 'Switched socket outlet', voltage: 230, amperage: 13, gangs: '2G', ip: 'IP20', mounting: '+300 mm AFFL' }, specs: [], unit: 'pcs', unitPrice: 420 }, { t: 'product', draw: 'socket2' }],
  ['sock1', 'electrical', { name: 'Single Switched Socket 13 A', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5731-WH', dimensions: '86 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: 'BS 1363 single switched socket outlet.', attrs: { type: 'Switched socket outlet', voltage: 230, amperage: 13, gangs: '1G', ip: 'IP20', mounting: '+300 mm AFFL' }, specs: [], unit: 'pcs', unitPrice: 260 }, { t: 'product', draw: 'socket1' }],
  ['sw1', 'electrical', { name: '1-Gang 2-Way Switch 10 A', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5721-WH', dimensions: '86 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: 'Rocker switch.', attrs: { type: 'Light switch', voltage: 230, amperage: 10, gangs: '1G 2W', ip: 'IP20', mounting: '+1100 mm AFFL' }, specs: [], unit: 'pcs', unitPrice: 190 }, { t: 'product', draw: 'switch' }],
  ['dim', 'electrical', { name: 'Rotary Dimmer 400 W', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5750-WH', dimensions: '86 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: 'Universal LED rotary dimmer.', attrs: { type: 'Dimmer', voltage: 230, amperage: 2, gangs: '1G', ip: 'IP20', mounting: '+1100 mm AFFL' }, specs: [], unit: 'pcs', unitPrice: 980 }, { t: 'product', draw: 'dimmer' }],
  ['data', 'electrical', { name: 'Data Outlet RJ45 Cat6', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5760-WH', dimensions: '86 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: 'Shielded Cat6 data outlet.', attrs: { type: 'Data outlet', voltage: null, amperage: null, gangs: '1G', ip: 'IP20', mounting: '+300 mm AFFL' }, specs: [], unit: 'pcs', unitPrice: 340 }, { t: 'product', draw: 'data' }],
  ['usb', 'electrical', { name: 'USB A+C Charger Outlet', manufacturer: 'Legrand', brand: 'Arteor', reference: 'LEG-ART-5770-WH', dimensions: '86 × 86 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Matt', description: '30 W USB-C PD + USB-A.', attrs: { type: 'USB outlet', voltage: 230, amperage: 3, gangs: '1G', ip: 'IP20', mounting: 'Bedside +600 mm' }, specs: [], unit: 'pcs', unitPrice: 1150 }, { t: 'product', draw: 'usb' }],
  // Sanitaryware
  ['wc', 'sanitary', { name: 'Wall-hung WC, Rimless', manufacturer: 'Duravit', brand: 'ME by Starck', reference: 'DUR-2529090000', dimensions: '570 × 370 mm', colour: 'White', colourHex: '#FFFFFF', finish: 'Gloss, WonderGliss', description: 'Rimless wall-hung pan with soft-close seat.', specs: [S('Flush', '4.5 / 3 L')], unit: 'pcs', unitPrice: 14500 }, { t: 'product', draw: 'wc' }],
  ['basin', 'sanitary', { name: 'Countertop Basin 600', manufacturer: 'Duravit', brand: 'Luv', reference: 'DUR-0379600000', dimensions: '600 × 400 mm', colour: 'White', colourHex: '#FFFFFF', finish: 'Matt white', description: 'Fine ceramic countertop basin.', specs: [], unit: 'pcs', unitPrice: 12800 }, { t: 'product', draw: 'basin' }],
  ['mixer', 'sanitary', { name: 'Single-lever Basin Mixer', manufacturer: 'Hansgrohe', brand: 'Finoris', reference: 'HG-76023670', dimensions: 'Spout 160 mm', colour: 'Matt black', colourHex: '#2A2723', finish: 'Matt black', description: 'Basin mixer with pop-up waste.', specs: [S('Flow', '5 L/min')], unit: 'pcs', unitPrice: 9600 }, { t: 'product', draw: 'mixer' }],
  ['shower', 'sanitary', { name: 'Thermostatic Shower System', manufacturer: 'Grohe', brand: 'Grohtherm SmartControl', reference: 'GRO-34706000', dimensions: 'Head Ø310 mm', colour: 'Chrome', colourHex: '#CFD2D4', finish: 'StarLight chrome', description: 'Concealed thermostatic set with rain head and hand shower.', specs: [], unit: 'set', unitPrice: 38500 }, { t: 'product', draw: 'shower' }],
  ['tub', 'sanitary', { name: 'Freestanding Bathtub 1700', manufacturer: 'Kaldewei', brand: 'Meisterstück', reference: 'KAL-202740', dimensions: '1700 × 750 mm', colour: 'Alpine white', colourHex: '#FFFFFF', finish: 'Matt', description: 'Steel enamel freestanding bath.', specs: [], unit: 'pcs', unitPrice: 86000 }, { t: 'product', draw: 'bathtub' }],
  ['cistern', 'sanitary', { name: 'Concealed Cistern Frame', manufacturer: 'Geberit', brand: 'Duofix', reference: 'GEB-111.300.00.5', dimensions: '1120 mm frame', colour: '—', colourHex: '', finish: '—', description: 'Pre-wall installation frame for wall-hung WC.', specs: [], unit: 'set', unitPrice: 9200 }, { t: 'product', draw: 'cistern' }],
  // Furniture
  ['sofa', 'furniture', { name: 'Modular Sofa, 3-seat', manufacturer: 'Poliform', brand: 'Bristol', reference: 'PLF-BRS-3S', dimensions: '2700 × 1000 × 720 mm', colour: 'Oat bouclé', colourHex: '#D9CFBF', finish: 'Fabric cat. C', description: 'Low modular sofa with feather cushions.', attrs: { material: 'Bouclé fabric, oak plinth', fabricator: 'Poliform (imported)', custom: 'Standard (catalogue)' }, specs: [], unit: 'pcs', unitPrice: 485000 }, { t: 'product', draw: 'sofa', bg: '#ECE5D8' }],
  ['dchair', 'furniture', { name: 'Dining Chair, Upholstered', manufacturer: 'Carl Hansen & Søn', brand: '', reference: 'CH-E005-OAK', dimensions: '520 × 540 × 780 mm', colour: 'Oak / sand leather', colourHex: '#C4A988', finish: 'Oiled oak', description: 'Solid oak chair with leather seat.', attrs: { material: 'Solid oak, leather', fabricator: 'Carl Hansen & Søn', custom: 'Standard (catalogue)' }, specs: [], unit: 'pcs', unitPrice: 42000 }, { t: 'product', draw: 'chair' }],
  // Appliances
  ['oven', 'appliances', { name: 'Built-in Oven 60 cm', manufacturer: 'Bosch', brand: 'Series 8', reference: 'HBG7741B1', dimensions: '595 × 595 × 548 mm', colour: 'Black', colourHex: '#1F1F1F', finish: 'Glass', description: 'Pyrolytic multifunction oven.', specs: [S('Power', '3.6 kW')], unit: 'pcs', unitPrice: 78000 }, { t: 'product', draw: 'oven' }],
  ['hob', 'appliances', { name: 'Induction Hob 80 cm', manufacturer: 'Bosch', brand: 'Series 8', reference: 'PXV875DC1E', dimensions: '816 × 527 mm', colour: 'Black', colourHex: '#1F1F1F', finish: 'Glass ceramic', description: 'FlexInduction hob, frameless.', specs: [S('Power', '7.4 kW')], unit: 'pcs', unitPrice: 69000 }, { t: 'product', draw: 'hob' }],
  ['fridge', 'appliances', { name: 'Integrated Fridge-Freezer', manufacturer: 'Liebherr', brand: '', reference: 'ICBNd 5163', dimensions: '1770 × 560 × 550 mm', colour: 'Panel-ready', colourHex: '', finish: '—', description: 'Fully integrated BioFresh.', specs: [], unit: 'pcs', unitPrice: 112000 }, { t: 'product', draw: 'fridge' }],
  ['hood', 'appliances', { name: 'Ceiling Extractor Hood', manufacturer: 'Elica', brand: 'Lullaby', reference: 'EL-LUL-90', dimensions: '900 × 500 mm', colour: 'White', colourHex: '#F5F5F2', finish: 'Glass', description: 'Flush ceiling hood, remote motor.', specs: [S('Extraction', '780 m³/h')], unit: 'pcs', unitPrice: 54000 }, { t: 'product', draw: 'hood' }],
  ['ac', 'appliances', { name: 'Ducted Split AC 2.5 HP', manufacturer: 'Daikin', brand: 'FDXM', reference: 'FDXM60F', dimensions: '1000 × 700 × 200 mm', colour: '—', colourHex: '', finish: 'Concealed', description: 'Concealed ducted indoor unit with linear grilles.', specs: [S('Capacity', '6.0 kW')], unit: 'pcs', unitPrice: 61000 }, { t: 'product', draw: 'ac' }],
];

/* --------------------------------------------------------------------------
   Projects
   -------------------------------------------------------------------------- */
// [floorIdx, name, templateId, L, W, H, openings[[type,w,h,qty]], fieldValues{section:{k:v}}]
const DOOR = (w = 0.9, h = 2.2, q = 1) => ['Door', w, h, q];
const WIN = (w, h, q = 1) => ['Window', w, h, q];

const ZED = {
  id: 'prj_demo_zed', code: 'ZED', name: 'ZED EAST', type: 'Villa', client: 'Dr. Ahmed Mokhtar', location: 'ZED East, New Cairo, Egypt',
  description: 'Contemporary family villa on three levels. Warm minimal palette of natural oak, Galala marble and lime plaster. Full interior documentation for tender and site execution.',
  cover: ['#EAE3D6', '#D5C8B3', '#F3EEE5', '#CBBCA5', '#8B7B63'],
  floors: [['Ground Floor', 0, 'GF'], ['First Floor', 1, 'L1'], ['Roof', 2, 'RF']],
  spaces: [
    [0, 'Entrance Hall', 'tpl_entrance', 4.2, 3.0, 3.2, [DOOR(1.4, 2.6), DOOR()], { general: { function: 'Arrival & reception', orientation: 'North', door_type: 'Pivot oak door 1400 × 2600', design_intent: 'Calm, stone-led arrival with a single sculptural pendant.' }, flooring: { ffl: '±0.00', buildup: '20 mm stone on 30 mm screed', pattern: 'Straight grid, 1 mm joints', threshold: 'Flush stone threshold', ufh: 'None' }, ceiling: { ceiling_type: 'Gypsum board', ceiling_level: '+3.20', cornice: '15 mm shadow gap', access: '—' }, lighting: { control: 'Scene control (KNX)', scenes: 'Welcome / Night', emergency: 'Not required' } }],
    [0, 'Living Room', 'tpl_living', 7.2, 5.6, 3.2, [DOOR(1.8, 2.6), WIN(3.6, 2.6), WIN(1.6, 2.6)], { general: { function: 'Family living', occupancy: '6–8', orientation: 'South', tv_wall: 'Fluted oak with concealed media', design_intent: 'Layered, tactile; lime plaster feature wall washed with light.' }, flooring: { ffl: '±0.00', buildup: '14 mm engineered oak on 3 mm underlay', pattern: 'Random length, parallel to glazing', threshold: 'Flush brass strip to marble', ufh: 'None' }, walls: { wall_type: 'Blockwork, gypsum plaster', skirting: '15 mm recessed shadow skirting', feature: 'Marmorino lime plaster, east wall' }, ceiling: { ceiling_type: 'Gypsum board', ceiling_level: '+3.20 / +2.95 cove', cornice: 'Perimeter LED cove', access: '2 no. for AC' }, electrical: { circuit: 'DB-GF / L4–L6', switch_h: '+1.10 m', socket_h: '+0.30 m', data: 2 }, lighting: { control: 'Scene control (KNX)', scenes: 'Day / Evening / Cinema', emergency: 'Not required' }, furniture: { layout_ref: 'ID-GF-201' }, joinery: { joinery_ref: 'JD-GF-301', fabricator: 'Atelier Wood' }, equipment: { hvac: 'Ducted concealed', thermostat: 'By entrance door, +1.50 m' } }],
    [0, 'Dining Room', 'tpl_dining', 5.0, 4.2, 3.2, [DOOR(1.2, 2.6), WIN(2.4, 2.6)], { general: { function: 'Formal dining (8)', orientation: 'South-East' }, flooring: { ffl: '±0.00', buildup: '14 mm engineered oak', pattern: 'Random length', ufh: 'None' }, ceiling: { ceiling_type: 'Gypsum board', ceiling_level: '+3.20' }, lighting: { control: 'Dimmers', scenes: 'Dining / Ambient' } }],
    [0, 'Kitchen', 'tpl_kitchen', 5.2, 4.0, 2.9, [DOOR(), WIN(2.0, 1.4)], { general: { function: 'Show kitchen & family breakfast', orientation: 'East' }, flooring: { ffl: '±0.00', buildup: '9 mm porcelain on adhesive bed', pattern: 'Stack bond, long side to window', threshold: 'Flush', ufh: 'None' }, joinery: { joinery_ref: 'JD-GF-310', fabricator: 'Atelier Wood', worktop: '20 mm Calacatta Oro, honed', splashback: 'Full-height marble' }, equipment: { hvac: 'Split unit', thermostat: '—', extraction: 'Ceiling hood, ducted to roof', gas: 'None' } }],
    [0, 'Guest WC', 'tpl_bathroom', 2.4, 1.8, 2.7, [DOOR(0.8)], { general: { function: 'Guest cloakroom' }, plumbing: { waterproofing: 'Floor + 300mm upstand', wc_type: 'Wall-hung' }, walls: { tile_height: 'Full height' } }],
    [0, 'Ground Corridor', 'tpl_corridor', 6.0, 1.4, 3.0, [DOOR(), DOOR(), DOOR(0.8)], { general: { function: 'Circulation' } }],
    [1, 'Master Bedroom', 'tpl_master', 5.6, 4.8, 3.0, [DOOR(), DOOR(0.8), WIN(2.8, 2.4)], { general: { function: 'Principal bedroom', occupancy: '2', orientation: 'South', bed_wall: 'North wall, centred', design_intent: 'Soft, enveloping; upholstered headboard with integrated reading lights.' }, flooring: { ffl: '+3.45', buildup: '14 mm engineered oak on acoustic underlay', pattern: 'Parallel to bed', threshold: 'Flush oak', ufh: 'None' }, walls: { wall_type: 'Blockwork, gypsum plaster', skirting: '15 mm shadow gap', feature: 'Upholstered bed wall' }, ceiling: { ceiling_type: 'Gypsum board', ceiling_level: '+3.00', cornice: 'Shadow gap', access: '1 no. AC' }, electrical: { circuit: 'DB-L1 / L1–L3', switch_h: '+1.10 m', socket_h: '+0.30 m / bedside +0.60 m', data: 1 }, lighting: { control: 'Scene control (KNX)', scenes: 'Relax / Read / Night path', emergency: 'Not required' }, furniture: { layout_ref: 'ID-L1-201' }, joinery: { joinery_ref: 'JD-L1-301', fabricator: 'Atelier Wood', headboard: 'Full-width upholstered panel 3200 × 1300' }, equipment: { hvac: 'Ducted concealed', thermostat: 'Bedside, +1.10 m' } }],
    [1, 'Master Bathroom', 'tpl_bathroom', 3.6, 3.0, 2.8, [DOOR(0.8), WIN(1.2, 1.0)], { general: { function: 'En-suite', orientation: 'East' }, flooring: { ffl: '+3.43 (−20 mm)', buildup: '20 mm marble, liquid membrane', pattern: 'Book-matched slabs', threshold: 'Marble saddle', ufh: 'Electric' }, walls: { wall_type: 'Cement board on studs', skirting: '—', tile_height: 'Full height in shower, 1.2 m elsewhere' }, ceiling: { ceiling_type: 'Moisture-resistant gypsum', ceiling_level: '+2.80', access: 'Above WC' }, plumbing: { supply: 'Basin ×2, WC, shower, bath', drainage: '1:80 to linear drain', waterproofing: 'Floor + full-height shower walls', wc_type: 'Wall-hung', shower_type: 'Walk-in, thermostatic' }, equipment: { hvac: 'None', extract: 'In-line fan, humidistat' } }],
    [1, 'Dressing Room', 'tpl_dressing', 3.4, 2.6, 3.0, [DOOR(0.8)], { general: { function: 'His & hers dressing' }, joinery: { joinery_ref: 'JD-L1-305', fabricator: 'Atelier Wood', hanging: 'Long 1600 / short 1000' } }],
    [1, 'Bedroom 2', 'tpl_bedroom', 4.4, 3.8, 3.0, [DOOR(), WIN(2.0, 2.4)], { general: { function: 'Guest / child bedroom', orientation: 'West' } }],
    [1, 'Bathroom 2', 'tpl_bathroom', 2.6, 2.0, 2.7, [DOOR(0.8)], { general: { function: 'Family bathroom' }, plumbing: { waterproofing: 'Floor + full-height shower walls', wc_type: 'Wall-hung' } }],
    [1, 'First Corridor', 'tpl_corridor', 7.5, 1.4, 3.0, [DOOR(), DOOR(), DOOR(), DOOR(0.8)], { general: { function: 'Bedroom circulation' } }],
    [2, 'Roof Terrace', 'tpl_outdoor', 8.0, 6.0, 3.0, [DOOR(1.6, 2.4)], { general: { function: 'Outdoor lounge & BBQ', exposure: 'Pergola, partial shade' }, flooring: { ffl: '+7.10', buildup: 'Pedestal-mounted pavers on membrane', drainage_falls: '1:60 to perimeter channel' } }],
  ],
};
const WESAL = {
  id: 'prj_demo_wesal', code: 'WES', name: 'WESAL RESIDENCE', type: 'Apartment', client: 'Eng. Karim Hassan', location: 'Sheikh Zayed City, Giza',
  description: 'Fourth-floor apartment refurbishment. New finishes, lighting and fitted joinery throughout. Documentation in progress.',
  cover: ['#E4E2DC', '#C9C5BC', '#EFEDE8', '#B9B3A8', '#6F6A61'],
  floors: [['Apartment — Level 4', 4, 'L4']],
  spaces: [
    [0, 'Entrance', 'tpl_entrance', 2.6, 2.2, 2.85, [DOOR(1.0, 2.2), DOOR()], { general: { function: 'Lobby' } }],
    [0, 'Living & Dining', 'tpl_living', 8.4, 4.6, 2.85, [DOOR(), WIN(3.0, 2.2), WIN(1.6, 2.2)], { general: { function: 'Open living / dining', orientation: 'North' } }],
    [0, 'Kitchen', 'tpl_kitchen', 3.6, 3.0, 2.7, [DOOR(), WIN(1.2, 1.2)], {}],
    [0, 'Master Bedroom', 'tpl_master', 4.8, 4.0, 2.85, [DOOR(), DOOR(0.8), WIN(2.0, 2.2)], { general: { function: 'Principal bedroom' } }],
    [0, 'Master Bathroom', 'tpl_bathroom', 2.8, 2.2, 2.6, [DOOR(0.8)], {}],
    [0, 'Bedroom', 'tpl_bedroom', 3.8, 3.4, 2.85, [DOOR(), WIN(1.6, 2.2)], {}],
  ],
};
const ALLEGRIA = {
  id: 'prj_demo_allegria', code: 'ALG', name: 'ALLEGRIA SUITE', type: 'Interior Project', client: 'Mr. & Mrs. Fawzy', location: 'Allegria, Sheikh Zayed',
  description: 'Interior fit-out of a guest suite within an existing villa. Concept stage — measurements surveyed, specifications to follow.',
  cover: ['#E9E4DB', '#CFC3B0', '#F1ECE3', '#BFAE95', '#7C6C55'],
  floors: [['Suite Level', 1, 'L1']],
  spaces: [
    [0, 'Suite Lounge', 'tpl_living', 5.4, 4.2, 3.1, [DOOR(), WIN(2.4, 2.4)], { general: { function: 'Private lounge' } }],
    [0, 'Suite Bedroom', 'tpl_master', 5.0, 4.4, 3.1, [DOOR(), DOOR(0.8), WIN(2.4, 2.4)], {}],
    [0, 'Suite Bathroom', 'tpl_bathroom', 3.2, 2.6, 2.8, [DOOR(0.8)], {}],
    [0, 'Suite Dressing', 'tpl_dressing', 2.8, 2.2, 3.1, [DOOR(0.8)], {}],
  ],
};

function buildMeasure(space, L, W, H, openings, { partial = false } = {}) {
  return (s) => {
    const m = s.measure;
    const set = (k, v, source) => { const it = m.items.find((x) => x.key === k); if (it) { it.value = v; it.source = source; } };
    set('floor_area', round(L * W, 2), 'Site survey');
    if (!partial) {
      set('perimeter', round(2 * (L + W), 2), 'Site survey');
      set('ceiling_height', H, 'Laser measurement');
      m.openings = openings.map(([type, w, h, qty], i) => ({ id: `op_${space}_${i}`, type, label: `${type[0]}${i + 1}`, width: w, height: h, qty }));
    }
    for (const it of m.items) if (it.mode === 'formula') it.source = 'Calculated';
  };
}

async function addFile(blob, name, kind, projectId = null) {
  return FileService.add(blob, { name, kind, projectId });
}

/* --------------------------------------------------------------------------
   Public API
   -------------------------------------------------------------------------- */
export async function seedTemplates() {
  for (const t of defaultTemplates()) if (!db.get('templates', t.id)) db.insertMany('templates', [t]);
}

export async function seedLibrary(progress = () => {}) {
  const lib = {};
  let i = 0;
  for (const [key, cat, data, tex] of LIB) {
    const existing = db.find('library', (l) => l.demoKey === key);
    if (existing) { lib[key] = existing; continue; }
    progress(`Library ${++i}/${LIB.length}`);
    const blob = await makeTexture(tex, i + 7);
    const f = await addFile(blob, `${key}_swatch.jpg`, 'image');
    const item = LibraryService.create(cat, { ...data, imageIds: [f.id] });
    db.update('library', item.id, { demoKey: key }, { touch: false });
    lib[key] = db.get('library', item.id);
  }
  return lib;
}

/** Creates the three demonstration projects (skips any that already exist). */
export async function seedDemo(progress = () => {}) {
  await seedTemplates();
  const lib = await seedLibrary(progress);
  for (const P of [ZED, WESAL, ALLEGRIA]) {
    if (db.get('projects', P.id)) continue;
    progress(`Project ${P.name}`);
    await buildProject(P, lib);
  }
  db.setMeta((m) => { m.seededAt = m.seededAt || nowISO(); });
}

async function buildProject(P, lib) {
  const cover = await addFile(await makeCover(P.cover, P.code.length * 7), `${P.code}_cover.jpg`, 'image', P.id);
  const project = ProjectService.create(
    { id: P.id, code: P.code, name: P.name, type: P.type, client: P.client, location: P.location, description: P.description, coverImageId: cover.id },
    { floors: [] },
  );
  const floors = P.floors.map(([name, level, code]) => ProjectService.addFloor(project.id, { name, level, code }));
  const spaces = {};
  const partial = P.id === 'prj_demo_allegria';
  for (const [fi, name, tpl, L, W, H, ops, values] of P.spaces) {
    const s = ProjectService.addSpace(project.id, { floorId: floors[fi].id, name, templateId: tpl });
    ProjectService.mutateSpace(s.id, (x) => {
      buildMeasure(s.id, L, W, H, ops, { partial: partial && name !== 'Suite Bedroom' })(x);
      for (const [sec, kv] of Object.entries(values || {})) {
        const so = x.doc.sections.find((q) => q.key === sec);
        if (so) Object.assign(so.values, kv);
      }
    });
    spaces[name] = db.get('spaces', s.id);
  }
  if (P.id === 'prj_demo_zed') await zedSpecs(project, spaces, lib);
  if (P.id === 'prj_demo_wesal') wesalSpecs(project, spaces, lib);
  if (P.id === 'prj_demo_allegria') allegriaSpecs(project, spaces, lib);
}

// helpers to assign
const M = (key, waste = 0) => ({ qtyMode: 'measure', measureKey: key, wastePct: waste });
const Q = (q, extra = {}) => ({ quantity: q, ...extra });
function assign(spec, space, opt) {
  if (!space) return;
  SpecService.addApplication(spec.id, space.id, { unit: opt.unit || spec.data.unit, ...opt });
}
function many(spec, list) { for (const [space, opt] of list) assign(spec, space, opt); }

async function zedSpecs(p, S, L) {
  const mk = (key, extra = {}) => SpecService.create(p.id, { libraryId: L[key].id, ...extra });
  const fl1 = mk('oak');
  many(fl1, [[S['Living Room'], M('floor_area', 7)], [S['Dining Room'], M('floor_area', 7)], [S['Master Bedroom'], M('floor_area', 7)], [S['Dressing Room'], M('floor_area', 7)], [S['Bedroom 2'], M('floor_area', 7)], [S['First Corridor'], M('floor_area', 7)]]);
  const fl2 = mk('galala');
  many(fl2, [[S['Entrance Hall'], M('floor_area', 5)], [S['Ground Corridor'], M('floor_area', 5)]]);
  const fl3 = mk('porc');
  many(fl3, [[S['Kitchen'], M('floor_area', 8)], [S['Guest WC'], M('floor_area', 10)], [S['Bathroom 2'], M('floor_area', 10)]]);
  const fl4 = mk('calacatta', { discipline: 'flooring' });
  many(fl4, [[S['Master Bathroom'], M('floor_area', 12)]]);
  const fl5 = mk('travertine');
  many(fl5, [[S['Roof Terrace'], M('floor_area', 5)]]);
  const sk = SpecService.create(p.id, { discipline: 'general', data: { name: 'Recessed Aluminium Shadow Skirting', manufacturer: 'Profilpas', reference: 'PP-SHD-15', dimensions: '15 × 60 mm', colour: 'Anodised natural', finish: 'Anodised', description: 'Flush shadow-gap skirting profile, plaster-in.', unit: 'lm', unitPrice: 240 } });
  many(sk, ['Living Room', 'Dining Room', 'Master Bedroom', 'Dressing Room', 'Bedroom 2', 'First Corridor', 'Entrance Hall', 'Ground Corridor'].map((n) => [S[n], { ...M('skirting_length', 5), unit: 'lm' }]));

  const wl1 = mk('p_timeless');
  many(wl1, ['Living Room', 'Dining Room', 'Kitchen', 'Master Bedroom', 'Ground Corridor', 'First Corridor', 'Entrance Hall'].map((n) => [S[n], M('net_wall_area', 10)]));
  const wl2 = mk('p_grey');
  many(wl2, [[S['Bedroom 2'], M('net_wall_area', 10)], [S['Dressing Room'], M('net_wall_area', 10)]]);
  const wl3 = mk('marmorino');
  many(wl3, [[S['Living Room'], Q(17.9, { location: 'East feature wall' })], [S['Entrance Hall'], Q(9.6, { location: 'Wall facing door' })]]);
  const wl4 = mk('zellige');
  many(wl4, [[S['Master Bathroom'], Q(18.5, { location: 'Shower full height + vanity wall' })], [S['Bathroom 2'], Q(12.4)], [S['Guest WC'], M('net_wall_area', 12)]]);
  const wl5 = mk('fluted');
  many(wl5, [[S['Living Room'], Q(9.2, { location: 'TV wall' })]]);

  const cl1 = mk('p_ceiling', { discipline: 'ceiling' });
  many(cl1, ['Entrance Hall', 'Living Room', 'Dining Room', 'Kitchen', 'Ground Corridor', 'Master Bedroom', 'Dressing Room', 'Bedroom 2', 'First Corridor'].map((n) => [S[n], M('ceiling_area', 5)]));
  const cl2 = SpecService.create(p.id, { discipline: 'ceiling', data: { name: 'Moisture-resistant Gypsum Ceiling', manufacturer: 'Knauf', brand: 'Knauf Aquapanel / MR board', reference: 'KN-MR-12.5', dimensions: '12.5 mm on MF grid', colour: '9918 Classic White', colourHex: '#F3F1EA', finish: 'Anti-mould matt', description: 'Custom project spec: MR board, taped & skimmed, painted.', unit: 'm²', unitPrice: 690 } });
  many(cl2, ['Master Bathroom', 'Bathroom 2', 'Guest WC'].map((n) => [S[n], M('ceiling_area', 5)]));

  const e = (k) => mk(k);
  const el1 = e('sock2'), el2 = e('sock1'), el3 = e('sw1'), el4 = e('dim'), el5 = e('data'), el6 = e('usb');
  const elec = {
    'Entrance Hall': [[el2, 1], [el3, 2], [el4, 1]],
    'Living Room': [[el1, 6], [el2, 2], [el4, 3], [el5, 2]],
    'Dining Room': [[el1, 2], [el4, 1]],
    'Kitchen': [[el1, 5], [el2, 4], [el3, 2]],
    'Guest WC': [[el3, 1]],
    'Ground Corridor': [[el3, 3], [el2, 1]],
    'Master Bedroom': [[el1, 4], [el2, 2], [el3, 2], [el4, 2], [el5, 1], [el6, 2]],
    'Master Bathroom': [[el2, 1], [el3, 2]],
    'Dressing Room': [[el2, 1], [el3, 1]],
    'Bedroom 2': [[el1, 3], [el3, 2], [el6, 2]],
    'Bathroom 2': [[el3, 1]],
    'First Corridor': [[el3, 3]],
    'Roof Terrace': [[el2, 2]],
  };
  for (const [n, list] of Object.entries(elec)) for (const [spec, q] of list) assign(spec, S[n], Q(q));

  const lt1 = e('dl'), lt2 = e('pendant'), lt3 = e('strip'), lt4 = e('dl65'), lt5 = e('washer'), lt6 = e('outwall');
  const light = {
    'Entrance Hall': [[lt1, 4], [lt2, 1]],
    'Living Room': [[lt1, 12], [lt3, 25.6, 'm'], [lt5, 4]],
    'Dining Room': [[lt1, 6], [lt2, 3]],
    'Kitchen': [[lt1, 8], [lt3, 6.4, 'm']],
    'Guest WC': [[lt4, 2]],
    'Ground Corridor': [[lt1, 5]],
    'Master Bedroom': [[lt1, 8], [lt3, 3.2, 'm']],
    'Master Bathroom': [[lt4, 6], [lt3, 1.8, 'm']],
    'Dressing Room': [[lt1, 4], [lt3, 7.2, 'm']],
    'Bedroom 2': [[lt1, 6]],
    'Bathroom 2': [[lt4, 3]],
    'First Corridor': [[lt1, 6]],
    'Roof Terrace': [[lt6, 6]],
  };
  for (const [n, list] of Object.entries(light)) for (const [spec, q, unit] of list) assign(spec, S[n], Q(q, unit ? { unit } : {}));

  const fn1 = mk('sofa'); assign(fn1, S['Living Room'], Q(1));
  const fn2 = mk('dchair'); assign(fn2, S['Dining Room'], Q(8));
  const fn3 = SpecService.create(p.id, { discipline: 'furniture', data: { name: 'Dining Table Ø1600, Oak & Travertine', manufacturer: 'Atelier Wood (custom)', reference: 'ZED-FN-DT', dimensions: 'Ø1600 × 750 mm', colour: 'Natural oak / travertine', colourHex: '#C4A988', finish: 'Hard-wax oil; honed stone', description: 'Custom round table with travertine top on solid oak pedestal.', attrs: { material: 'Solid oak, travertine', fabricator: 'Atelier Wood', custom: 'Custom-made' }, unit: 'pcs', unitPrice: 165000, imageIds: [(await addFile(await makeTexture({ t: 'product', draw: 'table' }, 51), 'dining_table.jpg', 'image', p.id)).id] } });
  assign(fn3, S['Dining Room'], Q(1));
  const fn4 = SpecService.create(p.id, { discipline: 'furniture', data: { name: 'King Bed with Upholstered Headboard', manufacturer: 'Atelier Wood (custom)', reference: 'ZED-FN-BED', dimensions: '2000 × 2200 mm mattress zone', colour: 'Oat linen', colourHex: '#D9CFBF', finish: 'Linen-blend upholstery', description: 'Platform bed, integrated with full-width headboard panel.', attrs: { material: 'Upholstered MDF frame', fabricator: 'Atelier Wood', custom: 'Custom-made' }, unit: 'pcs', unitPrice: 210000, imageIds: [(await addFile(await makeTexture({ t: 'product', draw: 'bed' }, 52), 'king_bed.jpg', 'image', p.id)).id] } });
  assign(fn4, S['Master Bedroom'], Q(1));
  const fn5 = SpecService.create(p.id, { discipline: 'furniture', data: { name: 'Bedside Table, Walnut', manufacturer: 'Atelier Wood (custom)', reference: 'ZED-FN-BS', dimensions: '550 × 400 × 450 mm', colour: 'Walnut', colourHex: '#5E4130', finish: 'Satin lacquer', description: 'One drawer, push-to-open.', attrs: { material: 'Walnut veneer', fabricator: 'Atelier Wood', custom: 'Custom-made' }, unit: 'pcs', unitPrice: 26000, imageIds: [(await addFile(await makeTexture({ t: 'product', draw: 'bedside' }, 53), 'bedside.jpg', 'image', p.id)).id] } });
  many(fn5, [[S['Master Bedroom'], Q(2)], [S['Bedroom 2'], Q(2)]]);

  const jImg = async (d, n) => (await addFile(await makeTexture({ t: 'product', draw: d, bg: '#EAE3D6' }, n), `${d}.jpg`, 'image', p.id)).id;
  const jn1 = SpecService.create(p.id, { discipline: 'joinery', data: { name: 'Master Wardrobe, Full Height', manufacturer: 'Atelier Wood', reference: 'JD-L1-305', dimensions: '3400 × 650 × 3000 mm', colour: 'Natural oak / bronze glass', colourHex: '#C49A68', finish: 'Matt lacquer', description: 'Floor-to-ceiling wardrobe wall with glazed hanging section and integrated lighting.', attrs: { material: '18 mm MR MDF carcass, oak veneer fronts', fabricator: 'Atelier Wood', elevations: 'JD-L1-305 / E1–E3', sections: 'JD-L1-305 / S1–S2', internal: 'Long hang 1600 ×2, short hang ×2, 12 drawers, shoe rack, jewellery tray', hardware: 'Blum TIP-ON, LEGRABOX drawers, recessed brass pulls', edges: '1 mm solid oak lipping, 3 mm reveal between doors', finishSpec: 'Oak veneer crown cut, book-matched, matt PU lacquer 10 gloss' }, unit: 'set', unitPrice: 340000, imageIds: [await jImg('wardrobe', 61)] } });
  assign(jn1, S['Dressing Room'], Q(1));
  const jn2 = SpecService.create(p.id, { discipline: 'joinery', data: { name: 'Kitchen Cabinetry', manufacturer: 'Atelier Wood', reference: 'JD-GF-310', dimensions: 'L-shape 5.0 m + island 2.8 m', colour: 'Grigio Londra / oak', colourHex: '#8B8781', finish: 'FENIX NTM super-matt', description: 'Handle-less kitchen with tall appliance wall and island.', attrs: { material: '18 mm MR MDF carcass', fabricator: 'Atelier Wood', elevations: 'JD-GF-310 / E1–E4', sections: 'JD-GF-310 / S1–S3', internal: 'Pull-outs, waste sorter, cutlery inserts', hardware: 'Blum LEGRABOX, SERVO-DRIVE', edges: 'Laser edge, 1 mm', finishSpec: 'FENIX NTM 0718 fronts; Calacatta worktop by others' }, unit: 'set', unitPrice: 520000, imageIds: [await jImg('kitchen', 62)] } });
  assign(jn2, S['Kitchen'], Q(1));
  const jn3 = SpecService.create(p.id, { discipline: 'joinery', data: { name: 'Double Vanity Unit, Walnut', manufacturer: 'Atelier Wood', reference: 'JD-L1-320', dimensions: '1800 × 550 × 500 mm', colour: 'Walnut', colourHex: '#5E4130', finish: 'Marine lacquer', description: 'Wall-hung vanity with marble top and mirror cabinet.', attrs: { material: 'MR MDF, walnut veneer', fabricator: 'Atelier Wood', elevations: 'JD-L1-320 / E1', sections: 'JD-L1-320 / S1', internal: '2 deep drawers, U-cut for trap', hardware: 'Blum TIP-ON BLUMOTION', edges: 'Solid walnut lipping', finishSpec: 'Waterproof PU lacquer, 3 coats' }, unit: 'set', unitPrice: 95000, imageIds: [await jImg('vanity', 63)] } });
  assign(jn3, S['Master Bathroom'], Q(1));
  const jn4 = SpecService.create(p.id, { discipline: 'joinery', data: { name: 'Media Wall Unit', manufacturer: 'Atelier Wood', reference: 'JD-GF-301', dimensions: '4200 × 450 × 3200 mm', colour: 'Natural oak', colourHex: '#B98F5E', finish: 'Matt lacquer', description: 'Fluted oak media wall with concealed storage and AV.', attrs: { material: 'MR MDF, oak', fabricator: 'Atelier Wood', elevations: 'JD-GF-301 / E1', sections: 'JD-GF-301 / S1–S2', internal: 'AV rack, cable management, ventilated', hardware: 'Push latches', edges: 'Mitred', finishSpec: 'Oak, matt lacquer' }, unit: 'set', unitPrice: 230000, imageIds: [await jImg('tvwall', 64)] } });
  assign(jn4, S['Living Room'], Q(1));

  const sn = (k) => mk(k);
  const sn1 = sn('wc'), sn2 = sn('basin'), sn3 = sn('mixer'), sn4 = sn('shower'), sn5 = sn('tub'), sn6 = sn('cistern');
  many(sn1, [[S['Master Bathroom'], Q(1)], [S['Bathroom 2'], Q(1)], [S['Guest WC'], Q(1)]]);
  many(sn6, [[S['Master Bathroom'], Q(1)], [S['Bathroom 2'], Q(1)], [S['Guest WC'], Q(1)]]);
  many(sn2, [[S['Master Bathroom'], Q(2)], [S['Bathroom 2'], Q(1)], [S['Guest WC'], Q(1)]]);
  many(sn3, [[S['Master Bathroom'], Q(2)], [S['Bathroom 2'], Q(1)], [S['Guest WC'], Q(1)]]);
  many(sn4, [[S['Master Bathroom'], Q(1)], [S['Bathroom 2'], Q(1)]]);
  assign(sn5, S['Master Bathroom'], Q(1));

  const eq = (k) => mk(k);
  const eq1 = eq('oven'), eq2 = eq('hob'), eq3 = eq('fridge'), eq4 = eq('hood'), eq5 = eq('ac');
  for (const s of [eq1, eq2, eq3, eq4]) assign(s, S['Kitchen'], Q(1));
  many(eq5, [[S['Living Room'], Q(2)], [S['Dining Room'], Q(1)], [S['Master Bedroom'], Q(1)], [S['Bedroom 2'], Q(1)], [S['Entrance Hall'], Q(1)]]);

  // Status history & a real revision trail
  SpecService.setStatus(fl1.id, 'submitted', { note: 'Sample board issued to client.' });
  const evidence = await addFile(new Blob([`APPROVAL RECORD\n\nProject: ZED EAST\nItem: ZED-FL-01 Natural Oak Engineered Plank\nApproved by: Dr. Ahmed Mokhtar\nMethod: Physical sample sign-off at YAM studio\n`], { type: 'text/plain' }), 'ZED-FL-01_client_approval.txt', 'approval', p.id);
  SpecService.setStatus(fl1.id, 'approved', { note: 'Approved by client on sample board.', fileIds: [evidence.id] });
  for (const s of [fl2, fl4, wl3, cl1, el1, el2, el3, lt1, sn1, sn6, jn2]) { SpecService.setStatus(s.id, 'submitted'); SpecService.setStatus(s.id, 'approved', { note: 'Approved at design review DR-03.' }); }
  for (const s of [fl3, lt2, lt3, fn1, fn2, jn1, sn2, sn3]) SpecService.setStatus(s.id, 'submitted', { note: 'Issued for client review.' });
  SpecService.setStatus(wl2.id, 'submitted');
  SpecService.setStatus(wl2.id, 'rejected', { note: 'Client prefers a warmer grey — propose alternatives.' });
  // Approved wall paint revised: colour changed → R01 draft, R00 preserved
  SpecService.setStatus(wl1.id, 'submitted');
  SpecService.setStatus(wl1.id, 'approved', { note: 'Approved with sample patch on site.' });
  const d = { ...db.get('specs', wl1.id).data, colour: '1024 Timeless (+10% warm tint)', colourHex: '#E6DDCD', reference: 'JOT-1024-WT' };
  SpecService.updateData(wl1.id, d, { reason: 'Client requested slightly warmer white after site mock-up.' });
  SpecService.setStatus(wl1.id, 'submitted', { note: 'R01 issued for approval.' });

  // Drawings & reference images
  for (const n of ['Master Bedroom', 'Master Bathroom', 'Living Room', 'Kitchen']) {
    const s = S[n];
    const res = s.measure.items;
    const fa = res.find((x) => x.key === 'floor_area').value;
    const sp = ZED.spaces.find((x) => x[1] === n);
    const dwg = await addFile(await makePlanDrawing(n, sp[3], sp[4]), `${s.code}_${n.replace(/\s+/g, '_')}_plan.png`, 'drawing', p.id);
    ProjectService.mutateSpace(s.id, (x) => { x.measure.drawingIds = [dwg.id]; x.fileIds = [...(x.fileIds || []), dwg.id]; });
    void fa;
  }
  const mbRef = await addFile(await makeTexture({ t: 'plaster', color: '#D9CDBA' }, 71), 'master_bedroom_mood.jpg', 'image', p.id);
  ProjectService.mutateSpace(S['Master Bedroom'].id, (x) => { x.coverImageId = mbRef.id; x.fileIds.push(mbRef.id); });
  const lvRef = await addFile(await makeTexture({ t: 'fluted', color: '#B98F5E' }, 72), 'living_media_wall_ref.jpg', 'image', p.id);
  ProjectService.mutateSpace(S['Living Room'].id, (x) => { x.coverImageId = lvRef.id; x.fileIds.push(lvRef.id); });
  const brief = await addFile(new Blob(['ZED EAST — Client brief (summary)\n\n• Warm minimal, natural materials\n• Family of five, frequent guests\n• Low-maintenance finishes in wet areas\n'], { type: 'text/plain' }), 'ZED_client_brief.txt', 'document', p.id);
  ProjectService.addProjectFiles(p.id, [brief.id]);
}

function wesalSpecs(p, S, L) {
  const mk = (key, extra = {}) => SpecService.create(p.id, { libraryId: L[key].id, ...extra });
  const fl1 = mk('oak_hb');
  many(fl1, [[S['Living & Dining'], M('floor_area', 8)], [S['Master Bedroom'], M('floor_area', 8)], [S['Bedroom'], M('floor_area', 8)]]);
  const fl2 = mk('porc');
  many(fl2, [[S['Kitchen'], M('floor_area', 8)], [S['Master Bathroom'], M('floor_area', 10)], [S['Entrance'], M('floor_area', 8)]]);
  const wl1 = mk('p_grey');
  many(wl1, ['Living & Dining', 'Master Bedroom', 'Bedroom', 'Entrance'].map((n) => [S[n], M('net_wall_area', 10)]));
  const cl1 = mk('p_ceiling', { discipline: 'ceiling' });
  many(cl1, ['Living & Dining', 'Master Bedroom', 'Bedroom', 'Entrance', 'Kitchen'].map((n) => [S[n], M('ceiling_area', 5)]));
  const lt = mk('dl');
  many(lt, [[S['Living & Dining'], Q(14)], [S['Master Bedroom'], Q(6)], [S['Kitchen'], Q(6)]]);
  const el = mk('sock2');
  many(el, [[S['Living & Dining'], Q(6)], [S['Master Bedroom'], Q(3)]]);
  SpecService.setStatus(fl1.id, 'submitted');
}

function allegriaSpecs(p, S, L) {
  const fl = SpecService.create(p.id, { libraryId: L['v_walnut'].id, discipline: 'flooring', data: { name: 'Walnut Engineered Plank (proposed)', unit: 'm²' } });
  assign(fl, S['Suite Bedroom'], M('floor_area', 7));
  const st = SpecService.create(p.id, { libraryId: L['calacatta'].id });
  assign(st, S['Suite Bathroom'], M('floor_area', 12));
}
