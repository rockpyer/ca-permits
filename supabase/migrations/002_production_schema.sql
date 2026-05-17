-- 002: Operator annual production table for decline analysis

create table if not exists public.operator_annual_production (
  id text primary key,
  operator_name text not null,
  operator_code text,
  year integer not null,
  oil_bbl bigint not null default 0,
  gas_mcf bigint not null default 0,
  water_bbl bigint not null default 0,
  producing_well_count integer not null default 0,
  county text,
  district text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists oap_operator_name_idx on public.operator_annual_production(operator_name);
create index if not exists oap_year_idx on public.operator_annual_production(year);
create index if not exists oap_county_idx on public.operator_annual_production(county);
create index if not exists oap_oil_bbl_idx on public.operator_annual_production(oil_bbl desc);

drop trigger if exists set_oap_updated_at on public.operator_annual_production;
create trigger set_oap_updated_at before update on public.operator_annual_production
for each row execute function public.set_updated_at();

alter table public.operator_annual_production enable row level security;

drop policy if exists "public read operator annual production" on public.operator_annual_production;
create policy "public read operator annual production" on public.operator_annual_production
  for select using (true);

grant select on public.operator_annual_production to anon, authenticated;
