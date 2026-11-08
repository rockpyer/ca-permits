// One WOGCC APD joined to its APD detail page (by API) and its well record. Columns match
// APD_COLUMNS in scripts/snapshot-wy.mjs.
export type WyApd = {
  source_key: string;
  api: string | null;
  well_name: string | null;
  well_class: string | null;
  operator_name: string | null;
  confidential: boolean | null;
  apd_status: string | null;
  apd_status_date: string | null;
  county: string | null;
  field_name: string | null;
  reservoir: string | null;
  received_date: string | null;
  approved_date: string | null;
  denied_date: string | null;
  /** New, Renewal, Re-entry or Deepen. */
  application_type: string | null;
  shl_trs: string | null;
  bhl_trs: string | null;
  deviation: string | null;
  latitude: number | null;
  longitude: number | null;
  bhl_latitude: number | null;
  bhl_longitude: number | null;
  well_status: string | null;
  well_status_date: string | null;
  spud_date: string | null;
  completion_date: string | null;
  /** From the APD detail page; null until that page has been fetched. */
  mineral_class: string | null;
  surface_owner: string | null;
  federal_lease: string | null;
  proposed_md: number | null;
  proposed_tvd: number | null;
  multi_well_pad: boolean | null;
};

/** A Wyoming well spudded since the history start, from the Standard Well report. */
export type WySpud = {
  api: string;
  spud_date: string;
  completion_date: string | null;
  well_name: string | null;
  well_class: string | null;
  operator_name: string | null;
  county: string | null;
  field_name: string | null;
  reservoir: string | null;
  well_status: string | null;
  lease: string | null;
  mineral_class: string;
  latitude: number | null;
  longitude: number | null;
};

export type WyRigWeek = { date: string; wyoming?: number };

export type WyMeta = {
  generatedAt: string;
  apdCount: number;
  spudCount: number;
  detailCount: number;
  detailMissing: number;
  dateBounds: { minDate: string; maxDate: string };
  checkedDate: string;
  historyStart: string;
  lastRun: { finished_at: string; source_count: number; details?: Record<string, unknown> } | null;
};

export type WyFilters = {
  startDate: string;
  endDate: string;
  operators: string[];
  counties: string[];
  reservoirs: string[];
  minerals: string[];
  applicationTypes: string[];
  stages: string[];
};
