/**
 * Human Design Canonical Data Tables
 * Version-controlled, immutable reference data for the HD calculation engine.
 * Based on the Ra Uru Hu / Jovian Archive standard.
 */

// ─── Gate Wheel Sequence ─────────────────────────────────────────────────────
// The 64 gates arranged around the ecliptic in HD mandala order.
// Gate 41 starts at 328.125° ecliptic longitude.
// Each gate spans exactly 5.625° (360 / 64).

const GATE_SEQUENCE = [
  41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
  27, 24,  2, 23,  8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
  31, 33,  7,  4, 29, 59, 40, 64, 47,  6, 46, 18, 48, 57, 32, 50,
  28, 44,  1, 43, 14, 34,  9,  5, 26, 11, 10, 58, 38, 54, 61, 60
];

const WHEEL_START_DEG = 328.125; // Ecliptic longitude where Gate 41 begins
const GATE_SPAN = 5.625;        // Degrees per gate
const LINE_SPAN = GATE_SPAN / 6; // 0.9375° per line

// Build the gate boundary lookup table
const GATE_BOUNDARIES = [];
for (let i = 0; i < 64; i++) {
  const startDeg = (WHEEL_START_DEG + i * GATE_SPAN) % 360;
  const endDeg = (startDeg + GATE_SPAN) % 360;
  GATE_BOUNDARIES.push({
    gate: GATE_SEQUENCE[i],
    index: i,
    start_deg: parseFloat(startDeg.toFixed(4)),
    end_deg: parseFloat(endDeg.toFixed(4))
  });
}

// ─── Centers ─────────────────────────────────────────────────────────────────

const CENTERS = {
  HEAD:          { name: 'Head',          type: 'awareness', motor: false, gates: [64, 61, 63] },
  AJNA:          { name: 'Ajna',          type: 'awareness', motor: false, gates: [47, 24, 4, 17, 43, 11] },
  THROAT:        { name: 'Throat',        type: 'manifestation', motor: false, gates: [62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16] },
  G:             { name: 'G',             type: 'identity',  motor: false, gates: [7, 1, 13, 10, 25, 46, 2, 15] },
  HEART:         { name: 'Heart',         type: 'motor',     motor: true,  gates: [21, 40, 26, 51] },
  SOLAR_PLEXUS:  { name: 'Solar Plexus',  type: 'motor',     motor: true,  gates: [6, 37, 22, 36, 49, 55, 30] },
  SACRAL:        { name: 'Sacral',        type: 'motor',     motor: true,  gates: [5, 14, 29, 59, 9, 3, 42, 27, 34] },
  SPLEEN:        { name: 'Spleen',        type: 'awareness', motor: false, gates: [48, 57, 44, 50, 32, 28, 18] },
  ROOT:          { name: 'Root',          type: 'motor',     motor: true,  gates: [53, 60, 52, 19, 39, 41, 58, 38, 54] }
};

// Build reverse lookup: gate → center name
const GATE_TO_CENTER = {};
for (const [key, center] of Object.entries(CENTERS)) {
  for (const gate of center.gates) {
    GATE_TO_CENTER[gate] = center.name;
  }
}

// ─── Channels ────────────────────────────────────────────────────────────────
// All 36 channels with their gate pairs and connected centers.

