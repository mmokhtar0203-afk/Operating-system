// Domain vocabulary and record factories. No storage or UI code here.
import { uid, nowISO } from '../core/utils.js';

/** The 12 standard room documentation sections. `discipline` links a section to project specifications. */
export const SECTIONS = [
  { key: 'general', label: 'General Information', icon: 'info' },
  { key: 'measurements', label: 'Measurements', icon: 'ruler' },
  { key: 'flooring', label: 'Flooring', icon: 'floor', discipline: 'flooring' },
  { key: 'walls', label: 'Walls', icon: 'wall', discipline: 'walls' },
  { key: 'ceiling', label: 'Ceiling', icon: 'ceiling', discipline: 'ceiling' },
  { key: 'electrical', label: 'Electrical', icon: 'plug', discipline: 'electrical' },
  { key: 'lighting', label: 'Lighting', icon: 'bulb', discipline: 'lighting' },
  { key: 'furniture', label: 'Furniture', icon: 'sofa', discipline: 'furniture' },
  { key: 'joinery', label: 'Joinery', icon: 'cabinet', discipline: 'joinery' },
  { key: 'plumbing', label: 'Plumbing', icon: 'drop', discipline: 'plumbing' },
  { key: 'equipment', label: 'Equipment', icon: 'box', discipline: 'equipment' },
  { key: 'documents', label: 'Documents', icon: 'file' },
];
export const SECTION_MAP = Object.fromEntries(SECTIONS.map((s, i) => [s.key, { ...s, num: String(i + 1).padStart(2, '0') }]));

/** Specification disciplines — drive project codes (ZED-FL-01), room sections and schedules. */
export const DISCIPLINES = {
  flooring:   { label: 'Flooring',            prefix: 'FL', unit: 'm²',  section: 'flooring' },
  walls:      { label: 'Wall Finish',         prefix: 'WL', unit: 'm²',  section: 'walls' },
  ceiling:    { label: 'Ceiling',             prefix: 'CL', unit: 'm²',  section: 'ceiling' },
  electrical: { label: 'Electrical',          prefix: 'EL', unit: 'pcs', section: 'electrical', profile: 'electrical' },
  lighting:   { label: 'Lighting',            prefix: 'LT', unit: 'pcs', section: 'lighting', profile: 'lighting' },
  furniture:  { label: 'Furniture',           prefix: 'FN', unit: 'pcs', section: 'furniture', profile: 'furniture' },
  joinery:    { label: 'Joinery',             prefix: 'JN', unit: 'set', section: 'joinery', profile: 'joinery' },
  plumbing:   { label: 'Sanitaryware & Plumbing', prefix: 'SN', unit: 'pcs', section: 'plumbing' },
  equipment:  { label: 'Equipment',           prefix: 'EQ', unit: 'pcs', section: 'equipment' },
  general:    { label: 'General Material',    prefix: 'GN', unit: 'm²',  section: 'general' },
};
export const DISCIPLINE_KEYS = Object.keys(DISCIPLINES);

/** Project-wide schedules, generated from specs + space applications. */
export const SCHEDULES = [
  { key: 'floor',      label: 'Floor Finish Schedule',  disciplines: ['flooring'] },
  { key: 'wall',       label: 'Wall Finish Schedule',   disciplines: ['walls'] },
  { key: 'ceiling',    label: 'Ceiling Schedule',       disciplines: ['ceiling'] },
  { key: 'electrical', label: 'Electrical Schedule',    disciplines: ['electrical'] },
  { key: 'lighting',   label: 'Lighting Schedule',      disciplines: ['lighting'] },
  { key: 'furniture',  label: 'Furniture Schedule',     disciplines: ['furniture'] },
  { key: 'joinery',    label: 'Joinery Schedule',       disciplines: ['joinery'] },
  { key: 'sanitary',   label: 'Sanitaryware Schedule',  disciplines: ['plumbing'] },
  { key: 'equipment',  label: 'Equipment Schedule',     disciplines: ['equipment'] },
  { key: 'general',    label: 'General Material Schedule', disciplines: DISCIPLINE_KEYS },
];
export const SCHEDULE_MAP = Object.fromEntries(SCHEDULES.map((s) => [s.key, s]));

export const UNITS = ['m²', 'm', 'lm', 'm³', 'pcs', 'set', 'kg', 'litre', 'box', 'roll', 'pair', 'lot'];

/** Global library categories. kind → code series (MAT / PRD). */
export const LIB_CATEGORIES = [
  { key: 'flooring',   label: 'Flooring',               kind: 'material', discipline: 'flooring' },
  { key: 'wall',       label: 'Wall Finishes',          kind: 'material', discipline: 'walls' },
  { key: 'paint',      label: 'Paint',                  kind: 'material', discipline: 'walls' },
  { key: 'tiles',      label: 'Tiles',                  kind: 'material', discipline: 'flooring' },
  { key: 'stone',      label: 'Marble & Stone',         kind: 'material', discipline: 'flooring' },
  { key: 'wood',       label: 'Wood & Veneer',          kind: 'material', discipline: 'joinery' },
  { key: 'lighting',   label: 'Lighting',               kind: 'product',  discipline: 'lighting', profile: 'lighting' },
  { key: 'electrical', label: 'Electrical Accessories', kind: 'product',  discipline: 'electrical', profile: 'electrical' },
  { key: 'sanitary',   label: 'Sanitaryware',           kind: 'product',  discipline: 'plumbing' },
  { key: 'furniture',  label: 'Furniture',              kind: 'product',  discipline: 'furniture', profile: 'furniture' },
  { key: 'joinery',    label: 'Joinery Materials',      kind: 'material', discipline: 'joinery' },
  { key: 'hardware',   label: 'Hardware',               kind: 'product',  discipline: 'joinery' },
  { key: 'appliances', label: 'Appliances',             kind: 'product',  discipline: 'equipment' },
];
export const LIB_CAT_MAP = Object.fromEntries(LIB_CATEGORIES.map((c) => [c.key, c]));

