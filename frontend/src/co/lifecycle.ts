import { daysBetween } from '../state/stats';
import type { CoPermit } from './types';

export { daysBetween };

// COGIS facility status codes seen on wells with recent Form 2 approvals, plus the
// common completed and inactive codes. Labels are working definitions to confirm
// against ECMC's scout card glossary.
export const WELL_STATUS_LABELS: Record<string, string> = {
  AP: 'Approved permit',
  DG: 'Drilling',
  WO: 'Waiting on completion',
  PR: 'Producing',
  SI: 'Shut in',
  TA: 'Temporarily abandoned',
  IJ: 'Injecting',
  AC: 'Active',
  SO: 'Suspended operations',
  EP: 'Expired permit',
  AL: 'Abandoned location',
  PA: 'Plugged and abandoned',
  DA: 'Dry and abandoned'
};

export const LIFECYCLES = ['not_spudded', 'drilling', 'drilled', 'existing_wellbore', 'expired', 'unmatched'] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  not_spudded: 'Not spudded',
  drilling: 'Drilling',
  drilled: 'Drilled',
  existing_wellbore: 'Existing wellbore',
  expired: 'Expired or abandoned',
  unmatched: 'No well record'
};

// Okabe-Ito hues; gray stays reserved for "no well record".
export const LIFECYCLE_COLORS: Record<Lifecycle, string> = {
  not_spudded: '#1e3a8a',
  drilling: '#d55e00',
  drilled: '#009e73',
  existing_wellbore: '#56b4e9',
  expired: '#cc79a7',
  unmatched: '#a3adb8'
};

const DRILLED = new Set(['WO', 'PR', 'SI', 'TA', 'IJ', 'AC', 'SO']);
const ENDED = new Set(['EP', 'AL', 'PA', 'DA']);

/**
 * Where a permit stands today:
 * - existing_wellbore: the well was spudded before this approval (recompletes and
 *   re-permits on an existing API), so the approval did not start a new well.
 * - expired: ECMC marks the permit expired or the location abandoned, or the permit
 *   point's expiration date has passed without a spud.
 */
export function lifecycle(row: CoPermit, asOf: string): Lifecycle {
  if (!row.in_wells_layer && !row.undrilled_permit) return 'unmatched';
  const status = row.well_status || '';
  if (row.spud_date && row.approved_date && row.spud_date < row.approved_date) return 'existing_wellbore';
  if (ENDED.has(status)) return 'expired';
  if (status === 'DG') return 'drilling';
  if (DRILLED.has(status)) return 'drilled';
  if (row.spud_date) return 'drilling';
  if (row.permit_expiration_date && asOf && row.permit_expiration_date < asOf) return 'expired';
  return 'not_spudded';
}

export function wellStatusLabel(code: string | null | undefined) {
  if (!code) return 'No well record';
  return WELL_STATUS_LABELS[code] ? `${WELL_STATUS_LABELS[code]} (${code})` : code;
}

/** Days from approval to spud for permits that started a new well. */
export function approvalToSpudDays(row: CoPermit) {
  const days = daysBetween(row.approved_date, row.spud_date);
  return days !== null && days >= 0 ? days : null;
}
