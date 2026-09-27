// Baker Hughes North America rotary rig count (weekly, Fridays). The download link
// changes each week, so discover it from the public page unless overridden.
import XLSX from 'xlsx';

const PAGE_URL = 'https://rigcount.bakerhughes.com/na-rig-count';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; permits.ryweller.com data refresh)' };

export async function fetchRigCount(overrideUrl = process.env.BAKER_HUGHES_RIGCOUNT_URL) {
  const fileUrl = overrideUrl || (await discoverFileUrl());
  const response = await fetch(fileUrl, { headers: HEADERS });
  if (!response.ok) throw new Error(`rig count file HTTP ${response.status}`);
  return { sourceUrl: fileUrl, ...parseRigCount(Buffer.from(await response.arrayBuffer())) };
}

async function discoverFileUrl() {
  const response = await fetch(PAGE_URL, { headers: HEADERS });
  if (!response.ok) throw new Error(`rig count page HTTP ${response.status}`);
  const html = await response.text();
  const links = Array.from(html.matchAll(/<a[^>]+href="([^"]+\.xls[xb]?[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)).map(([, href, label]) => ({
    href: new URL(href.replace(/&amp;/g, '&'), PAGE_URL).toString(),
    label: label.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }));
  // The pivot table carries state and county per rig record.
  const pivot = links.find((link) => /pivot/i.test(`${link.label} ${link.href}`));
  if (!pivot) throw new Error(`no pivot-table link among ${links.length} spreadsheet links`);
  return pivot.href;
}

// Weekly California and Kern County rig totals from the pivot-table workbook.
export function parseRigCount(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  for (const sheetName of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, blankrows: false });
    const headerIndex = grid.findIndex((row) => {
      const cells = row.map((cell) => String(cell ?? ''));
      return cells.some((cell) => /state/i.test(cell)) && cells.some((cell) => /date/i.test(cell)) && cells.some((cell) => /rig ?count/i.test(cell));
    });
    if (headerIndex < 0) continue;

    const header = grid[headerIndex].map((cell) => String(cell ?? ''));
    const column = (pattern) => header.findIndex((cell) => pattern.test(cell));
    const stateCol = column(/state/i);
    const countyCol = column(/county/i);
    const usDateCol = column(/us_?publish ?date/i);
    const dateCol = usDateCol >= 0 ? usDateCol : column(/date/i);
    const valueCol = column(/rig ?count/i);

    const weeks = new Map();
    for (const row of grid.slice(headerIndex + 1)) {
      if (!/^california$/i.test(String(row[stateCol] ?? '').trim())) continue;
      const date = isoDate(row[dateCol]);
      if (!date) continue;
      const value = Number(row[valueCol]) || 0;
      const week = weeks.get(date) || { date, california: 0, kern: 0 };
      week.california += value;
      if (countyCol >= 0 && /^kern/i.test(String(row[countyCol] ?? '').trim())) week.kern += value;
      weeks.set(date, week);
    }
    if (weeks.size) return { sheet: sheetName, weeks: Array.from(weeks.values()).sort((a, b) => a.date.localeCompare(b.date)) };
  }
  throw new Error('no sheet with State, publish date, and rig count columns');
}

function isoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return XLSX.SSF.format('yyyy-mm-dd', value);
  const match = String(value ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : null;
}
