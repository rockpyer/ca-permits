// Light-surface palette, shared with Weller Logs (IBM Plex, slate ink, burnt-orange accent).
// Work activity colors carry meaning everywhere. They follow Okabe-Ito (bluish green,
// vermillion) plus a dark navy, so every pair stays distinct under protan, deutan and
// tritan simulation, and New Drill vs Existing also differ strongly in lightness.
// Mark colors are 3:1+ on white (graphics); WORK_TEXT_COLORS are 4.5:1+ for labels.
// SERIES is for unordered categories (operators, fields, well types). Keep order fixed.
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

export const SERIES = ['#2b6cb0', '#c2410c', '#0e7490', '#7c3aed', '#a16207', '#be185d'];

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
