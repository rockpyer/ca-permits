import XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseDrillTracker, updatedDate } from './drill-tracker.mjs';
import { parseRigCount, pickReportLink } from './rig-count.mjs';
import { parseCsvLine, poolsByApi } from './well-pools.mjs';

const workbook = (sheets) => {
  const book = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows, { cellDates: true }), name));
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};

describe('snapshot sources', () => {
  it('parses the drill tracker', () => {
    const buffer = workbook({
      Sheet1: [
        ['Preliminary Spud (Drill) Dates - Updated September 21, 2026'],
        ['API', 'Well Name', 'Operator', 'Field', 'Well Type', 'Permit Approval Date', 'Spud Date (preliminary and self-reported by operators)', 'SB-237 (Y/N)'],
        [403070042, 'Lost Hills 1', 'Aera Energy LLC', 'Lost Hills', 'Oil & Gas', new Date('2026-03-04T00:00:00Z'), '3/13/2026', 'Y']
      ]
    });
    const tracker = parseDrillTracker(buffer);
    expect(tracker.updatedLabel).toBe('2026-09-21');
    expect(updatedDate('Septmenber 28 2026')).toBe('2026-09-28');
    expect(updatedDate('sometime soon')).toBe('sometime soon');
    expect(tracker.rows[0]).toMatchObject({ api_10: '0403070042', approval_date: '2026-03-04', spud_date: '2026-03-13', sb237: true });
  });

  it('sums weekly California and Kern rigs from a pivot sheet', () => {
    const buffer = workbook({
      Notes: [['About this file']],
      Data: [
        ['Country', 'County/Parish', 'Basin', 'DrillFor', 'Location', 'Trajectory', 'State/Province', 'US_PublishDate', 'Rig Count Value'],
        ['UNITED STATES', 'Kern', 'Other', 'Oil', 'Land', 'Vertical', 'California', new Date('2026-09-18T00:00:00Z'), 3],
        ['UNITED STATES', 'Los Angeles', 'Other', 'Oil', 'Land', 'Directional', 'California', new Date('2026-09-18T00:00:00Z'), 1],
        ['UNITED STATES', 'Midland', 'Permian', 'Oil', 'Land', 'Horizontal', 'Texas', new Date('2026-09-18T00:00:00Z'), 50]
      ]
    });
    expect(parseRigCount(buffer)).toEqual({ sheet: 'Data', weeks: [{ date: '2026-09-18', california: 4, kern: 3 }] });
  });

  it('collects meaningful pool names per API-10', () => {
    const csv = [
      'API,PoolCode,PoolName,WellStatus',
      '040300000100,10,Tulare,Active',
      '040300000101,20,"Etchegoin, Upper",Active',
      '040300000100,10,Tulare,Active',
      '040300000200,00,No Pool Breakdown,Idle',
      '049999999900,10,Tulare,Active'
    ].join('\n');
    const pools = poolsByApi(csv, new Set(['0403000001', '0403000002']));
    expect(pools.get('0403000001')).toEqual(['Tulare', 'Etchegoin, Upper']);
    expect(pools.has('0403000002')).toBe(false);
    expect(parseCsvLine('a,"b ""c""",d')).toEqual(['a', 'b "c"', 'd']);
  });

  it('finds the rig count report link by its text when the URL has no extension', () => {
    const html = `
      <a href="/static-files/aaa">U.S. Rig Count (Jan 2000 - Current)</a>
      <a href="/static-files/bbb"><span>North America Rig Count Report</span></a>`;
    expect(pickReportLink(html, 'https://rigcount.bakerhughes.com/na-rig-count')).toBe('https://rigcount.bakerhughes.com/static-files/bbb');
    expect(() => pickReportLink('<a href="/static-files/ccc">Rig Count FAQs</a>')).toThrow(/candidates: "Rig Count FAQs"/);
  });

  it('excludes geothermal (Miscellaneous) rigs', () => {
    const buffer = workbook({
      'NAM Weekly': [
        ['Country', 'County', 'DrillFor', 'State/Province', 'US_PublishDate', 'Rig Count Value'],
        ['UNITED STATES', 'KERN', 'Oil', 'CALIFORNIA', new Date('2026-09-25T00:00:00Z'), 2],
        ['UNITED STATES', 'LAKE', 'Miscellaneous', 'CALIFORNIA', new Date('2026-09-25T00:00:00Z'), 1]
      ]
    });
    expect(parseRigCount(buffer).weeks).toEqual([{ date: '2026-09-25', california: 2, kern: 2 }]);
  });
});
