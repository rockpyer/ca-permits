// One approved ECMC Form 2 permit, joined to its well (WELLS_SHP) and, while undrilled,
// to its permit point (PERMITS_SHP). Columns match CO_COLUMNS in scripts/snapshot-co.mjs.
export type CoPermit = {
  source_key: string;
  api_display: string | null;
  api_8: string | null;
  operator_name: string | null;
  operator_number: string | null;
  well_name: string | null;
  approved_date: string | null;
  permit_type: string | null;
  location_id: number | null;
  location_name: string | null;
  form2a_approved_date: string | null;
  latitude: number | null;
  longitude: number | null;
  qtr_qtr: string | null;
  section: string | null;
  township: string | null;
  range: string | null;
  county: string | null;
  objective_formation: string | null;
  proposed_td: number | null;
  field_name: string | null;
  field_code: string | null;
  well_status: string | null;
  well_status_date: string | null;
  spud_date: string | null;
  max_md: number | null;
  max_tvd: number | null;
  well_class: string | null;
  current_operator: string | null;
  in_wells_layer: boolean | null;
  undrilled_permit: boolean | null;
  permit_expiration_date: string | null;
};

export type CoMeta = {
  generatedAt: string;
  permitCount: number;
  dateBounds: { minDate: string; maxDate: string };
  checkedDate: string;
  lastRun: { finished_at: string; source_count: number } | null;
};

export type CoFilters = {
  startDate: string;
  endDate: string;
  operators: string[];
  counties: string[];
  formations: string[];
  permitTypes: string[];
  lifecycles: string[];
};