/** Discipline-specific technical attributes. */
export const ATTR_PROFILES = {
  lighting: [
    { key: 'wattage', label: 'Wattage', unit: 'W', type: 'number' },
    { key: 'cct', label: 'Colour temperature', unit: 'K', type: 'number' },
    { key: 'beam', label: 'Beam angle', unit: '°', type: 'number' },
    { key: 'cri', label: 'CRI', type: 'text' },
    { key: 'ip', label: 'IP rating', type: 'text' },
    { key: 'lumens', label: 'Luminous flux', unit: 'lm', type: 'number' },
    { key: 'dimming', label: 'Dimming', type: 'select', options: ['Non-dimmable', 'Phase-cut (TRIAC)', '0–10V', 'DALI', 'DALI DT8 (tunable)', 'Casambi / Bluetooth'] },
  ],
  electrical: [
    { key: 'type', label: 'Type', type: 'text' },
    { key: 'voltage', label: 'Voltage', unit: 'V', type: 'number' },
    { key: 'amperage', label: 'Amperage', unit: 'A', type: 'number' },
    { key: 'gangs', label: 'Gangs / modules', type: 'text' },
    { key: 'ip', label: 'IP rating', type: 'text' },
    { key: 'mounting', label: 'Mounting height', type: 'text' },
    { key: 'install', label: 'Installation notes', type: 'textarea' },
  ],
  furniture: [
    { key: 'material', label: 'Material', type: 'text' },
    { key: 'fabricator', label: 'Fabricator', type: 'text' },
    { key: 'custom', label: 'Build type', type: 'select', options: ['Standard (catalogue)', 'Custom-made'] },
  ],
  joinery: [
    { key: 'material', label: 'Carcass material', type: 'text' },
    { key: 'fabricator', label: 'Fabricator', type: 'text' },
    { key: 'elevations', label: 'Elevations', type: 'textarea' },
    { key: 'sections', label: 'Sections', type: 'textarea' },
    { key: 'internal', label: 'Internal configuration', type: 'textarea' },
    { key: 'hardware', label: 'Hardware', type: 'textarea' },
    { key: 'edges', label: 'Edge details', type: 'textarea' },
    { key: 'finishSpec', label: 'Finish specification', type: 'textarea' },
  ],
};

export const SPEC_STATUSES = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

/** Standard measurement set. Formulas reference other keys with {key}; builtins: openings_total, door_widths. */
export const MEASURE_DEFS = [
  { key: 'floor_area', label: 'Floor area', unit: 'm²', mode: 'manual' },
  { key: 'ceiling_area', label: 'Ceiling area', unit: 'm²', mode: 'formula', formula: '{floor_area}' },
  { key: 'perimeter', label: 'Room perimeter', unit: 'lm', mode: 'manual' },
  { key: 'ceiling_height', label: 'Ceiling height', unit: 'm', mode: 'manual' },
  { key: 'gross_wall_area', label: 'Gross wall area', unit: 'm²', mode: 'formula', formula: '{perimeter} * {ceiling_height}' },
  { key: 'openings_area', label: 'Openings area', unit: 'm²', mode: 'formula', formula: '{openings_total}' },
  { key: 'net_wall_area', label: 'Net wall area', unit: 'm²', mode: 'formula', formula: '{gross_wall_area} - {openings_area}' },
  { key: 'skirting_length', label: 'Skirting length', unit: 'lm', mode: 'formula', formula: '{perimeter} - {door_widths}' },
];
export const CORE_MEASURE_KEYS = MEASURE_DEFS.map((m) => m.key);
export const MEASURE_SOURCES = ['Site survey', 'Laser measurement', 'Architectural drawing', 'Shop drawing', 'Calculated', 'Estimated', 'Client brief'];
export const OPENING_TYPES = ['Door', 'Window', 'Opening', 'Glazed screen'];

export const FILE_KINDS = {
  image: 'Reference image',
  drawing: 'Drawing',
  datasheet: 'Datasheet',
  document: 'Document',
  approval: 'Approval evidence',
};

export const PROJECT_TYPES = ['Villa', 'Apartment', 'Interior Project', 'Townhouse', 'Penthouse', 'Duplex', 'Chalet', 'Office'];
export const CURRENCIES = ['EGP', 'USD', 'EUR', 'AED', 'SAR', 'GBP'];

/* ---------- Record factories ---------- */
export function newMeasureSet() {
  return {
    items: MEASURE_DEFS.map((d) => ({
      key: d.key, label: d.label, unit: d.unit, mode: d.mode, formula: d.formula || '',
      value: null, source: '', notes: '', override: null, core: true,
    })),
    openings: [],
    drawingIds: [],
    updatedAt: nowISO(),
  };
}

export function newSpecData(over = {}) {
  return {
    name: '', category: '', manufacturer: '', brand: '', reference: '', dimensions: '', colour: '', colourHex: '',
    finish: '', description: '', attrs: {}, specs: [], supplier: { name: '', contact: '', phone: '', email: '', website: '' },
    unit: '', unitPrice: null, currency: '', notes: '', imageIds: [], datasheetIds: [], drawingIds: [],
    ...over,
  };
}

export function newProject(over = {}) {
  return {
    id: uid('prj'), code: '', name: '', type: 'Villa', client: '', location: '', description: '',
    coverImageId: null, status: 'active', fileIds: [], startedAt: nowISO(), ...over,
  };
}
