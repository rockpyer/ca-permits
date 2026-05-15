import type { PermitActivity } from './types';

export function permitDate(row: PermitActivity) {
  return row.notice_date_determination || row.notice_dated || '';
}

export function noticeDate(row: PermitActivity) {
  return row.notice_dated || '';
}
