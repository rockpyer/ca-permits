export const DEVELOPMENT_NOTICE_TYPES = [
  'NOI - New Drill',
  'NOI - Deepen',
  'NOI - Sidetrack',
  'NOI - Rework'
];

export const ABANDONMENT_NOTICE_TYPES = ['NOI - Abandon', 'NOI - Re-Abandon'];

export const ALL_NOTICE_TYPES = [
  ...DEVELOPMENT_NOTICE_TYPES,
  ...ABANDONMENT_NOTICE_TYPES,
  'NOI'
];

export const WELL_TYPE_PRIORITY = [
  'Oil & Gas',
  'Injection',
  'Cyclic Steam',
  'Water Flood',
  'Water Disposal',
  'Dry Gas',
  'Gas Storage',
  'Observation',
  'Unknown'
];
