import type { CoMeta, CoPermit } from './types';

export const SCOUT_CARD_URL = 'https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail';

export async function loadCoData(): Promise<{ permits: CoPermit[]; meta: CoMeta }> {
  const base = `${import.meta.env.BASE_URL}data/co`;
  const metaResponse = await fetch(`${base}/meta.json`);
  if (!metaResponse.ok || !metaResponse.headers.get('content-type')?.includes('json')) {
    throw new Error('No Colorado data snapshot found. Run `npm run snapshot` in frontend/.');
  }
  const meta = (await metaResponse.json()) as CoMeta;
  const permitsResponse = await fetch(`${base}/permits.json`);
  if (!permitsResponse.ok) throw new Error('Colorado data snapshot is incomplete.');
  const { columns, rows } = (await permitsResponse.json()) as { columns: string[]; rows: unknown[][] };
  const permits = rows.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])) as CoPermit);
  return { permits, meta };
}

export function scoutCardUrl(row: Pick<CoPermit, 'api_8'>) {
  return row.api_8 ? `${SCOUT_CARD_URL}?api=${row.api_8}` : null;
}

export function locationUrl(row: Pick<CoPermit, 'location_id'>) {
  return row.location_id ? `${SCOUT_CARD_URL}?facid=${row.location_id}` : null;
}
