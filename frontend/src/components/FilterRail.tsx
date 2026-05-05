import { RotateCcw } from 'lucide-react';
import { ALL_NOTICE_TYPES } from '../lib/constants';
import { defaultFilters, toggleListValue, uniqueValues } from '../lib/filters';
import type { Filters, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  filters: Filters;
  onChange: (filters: Filters) => void;
};

export function FilterRail({ rows, filters, onChange }: Props) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-ink p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Filters</h2>
          <p className="text-xs text-slate-400">Development activity by default</p>
        </div>
        <button
          className="icon-button"
          title="Reset filters"
          onClick={() => onChange(defaultFilters())}
          type="button"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto pr-1">
        <FilterGroup
          label="Notice Type"
          options={ALL_NOTICE_TYPES}
          selected={filters.noticeTypes}
          onToggle={(value) => onChange({ ...filters, noticeTypes: toggleListValue(filters.noticeTypes, value) })}
        />
        <SelectFilter
          label="Well Type"
          options={uniqueValues(rows, 'well_type_label')}
          value={filters.wellTypes[0] || ''}
          onChange={(value) => onChange({ ...filters, wellTypes: value ? [value] : [] })}
        />
        <SelectFilter
          label="Operator"
          options={uniqueValues(rows, 'operator_name')}
          value={filters.operators[0] || ''}
          onChange={(value) => onChange({ ...filters, operators: value ? [value] : [] })}
        />
        <SelectFilter
          label="Field"
          options={uniqueValues(rows, 'field_name')}
          value={filters.fields[0] || ''}
          onChange={(value) => onChange({ ...filters, fields: value ? [value] : [] })}
        />
        <div className="grid grid-cols-2 gap-2">
          <SelectFilter
            label="County"
            options={uniqueValues(rows, 'county')}
            value={filters.counties[0] || ''}
            onChange={(value) => onChange({ ...filters, counties: value ? [value] : [] })}
          />
          <SelectFilter
            label="District"
            options={uniqueValues(rows, 'district')}
            value={filters.districts[0] || ''}
            onChange={(value) => onChange({ ...filters, districts: value ? [value] : [] })}
          />
        </div>
        <SelectFilter
          label="Well Status"
          options={uniqueValues(rows, 'well_status')}
          value={filters.wellStatuses[0] || ''}
          onChange={(value) => onChange({ ...filters, wellStatuses: value ? [value] : [] })}
        />
        <label className="filter-label">
          Direction
          <select
            className="input"
            value={filters.directional}
            onChange={(event) => onChange({ ...filters, directional: event.target.value as Filters['directional'] })}
          >
            <option value="all">All</option>
            <option value="directional">Directional</option>
            <option value="non_directional">Non-directional</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="filter-label">
            From
            <input
              className="input"
              type="date"
              value={filters.startDate}
              onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
            />
          </label>
          <label className="filter-label">
            To
            <input
              className="input"
              type="date"
              value={filters.endDate}
              onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
            />
          </label>
        </div>
      </div>
    </aside>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="space-y-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              className="accent-accent"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
            />
            <span>{option.replace('NOI - ', '')}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-label">
      {label}
      <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
