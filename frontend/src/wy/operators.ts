// Draft parent-company table for Wyoming operators of record. WOGCC keeps APDs under the
// legal entity that filed them. Only confirmed acquisitions are listed; review before publishing.
const PARENTS: Array<[parent: string, members: string[]]> = [['Occidental', ['ANADARKO E&P ONSHORE LLC', 'KERR MCGEE OIL & GAS ONSHORE LP']]];

export const NAMED_PARENT_COLORS: Record<string, string> = {
  Occidental: '#0f766e'
};

export const PARENT_MEMBERS = PARENTS;

export function normalizeOperator(value: string | null | undefined) {
  return (value || '')
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PARENT_BY_MEMBER = new Map(PARENTS.flatMap(([parent, members]) => members.map((member) => [normalizeOperator(member), parent])));

export function operatorDisplayName(value: string | null | undefined) {
  return value ? value.replace(/\s+/g, ' ').trim() : 'Unknown';
}

export function parentCompany(value: string | null | undefined) {
  return PARENT_BY_MEMBER.get(normalizeOperator(value)) || operatorDisplayName(value);
}

export type OperatorView = 'parent' | 'operator';

export function operatorFor(value: string | null | undefined, view: OperatorView) {
  return view === 'parent' ? parentCompany(value) : operatorDisplayName(value);
}
