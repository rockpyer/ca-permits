export function longDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function monthLabel(month: string, long = false) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' });
}

export function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename: string, header: string[], lines: unknown[][]) {
  const csv = [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Loads a { columns, rows } snapshot file into objects. */
export async function columnar<T>(url: string, label: string): Promise<T[]> {
  const response = await fetch(url);
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`${label} data snapshot is incomplete.`);
  const { columns, rows } = (await response.json()) as { columns: string[]; rows: unknown[][] };
  return rows.map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])) as T);
}
