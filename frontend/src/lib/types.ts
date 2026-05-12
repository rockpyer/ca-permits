export type PermitActivity = {
  source_key: string;
  source_object_id: number | null;
  notice_permit_number: string | null;
  notice_dated: string | null;
  notice_date_determination: string | null;
  notice_status: string | null;
  notice_type: string | null;
  notice_type_label: string | null;
  api_raw: string | null;
  api_10: string | null;
  api_display: string | null;
  wellbore_id: string | null;
  lease_name: string | null;
  well_number: string | null;
  well_designation: string | null;
  well_type: string | null;
  well_type_label: string | null;
  well_status: string | null;
  operator_name: string | null;
  operator_code: string | null;
  field_name: string | null;
  field_code: string | null;
  area_name: string | null;
  area_code: string | null;
  district: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  is_directionally_drilled: string | null;
  spud_date: string | null;
  join_status: 'matched' | 'permit_only' | 'well_only';
  bottom_hole_md: number | null;
  bottom_hole_tvd: number | null;
  completion_top_md: number | null;
  completion_bottom_md: number | null;
  formation: string | null;
  pool_code: string | null;
  wellbore_direction: string | null;
  depth_data_status: 'not_available' | 'linked_only' | 'scraped' | 'api_source';
  wellstar_url: string | null;
  wellfinder_url: string | null;
};

export type FieldBoundary = {
  source_object_id: number;
  field_name: string | null;
  field_code: string | null;
  district: string | null;
  district_label: string | null;
  area_acre: number | null;
  geometry: unknown;
};

export type EtlRun = {
  id: string;
  source: string;
  status: string;
  source_count: number;
  upsert_count: number;
  finished_at: string | null;
};

export type Filters = {
  workActivities: string[];
  functionalTypes: string[];
  operators: string[];
  fields: string[];
  counties: string[];
  districts: string[];
  wellStatuses: string[];
  directional: 'all' | 'directional' | 'non_directional';
  startDate: string;
  endDate: string;
};
