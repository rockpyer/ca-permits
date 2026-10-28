// Light-surface palette, shared with Weller Logs (IBM Plex, slate ink, burnt-orange accent).
//
// One rule across every page: hue = group, shade = member. A parent company owns a hue
// and its operators of record are shades of it; a functional type owns a hue and its
// CalGEM well types are shades of it; a work activity owns a hue and its notice types
// are shades of it. Gray always means "Other".
//
// Work activity colors follow Okabe-Ito (bluish green, vermillion) plus a dark navy, so
// New Drill vs Existing differ in hue and lightness under protan, deutan and tritan
// simulation. OPERATOR_SLOTS and FUNCTIONAL_TYPE_COLORS were each checked all-pairs for
// color-vision-deficiency separation (OKLab dE >= 9) and normal-vision separation (>= 15).
// Mark colors are 3:1+ on white where possible; WORK_TEXT_COLORS are 4.5:1+ for labels.
export const SURFACE = {
  ink: '#edf0f3',
  panel: '#ffffff',
  line: '#d5dbe2'
};

export const CHART = {
  grid: '#e6eaee',
  axis: '#5c6975',
  label: '#3c4752',
  cursor: 'rgba(92, 105, 117, 0.45)',
  cursorFill: 'rgba(92, 105, 117, 0.08)',
  other: '#a3adb8'
};

export const WORK_COLORS = {
  new_drills: '#009e73',
  existing: '#1e3a8a',
  abandonment: '#d55e00'
};

export const WORK_TEXT_COLORS = {
  new_drills: '#047857',
  existing: '#1e3a8a',
  abandonment: '#b04a00'
};

/** Shades for the notice types inside each work activity, darkest first. */
export const NOTICE_TYPE_COLORS: Record<string, string> = {
  'New Drill': WORK_COLORS.new_drills,
  Rework: '#1e3a8a',
  Sidetrack: '#4361b8',
  Deepen: '#8ba0dc',
  Abandon: '#d55e00',
  'Re-Abandon': '#f0a06a'
};

/** Fixed parent-company hues. CRC, Chevron and Sentinel Peak are named; the next two
 * largest parents take the spare slots by current-year New Drill and Existing permits. */
export const OPERATOR_SLOTS = {
  crc: '#2563eb',
  chevron: '#b91c1c',
  sentinel: '#0f766e',
  spares: ['#d97706', '#a21caf']
};

/** CRC operators of record are shades of the CRC blue, darkest for the largest. */
export const CRC_MEMBER_SHADES = {
  aera: '#0f4c81',
  production: '#2563eb',
  elkHills: '#6ea8f7',
  other: '#b3d1fa'
};

export const FUNCTIONAL_TYPE_COLORS = {
  producer: '#3f4a55',
  thermal_producer: '#b45309',
  injector: '#7c3aed',
  observation: '#ca9a0a',
  other: '#a3adb8'
};

/** Shades for CalGEM well types inside each functional type. Unlisted types use the group color. */
export const SOURCE_TYPE_COLORS: Record<string, string> = {
  'Oil & Gas': FUNCTIONAL_TYPE_COLORS.producer,
  'Dry Gas': '#7b8794',
  'Cyclic Steam': FUNCTIONAL_TYPE_COLORS.thermal_producer,
  Steamflood: '#5b21b6',
  Waterflood: FUNCTIONAL_TYPE_COLORS.injector,
  'Water Disposal': '#a78bfa',
  'Gas Disposal': '#c4b5fd',
  Observation: FUNCTIONAL_TYPE_COLORS.observation
};

/** Ranked categories with no fixed identity (fields, counties, districts, statuses, ages):
 * one neutral ramp, darkest = largest, with CHART.other as the lightest step, so they
 * never borrow an operator or type hue. */
export const NEUTRAL_RAMP = ['#1f2933', '#3f4b57', '#5f6c79', '#7f8b97'];

export const ACCENT = {
  steel: '#2b6cb0',
  gold: '#a16207',
  coral: '#b42318',
  neutral: '#172029'
};

export const BRAND = {
  ink: '#172029',
  muted: '#5c6975',
  accent: '#b4541e',
  title: '#2b6cb0'
};
