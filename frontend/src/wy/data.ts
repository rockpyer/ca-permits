import { columnar } from '../state/format';
import type { WyApd, WyMeta, WyRigWeek, WySpud } from './types';

export type WyData = {
  apds: WyApd[];
  spuds: WySpud[];
  // Baker Hughes weekly rigs, shared with the California snapshot; null if that source failed.
  rigWeeks: WyRigWeek[] | null;
  meta: WyMeta;
};

export async function loadWyData(): Promise<WyData> {
  const base = `${import.meta.env.BASE_URL}data/wy`;
  const metaResponse = await fetch(`${base}/meta.json`);
  if (!metaResponse.ok || !metaResponse.headers.get('content-type')?.includes('json')) {
    throw new Error('No Wyoming data snapshot found. Run `npm run snapshot` in frontend/.');
  }
  const meta = (await metaResponse.json()) as WyMeta;
  const [apds, spuds, rigs] = await Promise.all([
    columnar<WyApd>(`${base}/apds.json`, 'Wyoming'),
    columnar<WySpud>(`${base}/spuds.json`, 'Wyoming').catch(() => []),
    fetch(`${import.meta.env.BASE_URL}data/rig-count.json`)
      .then((response) => (response.ok ? (response.json() as Promise<{ weeks: WyRigWeek[] }>) : null))
      .catch(() => null)
  ]);
  const rigWeeks = rigs?.weeks.some((week) => typeof week.wyoming === 'number') ? rigs.weeks : null;
  return { apds, spuds, rigWeeks, meta };
}

/** WOGCC Data Explorer APD record. */
export function apdUrl(row: Pick<WyApd, 'source_key'>) {
  return `https://dataexplorer.wogcc.wyo.gov/DataMining.html?EntityType=APD&EntityKeyName=PKey&EntityKeyValue=${row.source_key}&DETAILSONLY=True`;
}

/** WOGCC well file (header, logs, tops, production) on pipeline.wyo.gov. Linked, not fetched. */
export function wellFileUrl(api: string | null) {
  const digits = (api || '').replace(/\D/g, '');
  return digits.length >= 10 ? `https://pipeline.wyo.gov/Wellapino.cfm?napino=${Number(digits.slice(2, 10))}&s1=Y` : null;
}
