// Draft parent-company table for Colorado operators of record. ECMC keeps permits under
// the legal entity that filed them, so acquired companies keep appearing. Each mapping
// below is a known acquisition; review before publishing.
const PARENTS: Array<[parent: string, members: string[]]> = [
  [
    'SM Energy (Civitas)',
    [
      'Civitas Resources Inc',
      'Crestone Peak Resources Operating LLC',
      'Extraction Oil & Gas Inc',
      'Bonanza Creek Energy Operating Company LLC',
      'HighPoint Operating Corporation'
    ]
  ],
  ['Chevron', ['Noble Energy Inc', 'PDC Energy Inc']],
  ['Occidental', ['Kerr McGee Oil & Gas Onshore LP', 'Anadarko E&P Onshore LLC']]
];

export const NAMED_PARENT_COLORS: Record<string, string> = {
  'SM Energy (Civitas)': '#2563eb',
  Chevron: '#c8102e',
  Occidental: '#0f766e'
};

export function normalizeOperator(value: string | null | undefined) {
  return (value || '')
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARENT_BY_MEMBER = new Map(PARENTS.flatMap(([parent, members]) => members.map((member) => [normalizeOperator(member), parent])));

export const PARENT_MEMBERS = PARENTS;

export function operatorDisplayName(value: string | null | undefined) {
  if (!value) return 'Unknown';
  // ECMC's list title-cases names ("Tep Rocky Mountain LLC"); restore common suffixes.
  return value.replace(/\b(Llc|Lp|Ii|Iii|Iv|Vi)\b/g, (word) => word.toUpperCase());
}

export function parentCompany(value: string | null | undefined) {
  return PARENT_BY_MEMBER.get(normalizeOperator(value)) || operatorDisplayName(value);
}

export type OperatorView = 'parent' | 'operator';

export function operatorFor(value: string | null | undefined, view: OperatorView) {
  return view === 'parent' ? parentCompany(value) : operatorDisplayName(value);
}
