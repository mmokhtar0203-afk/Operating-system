// Default global room templates. A template defines which sections are enabled and which
// documentation fields each section asks for. Spaces receive a *copy* (snapshot) at creation.
import { SECTIONS } from './models.js';

const F = (key, label, type = 'text', extra = {}) => ({ key, label, type, ...extra });

/** Field building blocks per section. */
export const FIELD_BANK = {
  general: [
    F('function', 'Room function'),
    F('occupancy', 'Occupancy / users'),
    F('orientation', 'Orientation', 'select', { options: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West', 'Internal'] }),
    F('design_intent', 'Design intent', 'textarea', { wide: true }),
  ],
  flooring: [
    F('ffl', 'Finished floor level (FFL)'),
    F('buildup', 'Floor build-up'),
    F('pattern', 'Laying pattern'),
    F('threshold', 'Threshold detail'),
    F('ufh', 'Underfloor heating', 'select', { options: ['None', 'Electric', 'Hydronic'] }),
  ],
  walls: [
    F('wall_type', 'Wall construction'),
    F('skirting', 'Skirting detail'),
    F('feature', 'Feature wall'),
  ],
  ceiling: [
    F('ceiling_type', 'Ceiling type', 'select', { options: ['Gypsum board', 'Moisture-resistant gypsum', 'Exposed slab', 'Acoustic panels', 'Wood slats', 'Stretch ceiling', 'Pergola / open'] }),
    F('ceiling_level', 'Ceiling level'),
    F('cornice', 'Cornice / shadow gap'),
    F('access', 'Access panels'),
  ],
  electrical: [
    F('circuit', 'DB / circuit reference'),
    F('switch_h', 'Switch height'),
    F('socket_h', 'Socket height'),
    F('data', 'Data / TV points', 'number'),
  ],
  lighting: [
    F('control', 'Lighting control', 'select', { options: ['Manual switching', 'Dimmers', 'Scene control (KNX)', 'DALI', 'Casambi / Bluetooth', 'Motion sensor'] }),
    F('scenes', 'Scenes / circuits'),
    F('emergency', 'Emergency lighting', 'select', { options: ['Not required', 'Required'] }),
  ],
  furniture: [
    F('layout_ref', 'Layout drawing ref.'),
    F('loose_notes', 'Loose furniture notes', 'textarea', { wide: true }),
  ],
  joinery: [
    F('joinery_ref', 'Joinery drawing ref.'),
    F('fabricator', 'Preferred fabricator'),
  ],
  plumbing: [
    F('supply', 'Water supply points'),
    F('drainage', 'Drainage / falls'),
    F('waterproofing', 'Waterproofing', 'select', { options: ['Not required', 'Floor only', 'Floor + 300mm upstand', 'Floor + full-height shower walls', 'Full room'] }),
  ],
  equipment: [
    F('hvac', 'HVAC type', 'select', { options: ['Split unit', 'Ducted concealed', 'VRF cassette', 'Underfloor', 'None'] }),
    F('thermostat', 'Thermostat location'),
  ],
  documents: [],
};

const ALL_ON = SECTIONS.map((s) => s.key);

function build(id, name, enabled, extraFields = {}, description = '') {
  return {
    id, name, description, version: 1, builtIn: true,
    sections: SECTIONS.map((s) => ({
      key: s.key,
      enabled: enabled.includes(s.key),
      fields: [...(FIELD_BANK[s.key] || []), ...(extraFields[s.key] || [])].map((f) => ({ ...f })),
    })),
    customMeasures: [],
  };
}

export function defaultTemplates() {
  return [
    build('tpl_bedroom', 'Bedroom', ALL_ON.filter((k) => !['plumbing'].includes(k)), {}, 'Standard secondary bedroom.'),
    build('tpl_master', 'Master Bedroom', ALL_ON.filter((k) => k !== 'plumbing'), {
      general: [F('bed_wall', 'Bed wall orientation')],
      joinery: [F('headboard', 'Headboard detail')],
    }, 'Principal suite bedroom with feature headboard and integrated joinery.'),
    build('tpl_bathroom', 'Bathroom', ALL_ON.filter((k) => !['furniture'].includes(k)), {
      walls: [F('tile_height', 'Tiling height')],
      plumbing: [F('wc_type', 'WC type', 'select', { options: ['Wall-hung', 'Floor-standing', 'Back-to-wall'] }), F('shower_type', 'Shower type')],
      equipment: [F('extract', 'Extract fan')],
    }, 'Wet room / bathroom with sanitaryware and waterproofing.'),
    build('tpl_kitchen', 'Kitchen', ALL_ON, {
      joinery: [F('worktop', 'Worktop'), F('splashback', 'Splashback')],
      equipment: [F('extraction', 'Cooker extraction'), F('gas', 'Gas supply', 'select', { options: ['None', 'Natural gas', 'LPG'] })],
    }, 'Kitchen with joinery, appliances and services.'),
    build('tpl_living', 'Living Room', ALL_ON.filter((k) => k !== 'plumbing'), {
      general: [F('tv_wall', 'Media wall')],
    }),
    build('tpl_dining', 'Dining Room', ALL_ON.filter((k) => k !== 'plumbing')),
    build('tpl_dressing', 'Dressing Room', ALL_ON.filter((k) => !['plumbing', 'equipment'].includes(k)), {
      joinery: [F('hanging', 'Hanging length (long / short)')],
    }),
    build('tpl_corridor', 'Corridor', ['general', 'measurements', 'flooring', 'walls', 'ceiling', 'electrical', 'lighting', 'documents']),
    build('tpl_entrance', 'Entrance', ['general', 'measurements', 'flooring', 'walls', 'ceiling', 'electrical', 'lighting', 'furniture', 'joinery', 'documents'], {
      general: [F('door_type', 'Entrance door type')],
    }),
    build('tpl_outdoor', 'Outdoor Space', ['general', 'measurements', 'flooring', 'walls', 'ceiling', 'electrical', 'lighting', 'furniture', 'plumbing', 'documents'], {
      flooring: [F('drainage_falls', 'Falls to drainage')],
      general: [F('exposure', 'Exposure / shading')],
    }),
  ];
}
