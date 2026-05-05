create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.wells (
  api_10 text primary key,
  api_raw text,
  api_display text,
  wellbore_id text,
  source_object_id integer,
  lease_name text,
  well_number text,
  well_designation text,
  well_status text,
  well_type text,
  well_type_label text,
  operator_code text,
  operator_name text,
  field_name text,
  area_name text,
  district text,
  county text,
  section text,
  township text,
  range text,
  base_meridian text,
  latitude double precision,
  longitude double precision,
  gis_source text,
  is_confidential text,
  is_directionally_drilled text,
  spud_date text,
  in_hpz text,
  well_symbol text,
  wellstar_url text,
  wellfinder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.permits (
  source_key text primary key,
  source_object_id integer,
  notice_permit_number text,
  notice_dated date,
  notice_date_determination date,
  notice_status text,
  notice_type text,
  notice_type_label text,
  api_raw text,
  api_10 text,
  api_display text,
  wellbore_id text,
  lease_name text,
  well_number text,
  well_designation text,
  well_type text,
  well_type_label text,
  operator_name text,
  operator_code text,
  field_name text,
  field_code text,
  area_name text,
  area_code text,
  district text,
  county text,
  latitude double precision,
  longitude double precision,
  join_status text not null default 'permit_only',
  bottom_hole_md numeric,
  bottom_hole_tvd numeric,
  completion_top_md numeric,
  completion_bottom_md numeric,
  formation text,
  pool_code text,
  wellbore_direction text,
  depth_data_status text not null default 'linked_only',
  wellstar_url text,
  wellfinder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permits_depth_data_status_check check (
    depth_data_status in ('not_available', 'linked_only', 'scraped', 'api_source')
  ),
  constraint permits_join_status_check check (
    join_status in ('matched', 'permit_only', 'well_only')
  )
);

create table if not exists public.fields (
  source_object_id integer primary key,
  field_name text,
  field_code text,
  district text,
  district_label text,
  area_acre integer,
  geometry jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.etl_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  source_count integer not null default 0,
  upsert_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.well_detail_enrichment (
  api_10 text primary key references public.wells(api_10) on delete cascade,
  bottom_hole_md numeric,
  bottom_hole_tvd numeric,
  plugback_md numeric,
  plugback_tvd numeric,
  completion_top_md numeric,
  completion_bottom_md numeric,
  formation text,
  pool_code text,
  casing_liner_summary text,
  wellbore_direction text,
  feet_above_ground numeric,
  elevation_above_sea_level numeric,
  depth_datum text,
  depth_data_status text not null default 'not_available',
  source_url text,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint well_detail_depth_data_status_check check (
    depth_data_status in ('not_available', 'linked_only', 'scraped', 'api_source')
  )
);

create index if not exists permits_api_10_idx on public.permits(api_10);
create index if not exists permits_notice_dated_idx on public.permits(notice_dated);
create index if not exists permits_notice_type_idx on public.permits(notice_type);
create index if not exists permits_operator_name_idx on public.permits(operator_name);
create index if not exists permits_field_name_idx on public.permits(field_name);
create index if not exists permits_county_idx on public.permits(county);
create index if not exists wells_operator_name_idx on public.wells(operator_name);
create index if not exists wells_field_name_idx on public.wells(field_name);
create index if not exists wells_county_idx on public.wells(county);

drop trigger if exists set_wells_updated_at on public.wells;
create trigger set_wells_updated_at before update on public.wells
for each row execute function public.set_updated_at();

drop trigger if exists set_permits_updated_at on public.permits;
create trigger set_permits_updated_at before update on public.permits
for each row execute function public.set_updated_at();

drop trigger if exists set_fields_updated_at on public.fields;
create trigger set_fields_updated_at before update on public.fields
for each row execute function public.set_updated_at();

drop trigger if exists set_well_detail_enrichment_updated_at on public.well_detail_enrichment;
create trigger set_well_detail_enrichment_updated_at before update on public.well_detail_enrichment
for each row execute function public.set_updated_at();

create or replace view public.permit_activity as
select
  p.source_key,
  p.source_object_id,
  p.notice_permit_number,
  p.notice_dated,
  p.notice_date_determination,
  p.notice_status,
  p.notice_type,
  p.notice_type_label,
  p.api_raw,
  p.api_10,
  p.api_display,
  p.wellbore_id,
  coalesce(w.lease_name, p.lease_name) as lease_name,
  coalesce(w.well_number, p.well_number) as well_number,
  coalesce(w.well_designation, p.well_designation) as well_designation,
  coalesce(w.well_type, p.well_type) as well_type,
  coalesce(w.well_type_label, p.well_type_label) as well_type_label,
  w.well_status,
  coalesce(w.operator_name, p.operator_name) as operator_name,
  coalesce(w.operator_code, p.operator_code) as operator_code,
  coalesce(w.field_name, p.field_name) as field_name,
  p.field_code,
  coalesce(w.area_name, p.area_name) as area_name,
  p.area_code,
  coalesce(w.district, p.district) as district,
  coalesce(w.county, p.county) as county,
  coalesce(w.latitude, p.latitude) as latitude,
  coalesce(w.longitude, p.longitude) as longitude,
  w.is_directionally_drilled,
  w.spud_date,
  case when w.api_10 is null then 'permit_only' else 'matched' end as join_status,
  coalesce(e.bottom_hole_md, p.bottom_hole_md) as bottom_hole_md,
  coalesce(e.bottom_hole_tvd, p.bottom_hole_tvd) as bottom_hole_tvd,
  coalesce(e.completion_top_md, p.completion_top_md) as completion_top_md,
  coalesce(e.completion_bottom_md, p.completion_bottom_md) as completion_bottom_md,
  coalesce(e.formation, p.formation) as formation,
  coalesce(e.pool_code, p.pool_code) as pool_code,
  coalesce(e.wellbore_direction, p.wellbore_direction) as wellbore_direction,
  coalesce(e.depth_data_status, p.depth_data_status) as depth_data_status,
  coalesce(w.wellstar_url, p.wellstar_url) as wellstar_url,
  coalesce(w.wellfinder_url, p.wellfinder_url) as wellfinder_url
from public.permits p
left join public.wells w on w.api_10 = p.api_10
left join public.well_detail_enrichment e on e.api_10 = p.api_10;

alter table public.wells enable row level security;
alter table public.permits enable row level security;
alter table public.fields enable row level security;
alter table public.etl_runs enable row level security;
alter table public.well_detail_enrichment enable row level security;

drop policy if exists "public read wells" on public.wells;
create policy "public read wells" on public.wells for select using (true);

drop policy if exists "public read permits" on public.permits;
create policy "public read permits" on public.permits for select using (true);

drop policy if exists "public read fields" on public.fields;
create policy "public read fields" on public.fields for select using (true);

drop policy if exists "public read etl runs" on public.etl_runs;
create policy "public read etl runs" on public.etl_runs for select using (true);

drop policy if exists "public read well detail enrichment" on public.well_detail_enrichment;
create policy "public read well detail enrichment" on public.well_detail_enrichment for select using (true);

grant usage on schema public to anon, authenticated;
grant select on public.wells to anon, authenticated;
grant select on public.permits to anon, authenticated;
grant select on public.fields to anon, authenticated;
grant select on public.etl_runs to anon, authenticated;
grant select on public.well_detail_enrichment to anon, authenticated;
grant select on public.permit_activity to anon, authenticated;
