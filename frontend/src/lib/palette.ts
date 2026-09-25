// Dark-surface palette. Categorical steps were checked with a CVD/contrast
// validator against the panel surface (#141e1b): work activity passes all-pairs
// (map use), SERIES passes adjacent pairs (stacks, lines). Keep order fixed.
export const SURFACE = {
  ink: '#0f1816',
  panel: '#141e1b',
  line: '#24302d'
};

export const CHART = {
  grid: '#232f2c',
  axis: '#8a9894',
  label: '#b6c0bc',
  cursor: 'rgba(124, 137, 133, 0.35)',
  cursorFill: 'rgba(124, 137, 133, 0.08)',
  other: '#66736f'
};

export const WORK_COLORS = {
  new_drills: '#17ad8e',
  existing: '#9684df',
  abandonment: '#d27d2f'
};

export const SERIES = ['#5498d8', '#d27d2f', '#17ad8e', '#9684df', '#ac8e00', '#d66b9d'];

export const ACCENT = {
  steel: '#7caadb',
  gold: '#c9a437',
  coral: '#cf6761',
  neutral: '#b7c0bc'
};