const CHANNELS = [
  // Head — Ajna
  { id: '64-47', gates: [64, 47], centers: ['Head', 'Ajna'], name: 'Abstraction' },
  { id: '61-24', gates: [61, 24], centers: ['Head', 'Ajna'], name: 'Awareness' },
  { id: '63-4',  gates: [63, 4],  centers: ['Head', 'Ajna'], name: 'Logic' },
  // Ajna — Throat
  { id: '17-62', gates: [17, 62], centers: ['Ajna', 'Throat'], name: 'Acceptance' },
  { id: '43-23', gates: [43, 23], centers: ['Ajna', 'Throat'], name: 'Structuring' },
  { id: '11-56', gates: [11, 56], centers: ['Ajna', 'Throat'], name: 'Curiosity' },
  // Throat — G
  { id: '8-1',   gates: [8, 1],   centers: ['Throat', 'G'], name: 'Inspiration' },
  { id: '31-7',  gates: [31, 7],  centers: ['Throat', 'G'], name: 'The Alpha' },
  { id: '33-13', gates: [33, 13], centers: ['Throat', 'G'], name: 'The Prodigal' },
  { id: '20-10', gates: [20, 10], centers: ['Throat', 'G'], name: 'Awakening' },
  // Throat — Heart
  { id: '45-21', gates: [45, 21], centers: ['Throat', 'Heart'], name: 'Money Line' },
  // Throat — Solar Plexus
  { id: '35-36', gates: [35, 36], centers: ['Throat', 'Solar Plexus'], name: 'Transitoriness' },
  { id: '12-22', gates: [12, 22], centers: ['Throat', 'Solar Plexus'], name: 'Openness' },
  // Throat — Spleen
  { id: '16-48', gates: [16, 48], centers: ['Throat', 'Spleen'], name: 'The Wavelength' },
  { id: '20-57', gates: [20, 57], centers: ['Throat', 'Spleen'], name: 'The Brainwave' },
  // Throat — Sacral
  { id: '34-20', gates: [34, 20], centers: ['Sacral', 'Throat'], name: 'Charisma' },
  // G — Heart
  { id: '25-51', gates: [25, 51], centers: ['G', 'Heart'], name: 'Initiation' },
  // G — Sacral
  { id: '2-14',  gates: [2, 14],  centers: ['G', 'Sacral'], name: 'The Beat' },
  { id: '5-15',  gates: [5, 15],  centers: ['G', 'Sacral'], name: 'Rhythm' },
  { id: '46-29', gates: [46, 29], centers: ['G', 'Sacral'], name: 'Discovery' },
  { id: '10-34', gates: [10, 34], centers: ['G', 'Sacral'], name: 'Exploration' },
  // G — Spleen
  { id: '10-57', gates: [10, 57], centers: ['G', 'Spleen'], name: 'Perfected Form' },
  // Heart — Solar Plexus
  { id: '40-37', gates: [40, 37], centers: ['Heart', 'Solar Plexus'], name: 'Community' },
  // Heart — Spleen
  { id: '26-44', gates: [26, 44], centers: ['Heart', 'Spleen'], name: 'Surrender' },
  // Solar Plexus — Sacral
  { id: '6-59',  gates: [6, 59],  centers: ['Solar Plexus', 'Sacral'], name: 'Intimacy' },
  // Solar Plexus — Root
  { id: '49-19', gates: [49, 19], centers: ['Solar Plexus', 'Root'], name: 'Synthesis' },
  { id: '39-55', gates: [39, 55], centers: ['Root', 'Solar Plexus'], name: 'Emoting' },
  { id: '30-41', gates: [30, 41], centers: ['Solar Plexus', 'Root'], name: 'Recognition' },
  // Sacral — Root
  { id: '3-60',  gates: [3, 60],  centers: ['Sacral', 'Root'], name: 'Mutation' },
  { id: '9-52',  gates: [9, 52],  centers: ['Sacral', 'Root'], name: 'Concentration' },
  { id: '42-53', gates: [42, 53], centers: ['Sacral', 'Root'], name: 'Maturation' },
  // Sacral — Spleen
  { id: '27-50', gates: [27, 50], centers: ['Sacral', 'Spleen'], name: 'Preservation' },
  { id: '34-57', gates: [34, 57], centers: ['Sacral', 'Spleen'], name: 'Power' },
  // Spleen — Root
  { id: '28-38', gates: [28, 38], centers: ['Spleen', 'Root'], name: 'Struggle' },
  { id: '18-58', gates: [18, 58], centers: ['Spleen', 'Root'], name: 'Judgment' },
  { id: '32-54', gates: [32, 54], centers: ['Spleen', 'Root'], name: 'Transformation' },
];

// ─── Motor Centers ───────────────────────────────────────────────────────────
const MOTOR_CENTERS = ['Heart', 'Solar Plexus', 'Sacral', 'Root'];

// ─── Authority Precedence ────────────────────────────────────────────────────
const AUTHORITY_PRECEDENCE = [
  { name: 'Emotional',     center: 'Solar Plexus' },
  { name: 'Sacral',        center: 'Sacral' },
  { name: 'Splenic',       center: 'Spleen' },
  { name: 'Ego Manifested', center: 'Heart' },  // Heart connected to Throat
  { name: 'Ego Projected',  center: 'Heart' },  // Heart NOT connected to Throat
  { name: 'Self-Projected', center: 'G' },       // G connected to Throat
  { name: 'Mental',         center: null },       // No inner authority
  { name: 'Lunar',          center: null },       // Reflector only
];

// ─── Planetary Bodies ────────────────────────────────────────────────────────
const PLANETS = [
  'Sun', 'Earth', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'North Node', 'South Node'
];

