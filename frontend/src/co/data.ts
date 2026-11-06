import type { CoMeta, CoPermit, CoSpud, CoUndrilled, RigWeek } from './types';

export const SCOUT_CARD_URL = 'https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail';

export type CoData = {
  permits: CoPermit[];
  spuds: CoSpud[];
  undrilled: CoUndrilled[];
  // Baker Hughes weekly rigs, shared with the California snapshot; null if that source failed.
  rigWeeks: RigWeek[] | null;
  meta: CoMeta;
};

export async function loadCoData(): Promise<CoData> {
  const base = `${import.meta.env.BASE_URL}data/co`;
  const metaResponse = await fetch(`${base}/meta.json`);
  if (!metaResponse.ok || !metaResponse.headers.get('content-type')?.includes('json')) {
    throw new Error('No Colorado data snapshot found. Run `npm run snapshot` in frontend/.');
  }
  const meta = (await metaResponse.json()) as CoMeta;
  const [permits, spuds, undrilled, rigs] = await Promise.all([
    columnar<CoPermit>(`${base}/permits.json`),
    columnar<CoSpud>(`${base}/spuds.json`).catch(() => []),
    columnar<CoUndrilled>(`${base}/undrilled.json`).catch(() => []),
    fetch(`${import.meta.env.BASE_URL}data/rig-count.json`)
      .then((response) => (response.ok ? (response.json() as Promise<{ weeks: RigWeek[] }>) : null))
      .catch(() => null)
  ]);
  const rigWeeks = rigs?.weeks.some((week) => typeof week.colorado === 'number') ? rigs.weeks : null;
  return { permits, spuds, undrilled, rigWeeks, meta };
}

async function columnar<T>(url: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error('Colorado data snapshot is incomplete.');
  const { columns, rows } = (await response.json()) as { columns: string[]; rows: unknown[][] };
  return rows.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])) as T);
}

export function scoutCardUrl(row: Pick<CoPermit, 'api_8'>) {
  return row.api_8 ? `${SCOUT_CARD_URL}?api=${row.api_8}` : null;
}

export function locationUrl(row: Pick<CoPermit, 'location_id'>) {
  return row.location_id ? `${SCOUT_CARD_URL}?facid=${row.location_id}` : null;
}
