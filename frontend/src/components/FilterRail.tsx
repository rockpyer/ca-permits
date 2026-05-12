import { PanelLeftClose, PanelLeftOpen, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { defaultFilters, toggleListValue, uniqueValues } from '../lib/filters';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  functionalTypeLabel,
  workActivityColor,
  workActivityLabel,
  type WorkActivityGroup,
  type FunctionalTypeGroup
} from '../lib/grouping';
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
    <aside className="flex min-h-0 flex-col border-b border-line bg-ink p-2.5 lg:h-full lg:border-b-0 lg:border-r">
      <div className="mb-2 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Filters</h2>
            <p className="text-xs text-slate-500">Development scope by default</p>
          </div>
        )}
        {collapsed && (
          <div className="lg:hidden">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Filters</h2>
            <p className="text-xs text-slate-500">Tap to expand controls</p>
          </div>
        )}
        <div className={`flex gap-2 ${collapsed ? 'lg:flex-col' : ''}`}>
          <button
            className="icon-button"
            title="Reset filters"
            onClick={() => onChange(defaultFilters(dateBounds))}
            type="button"
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button border-slate-500 bg-panel/80"
            title={collapsed ? 'Expand filters' : 'Collapse filters'}
            onClick={() => onCollapsedChange(!collapsed)}
            type="button"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1 lg:max-h-none">
        <FilterSection title="Work Activity" defaultOpen>
          <FilterGroup
            options={WORK_ACTIVITY_GROUPS.map((item) => item.key)}
            selected={filters.workActivities}
            labelFor={(value) => workActivityLabel(value as WorkActivityGroup)}
            colorFor={(value) => workActivityColor(value as WorkActivityGroup)}
            onToggle={(value) => onChange({ ...filters, workActivities: toggleListValue(filters.workActivities, value) })}
          />
        </FilterSection>

        <FilterSection title="Functional Type" defaultOpen>
          <FilterGroup
            options={FUNCTIONAL_TYPE_GROUPS.map((item) => item.key)}
            selected={filters.functionalTypes}
            labelFor={(value) => functionalTypeLabel(value as FunctionalTypeGroup)}
            onToggle={(value) =>
              onChange({ ...filters, functionalTypes: toggleListValue(filters.functionalTypes, value) })
            }
          />
        </FilterSection>

        <FilterSection title="Well And Geography" defaultOpen>
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

        <FilterSection
          title="Date Range"
          defaultOpen
          actions={<DateRangeChips filters={filters} dateBounds={dateBounds} onChange={onChange} />}
        >
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

function FilterSection({
  title,
  defaultOpen,
  actions,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="border border-line bg-panel/30" open={defaultOpen}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span>{title}</span>
        {actions && <span onClick={(event) => event.preventDefault()}>{actions}</span>}
      </summary>
      <div className="space-y-1.5 border-t border-line p-2">{children}</div>
    </details>
  );
}

function FilterGroup({
  options,
  selected,
  labelFor,
  colorFor,
  onToggle
}: {
  options: string[];
  selected: string[];
  labelFor?: (value: string) => string;
  colorFor?: (value: string) => string;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-2">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-1.5 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 accent-accent"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
          />
          <span style={{ color: colorFor?.(option) }}>{labelFor?.(option) || option}</span>
        </label>
      ))}
    </div>
  );
}

function DateRangeChips({
  filters,
  dateBounds,
  onChange
}: {
  filters: Filters;
  dateBounds: { minDate: string; maxDate: string };
  onChange: (filters: Filters) => void;
}) {
  const setQuickRange = (days: number | 'all') => {
    if (!dateBounds.maxDate) return;
    if (days === 'all') {
      onChange({ ...filters, startDate: dateBounds.minDate, endDate: dateBounds.maxDate });
      return;
    }
    const startDate = shiftDate(dateBounds.maxDate, -(days - 1));
    onChange({
      ...filters,
      startDate: dateBounds.minDate && startDate < dateBounds.minDate ? dateBounds.minDate : startDate,
      endDate: dateBounds.maxDate
    });
  };

  return (
    <span className="inline-flex gap-1 normal-case tracking-normal">
      {[30, 60, 90].map((days) => (
        <button
          key={days}
          className="border border-line bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-accent hover:text-white"
          type="button"
          onClick={() => setQuickRange(days)}
        >
          {days}D
        </button>
      ))}
      <button
        className="border border-line bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-accent hover:text-white"
        type="button"
        onClick={() => setQuickRange('all')}
      >
        All
      </button>
    </span>
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

function shiftDate(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