// ─── Profile Names ───────────────────────────────────────────────────────────
const PROFILE_NAMES = {
  '1/3': 'Investigator / Martyr',
  '1/4': 'Investigator / Opportunist',
  '2/4': 'Hermit / Opportunist',
  '2/5': 'Hermit / Heretic',
  '3/5': 'Martyr / Heretic',
  '3/6': 'Martyr / Role Model',
  '4/6': 'Opportunist / Role Model',
  '4/1': 'Opportunist / Investigator',
  '5/1': 'Heretic / Investigator',
  '5/2': 'Heretic / Hermit',
  '6/2': 'Role Model / Hermit',
  '6/3': 'Role Model / Martyr'
};

// ─── Incarnation Cross Structure ─────────────────────────────────────────────
// Cross is determined by Personality Sun gate, Personality Earth gate,
// Design Sun gate, and Design Earth gate.
// Earth is always the gate 180° opposite the Sun.
// Full cross lookup would be a large table; this provides the structure
// and a subset for demonstration.

const CROSS_TYPES = {
  RIGHT_ANGLE: 'Right Angle',
  LEFT_ANGLE: 'Left Angle',
  JUXTAPOSITION: 'Juxtaposition'
};

// The cross type is determined by the profile:
// Profiles 1/3, 1/4, 2/4, 2/5, 3/5, 3/6 → Right Angle (personal destiny)
// Profile 4/1 → Juxtaposition (fixed fate)
// Profiles 4/6, 5/1, 5/2, 6/2, 6/3 → Left Angle (transpersonal karma)
const PROFILE_TO_CROSS_TYPE = {
  '1/3': 'Right Angle',
  '1/4': 'Right Angle',
  '2/4': 'Right Angle',
  '2/5': 'Right Angle',
  '3/5': 'Right Angle',
  '3/6': 'Right Angle',
  '4/1': 'Juxtaposition',
  '4/6': 'Left Angle',
  '5/1': 'Left Angle',
  '5/2': 'Left Angle',
  '6/2': 'Left Angle',
  '6/3': 'Left Angle'
};

// ─── Gate Opposite Lookup (for Earth calculation) ────────────────────────────
// Earth is always the gate exactly 180° opposite the Sun on the mandala.
// Since the mandala has 64 gates, the opposite gate is 32 positions away.
function getOppositeGateIndex(gateIndex) {
  return (gateIndex + 32) % 64;
}

// ─── Zodiac Sign Helper ──────────────────────────────────────────────────────
const ZODIAC_SIGNS = [
  { name: 'Aries',       start: 0 },
  { name: 'Taurus',      start: 30 },
  { name: 'Gemini',      start: 60 },
  { name: 'Cancer',      start: 90 },
  { name: 'Leo',         start: 120 },
  { name: 'Virgo',       start: 150 },
  { name: 'Libra',       start: 180 },
  { name: 'Scorpio',     start: 210 },
  { name: 'Sagittarius', start: 240 },
  { name: 'Capricorn',   start: 270 },
  { name: 'Aquarius',    start: 300 },
  { name: 'Pisces',      start: 330 }
];

function getZodiacSign(longitude) {
  const normalized = ((longitude % 360) + 360) % 360;
  for (let i = ZODIAC_SIGNS.length - 1; i >= 0; i--) {
    if (normalized >= ZODIAC_SIGNS[i].start) {
      const degInSign = normalized - ZODIAC_SIGNS[i].start;
      return {
        sign: ZODIAC_SIGNS[i].name,
        degrees: Math.floor(degInSign),
        minutes: Math.floor((degInSign % 1) * 60),
        seconds: Math.round(((degInSign % 1) * 60 % 1) * 60)
      };
    }
  }
  return { sign: 'Aries', degrees: 0, minutes: 0, seconds: 0 };
}

module.exports = {
  GATE_SEQUENCE,
  WHEEL_START_DEG,
  GATE_SPAN,
  LINE_SPAN,
  GATE_BOUNDARIES,
  CENTERS,
  GATE_TO_CENTER,
  CHANNELS,
  MOTOR_CENTERS,
  AUTHORITY_PRECEDENCE,
  PLANETS,
  PROFILE_NAMES,
  CROSS_TYPES,
  PROFILE_TO_CROSS_TYPE,
  ZODIAC_SIGNS,
  getOppositeGateIndex,
  getZodiacSign
};
