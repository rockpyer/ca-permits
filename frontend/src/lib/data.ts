import { supabase } from './supabase';
import type { EtlRun, FieldBoundary, PermitActivity } from './types';

export async function loadPermitActivity(): Promise<PermitActivity[]> {
  const { data, error } = await supabase
    .from('permit_activity')
    .select('*')
    .order('notice_dated', { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error) throw error;
  return (data || []) as PermitActivity[];
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
