import { supabase } from './supabase';
import type { EtlRun, FieldBoundary, PermitActivity } from './types';

const DEFAULT_MIN_PERMIT_DATE = '2026-01-01';
const PAGE_SIZE = 1000;

export async function loadPermitActivity(): Promise<PermitActivity[]> {
  const rows: PermitActivity[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('permit_activity')
      .select('*')
      .order('notice_date_determination', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data || []) as PermitActivity[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

export async function loadPermitDateBounds(): Promise<{ minDate: string; maxDate: string }> {
  const [{ data: oldest, error: oldestError }, { data: newest, error: newestError }] = await Promise.all([
    supabase
      .from('permit_activity')
      .select('notice_date_determination')
      .not('notice_date_determination', 'is', null)
      .order('notice_date_determination', { ascending: true })
      .limit(1),
    supabase
      .from('permit_activity')
      .select('notice_date_determination')
      .not('notice_date_determination', 'is', null)
      .order('notice_date_determination', { ascending: false })
      .limit(1)
  ]);

  if (oldestError) throw oldestError;
  if (newestError) throw newestError;

  return {
    minDate: oldest?.[0]?.notice_date_determination || DEFAULT_MIN_PERMIT_DATE,
    maxDate: newest?.[0]?.notice_date_determination || ''
  };
}

export async function loadFields(): Promise<FieldBoundary[]> {
  const { data, error } = await supabase
    .from('fields')
    .select('*')
    .order('field_name', { ascending: true });

  if (error) throw error;
  return (data || []) as FieldBoundary[];
}

export async function loadEtlRuns(): Promise<EtlRun[]> {
  const { data, error } = await supabase
    .from('etl_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw error;
  return (data || []) as EtlRun[];
}
