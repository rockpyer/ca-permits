// Muted dark-surface palette. Categorical steps were checked with a CVD/contrast
// validator against the panel surface (#141e1b): work activity passes all-pairs
// (map use), SERIES passes adjacent pairs (stacks, lines). Keep order fixed.
export const SURFACE = {
  ink: '#0f1816',
  panel: '#141e1b',
  line: '#24302d'
};

export const CHART = {
  grid: '#1f2a27',
  axis: '#7c8985',
  label: '#a7b2ae',
  cursor: 'rgba(124, 137, 133, 0.35)',
  cursorFill: 'rgba(124, 137, 133, 0.08)',
  other: '#66736f'
};

export const WORK_COLORS = {
  new_drills: '#3fa98f',
  existing: '#9486d2',
  abandonment: '#c98145'
};

export const SERIES = ['#5b93c9', '#c98145', '#3fa98f', '#9486d2', '#a38a2a', '#c96f98'];

export const ACCENT = {
  steel: '#7fa7d1',
  gold: '#c2a24a',
  coral: '#c46a64',
  neutral: '#b7c0bc'
};
