import { supabase } from './supabase';
import type { EtlRun, FieldBoundary, PermitActivity } from './types';

const DEFAULT_MIN_PERMIT_DATE = '2025-12-01';

export async function loadPermitActivity(): Promise<PermitActivity[]> {
  const { data, error } = await supabase
    .from('permit_activity')
    .select('*')
    .order('notice_dated', { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) throw error;
  return (data || []) as PermitActivity[];
}

export async function loadPermitDateBounds(): Promise<{ minDate: string; maxDate: string }> {
  const [{ data: oldest, error: oldestError }, { data: newest, error: newestError }] = await Promise.all([
    supabase
      .from('permit_activity')
      .select('notice_dated')
      .not('notice_dated', 'is', null)
      .order('notice_dated', { ascending: true })
      .limit(1),
    supabase
      .from('permit_activity')
      .select('notice_dated')
      .not('notice_dated', 'is', null)
      .order('notice_dated', { ascending: false })
      .limit(1)
  ]);

  if (oldestError) throw oldestError;
  if (newestError) throw newestError;

  return {
    minDate: latestDate(oldest?.[0]?.notice_dated || '', DEFAULT_MIN_PERMIT_DATE),
    maxDate: newest?.[0]?.notice_dated || ''
  };
}

function latestDate(a: string, b: string) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
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
