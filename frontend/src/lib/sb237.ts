export const SB237_PAGE_URL = 'https://www.conservation.ca.gov/calgem/Pages/SB237.aspx';
export const SB237_DRILL_TRACKER_URL =
  'https://www.conservation.ca.gov/calgem/Documents/Permits/Central%20District%20Drill%20Tracker.xlsx';

export type Sb237DrillTrackerStats = {
  spuddedCount: number;
  updatedLabel: string;
};

type DrillTrackerRow = {
  'Spud Date (preliminary and self-reported by operators)'?: unknown;
  'SB-237 (Y/N)'?: unknown;
};

export async function loadSb237DrillTrackerStats(): Promise<Sb237DrillTrackerStats> {
  const response = await fetch(SB237_DRILL_TRACKER_URL);
  if (!response.ok) {
    throw new Error(`Unable to load SB237 drill tracker: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { spuddedCount: 0, updatedLabel: '' };

  const heading = String(sheet.A1?.v || '');
  const rows = XLSX.utils.sheet_to_json<DrillTrackerRow>(sheet, { range: 1, defval: null });
  const spuddedCount = rows.filter((row) => {
    const sb237 = String(row['SB-237 (Y/N)'] || '').trim().toUpperCase();
    return sb237 === 'Y' && Boolean(row['Spud Date (preliminary and self-reported by operators)']);
  }).length;

  return {
    spuddedCount,
    updatedLabel: parseUpdatedLabel(heading)
  };
}

function parseUpdatedLabel(value: string) {
  const match = value.match(/Updated\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}
