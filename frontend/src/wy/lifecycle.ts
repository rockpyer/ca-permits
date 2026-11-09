import { daysBetween } from '../state/stats';
import type { WyApd } from './types';

export const STAGES = ['pending', 'approved', 'spudded', 'drilled', 'existing_wellbore', 'expired', 'withdrawn'] as const;
export type WyStage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<WyStage, string> = {
  pending: 'Waiting on approval',
  approved: 'Approved, not spudded',
  spudded: 'Spudded',
  drilled: 'Drilled or completed',
  existing_wellbore: 'Existing wellbore',
  expired: 'Expired, not spudded',
  withdrawn: 'Withdrawn or denied'
};

// Okabe-Ito hues, matching /co where the meaning matches.
export const STAGE_COLORS: Record<WyStage, string> = {
  pending: '#e69f00',
  approved: '#1e3a8a',
  spudded: '#d55e00',
  drilled: '#009e73',
  existing_wellbore: '#56b4e9',
  expired: '#cc79a7',
  withdrawn: '#a3adb8'
};

// Well statuses that mean the hole is still being drilled or waiting on a completion report.
const SPUDDED_STATUSES = new Set(['Well Spudded', 'Drilling', 'Active Permit', 'Waiting on Approval', 'Expired Permit']);

/**
 * Where an APD stands today. The well record wins over the APD status: WOGCC can mark an APD
 * "Expired Permit" after the well was spudded on it.
 * - existing_wellbore: the well was spudded before this APD's approval (re-entries, deepenings,
 *   renewals filed after spud), so the approval did not start a new well.
 */
export function stage(row: WyApd): WyStage {
  const status = row.apd_status || '';
  if (status === 'Waiting on Approval') return 'pending';
  if (status === 'Withdrawn' || status === 'Denied or Cancelled') return 'withdrawn';
  if (row.spud_date) {
    if (row.approved_date && row.spud_date < row.approved_date) return 'existing_wellbore';
    if (row.completion_date || (row.well_status && !SPUDDED_STATUSES.has(row.well_status))) return 'drilled';
    return 'spudded';
  }
  if (status === 'Drilling or Drilled Permit') return 'spudded';
  if (status === 'Expired Permit') return 'expired';
  return 'approved';
}

export function approvalToSpudDays(row: WyApd) {
  const days = daysBetween(row.approved_date, row.spud_date);
  return days !== null && days >= 0 ? days : null;
}

export function receivedToApprovedDays(row: WyApd) {
  const days = daysBetween(row.received_date, row.approved_date);
  return days !== null && days >= 0 ? days : null;
}

// Mineral ownership from the APD detail page ("Mineral: MM w FED / Surface: FEE").
export const MINERAL_CLASSES = [
  'Federal',
  'Mixed with federal',
  'State',
  'Mixed with state',
  'Tribal',
  'Mixed with tribal',
  'Fee',
  'Mixed fee',
  'Not reported',
  'Detail not loaded'
] as const;

export const MINERAL_COLORS: Record<string, string> = {
  Federal: '#0f5e9c',
  'Mixed with federal': '#7fb2dc',
  State: '#b45309',
  'Mixed with state': '#f0b46b',
  Tribal: '#7c3aed',
  'Mixed with tribal': '#c4b5fd',
  Fee: '#3f6212',
  'Mixed fee': '#a3c46c',
  'Not reported': '#a3adb8',
  'Detail not loaded': '#d9dde2'
};

export function mineralOf(row: Pick<WyApd, 'mineral_class'>) {
  return row.mineral_class || 'Detail not loaded';
}

/** Federal or partly federal minerals: BLM must also approve the APD before the well can spud. */
export function needsBlm(mineral: string | null | undefined) {
  return mineral === 'Federal' || mineral === 'Mixed with federal';
}

export const APPLICATION_TYPES = ['New', 'Renewal', 'Re-entry', 'Deepen'] as const;
export const APPLICATION_COLORS: Record<string, string> = {
  New: '#1e3a8a',
  Renewal: '#56b4e9',
  'Re-entry': '#009e73',
  Deepen: '#cc79a7',
  Unknown: '#a3adb8'
};

export function applicationOf(row: Pick<WyApd, 'application_type'>) {
  return row.application_type || 'Unknown';
}

export function reservoirOf(row: { reservoir: string | null }) {
  return row.reservoir || 'Not reported';
}
