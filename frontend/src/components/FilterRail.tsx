import { PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ALL_NOTICE_TYPES } from '../lib/constants';
import { defaultFilters, toggleListValue, uniqueValues } from '../lib/filters';
import type { Filters, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  filters: Filters;
  dateBounds: { minDate: string; maxDate: string };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onChange: (filters: Filters) => void;
};

export function FilterRail({ rows, filters, dateBounds, collapsed, onCollapsedChange, onChange }: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-ink p-3">
      <div className="mb-3 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Filters</h2>
            <p className="text-xs text-slate-500">Development scope by default</p>
          </div>
        )}
        <div className={`flex gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <button
            className="icon-button"
            title="Reset filters"
            onClick={() => onChange(defaultFilters(dateBounds))}
            type="button"
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button"
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
            onClick={() => onCollapsedChange(!collapsed)}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && <div className="space-y-2 overflow-y-auto pr-1">
        <FilterSection title="Permit Scope" defaultOpen>
          <FilterGroup
            options={ALL_NOTICE_TYPES}
            selected={filters.noticeTypes}
            onToggle={(value) => onChange({ ...filters, noticeTypes: toggleListValue(filters.noticeTypes, value) })}
          />
        </FilterSection>

        <FilterSection title="Well And Geography" defaultOpen>
          <InlineSelect
            label="Type"
            options={uniqueValues(rows, 'well_type_label')}
            value={filters.wellTypes[0] || ''}
            onChange={(value) => onChange({ ...filters, wellTypes: value ? [value] : [] })}
          />
          <InlineSelect
            label="Operator"
            options={uniqueValues(rows, 'operator_name')}
            value={filters.operators[0] || ''}
            onChange={(value) => onChange({ ...filters, operators: value ? [value] : [] })}
          />
          <InlineSelect
            label="Field"
            options={uniqueValues(rows, 'field_name')}
            value={filters.fields[0] || ''}
            onChange={(value) => onChange({ ...filters, fields: value ? [value] : [] })}
          />
          <InlineSelect
            label="County"
            options={uniqueValues(rows, 'county')}
            value={filters.counties[0] || ''}
            onChange={(value) => onChange({ ...filters, counties: value ? [value] : [] })}
          />
          <InlineSelect
            label="District"
            options={uniqueValues(rows, 'district')}
            value={filters.districts[0] || ''}
            onChange={(value) => onChange({ ...filters, districts: value ? [value] : [] })}
          />
        </FilterSection>

        <FilterSection title="Date Range" defaultOpen>
          <InlineInput
            label="From"
            value={filters.startDate}
            min={dateBounds.minDate}
            max={dateBounds.maxDate}
            onChange={(value) => onChange({ ...filters, startDate: value })}
          />
          <InlineInput
            label="To"
            value={filters.endDate}
            min={dateBounds.minDate}
            max={dateBounds.maxDate}
            onChange={(value) => onChange({ ...filters, endDate: value })}
          />
        </FilterSection>

        <FilterSection title="Well Details">
          <InlineSelect
            label="Status"
            options={uniqueValues(rows, 'well_status')}
            value={filters.wellStatuses[0] || ''}
            onChange={(value) => onChange({ ...filters, wellStatuses: value ? [value] : [] })}
          />
          <InlineSelect
            label="Direction"
            value={filters.directional}
            options={[
              ['all', 'All'],
              ['directional', 'Directional'],
              ['non_directional', 'Non-directional']
            ]}
            onChange={(value) => onChange({ ...filters, directional: value as Filters['directional'] })}
          />
        </FilterSection>
      </div>}
    </aside>
  );
}

function FilterSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="border border-line bg-panel/30" open={defaultOpen}>
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </summary>
      <div className="space-y-2 border-t border-line p-2">{children}</div>
    </details>
  );
}

function FilterGroup({
  options,
  selected,
  onToggle
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          <span>{option.replace('NOI - ', '')}</span>
        </label>
      ))}
    </div>
  );
}

function InlineSelect({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[] | [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-row">
      <span>{label}</span>
      <select className="input compact-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => {
          const value = Array.isArray(option) ? option[0] : option;
          const label = Array.isArray(option) ? option[1] : option;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function InlineInput({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
}) {
  const openPicker = (input: HTMLInputElement) => {
    const dateInput = input as HTMLInputElement & { showPicker?: () => void };
    try {
      dateInput.showPicker?.();
    } catch {
      // Browsers only allow showPicker during direct user activation; the native input still works.
    }
  };
  return (
    <label className="filter-row">
      <span>{label}</span>
      <input
        className="input compact-input"
        type="date"
        min={min}
        max={max}
        value={value}
        onClick={(event) => openPicker(event.currentTarget)}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
