// CalGEM Central District Drill Tracker: operator-reported spud dates for Kern County wells.
import XLSX from 'xlsx';

export const DRILL_TRACKER_URL =
  'https://www.conservation.ca.gov/calgem/Documents/Permits/Central%20District%20Drill%20Tracker.xlsx';

export async function fetchDrillTracker(url = DRILL_TRACKER_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`drill tracker HTTP ${response.status}`);
  return parseDrillTracker(Buffer.from(await response.arrayBuffer()));
}

export function parseDrillTracker(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const heading = String(sheet?.A1?.v || '');
  const raw = XLSX.utils.sheet_to_json(sheet, { range: 1, defval: null });
  const pick = (row, pattern) => {
    const key = Object.keys(row).find((name) => pattern.test(name));
    return key ? row[key] : null;
  };
  const rows = raw
    .map((row) => ({
      api_10: normalizeApi(pick(row, /^API$/i)),
      well_name: text(pick(row, /well name/i)),
      operator: text(pick(row, /operator/i)),
      field: text(pick(row, /field/i)),
      well_type: text(pick(row, /well type/i)),
      approval_date: isoDate(pick(row, /approval/i)),
      spud_date: isoDate(pick(row, /spud/i)),
      sb237: String(pick(row, /SB-?237/i) || '').trim().toUpperCase() === 'Y'
    }))
    .filter((row) => row.api_10);
  if (!rows.length) throw new Error('drill tracker parsed 0 rows; columns may have changed');
  return { updatedLabel: updatedDate(heading.match(/Updated\s+(.+)$/i)?.[1]?.trim() || ''), rows };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The heading is typed by hand ("Septmenber 28 2026"), so read the month by its prefix and
// return ISO; fall back to the raw text if it doesn't parse.
export function updatedDate(label) {
  const match = label.match(/([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
  if (month < 0) return label;
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function normalizeApi(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length >= 10 ? digits.slice(0, 10) : digits.padStart(10, '0');
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const match = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : null;
}

function text(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}
