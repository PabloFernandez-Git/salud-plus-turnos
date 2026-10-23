-- Local, disposable database only. Creates 10,000 appointments and rolls back.
-- Run with psql -X -v ON_ERROR_STOP=1 -f after the migration is applied.
begin;

insert into public.centers (id, name, timezone)
select 'a2120000-0000-0000-0000-000000000001', 'TASK021 PERF',
  case when extract(hour from pg_catalog.statement_timestamp() at time zone 'UTC') < 11
    then 'UTC' else 'Pacific/Honolulu' end;
insert into auth.users (id, email)
values ('a2120000-0000-0000-0000-000000000011', 'task021-perf-admin@example.test');
insert into public.users (id, first_name, last_name, email)
values ('a2120000-0000-0000-0000-000000000011', 'TASK021', 'Perf', 'task021-perf-admin@example.test');
insert into auth.users (id, email)
values ('a2120000-0000-0000-0000-000000000012', 'task021-perf-prof@example.test');
insert into public.users (id, first_name, last_name, email)
values ('a2120000-0000-0000-0000-000000000012', 'TASK021', 'Perf Professional',
  'task021-perf-prof@example.test');
insert into public.center_memberships (center_id, user_id, role)
values ('a2120000-0000-0000-0000-000000000001',
  'a2120000-0000-0000-0000-000000000011', 'ADMIN');
insert into public.persons (id, first_name, last_name, birth_date, nationality_code, document_number)
values ('a2120000-0000-0000-0000-000000000051', 'Perf', 'Patient', '1990-01-01', 'AR', 'TASK021-PERF-X');
insert into public.patient_centers (id, person_id, center_id, phone)
values ('a2120000-0000-0000-0000-000000000061',
  'a2120000-0000-0000-0000-000000000051',
  'a2120000-0000-0000-0000-000000000001', '100000');
insert into public.specialties (id, center_id, name)
values ('a2120000-0000-0000-0000-000000000041',
  'a2120000-0000-0000-0000-000000000001', 'Perf Specialty');

create temp table task021_perf_pc as
select n, gen_random_uuid() as professional_id, gen_random_uuid() as pc_id
from generate_series(1,100) as n;
insert into public.professionals
  (id, first_name, last_name, nationality_code, document_number, email)
select professional_id, 'Perf', n::text, 'AR', 'TASK021-PERF-' || n,
  'task021-perf-' || n || '@example.test' from task021_perf_pc;
insert into public.professional_centers (id, professional_id, center_id)
select pc_id, professional_id, 'a2120000-0000-0000-0000-000000000001'
from task021_perf_pc;
insert into public.professional_center_specialties
  (professional_center_id, specialty_id, center_id)
select pc_id, 'a2120000-0000-0000-0000-000000000041',
  'a2120000-0000-0000-0000-000000000001' from task021_perf_pc;
insert into public.center_memberships
  (center_id, user_id, role, professional_center_id)
select 'a2120000-0000-0000-0000-000000000001',
  'a2120000-0000-0000-0000-000000000012', 'PROFESSIONAL', pc_id
from task021_perf_pc where n = 1;

insert into public.appointments
  (center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status)
select 'a2120000-0000-0000-0000-000000000001',
  'a2120000-0000-0000-0000-000000000061', pc.pc_id,
  'a2120000-0000-0000-0000-000000000041',
  boundary.day_start + slot.n * interval '5 minutes',
  boundary.day_start + (slot.n+1) * interval '5 minutes',
  case slot.n % 5 when 0 then 'PENDING' when 1 then 'CONFIRMED'
    when 2 then 'ATTENDED' when 3 then 'NO_SHOW' else 'CANCELLED'
  end::public.appointment_status
from task021_perf_pc as pc
cross join generate_series(0,99) as slot(n)
cross join lateral (
  select date_trunc('minute', pg_catalog.statement_timestamp()) + interval '5 minutes' as day_start
) as boundary;

analyze public.appointments;

-- RPC timing alone is opaque (Function Scan), but confirms end-to-end payload.
select set_config('request.jwt.claim.sub', 'a2120000-0000-0000-0000-000000000011', true);
set local role authenticated;
explain (analyze, buffers, timing off)
select * from public.staff_get_daily_dashboard('a2120000-0000-0000-0000-000000000001');
reset role;
select set_config('request.jwt.claim.sub', 'a2120000-0000-0000-0000-000000000012', true);
set local role authenticated;
explain (analyze, buffers, timing off)
select * from public.professional_get_own_daily_dashboard('a2120000-0000-0000-0000-000000000001');
reset role;

-- The representative core scan exposes index choice, filter rows and buffers.
-- Match this predicate to both RPCs whenever the migration changes.
explain (analyze, buffers, timing off)
with params as (
  select c.id as center_id, c.timezone,
    (pg_catalog.statement_timestamp() at time zone c.timezone)::date as local_date,
    pg_catalog.statement_timestamp() as as_of
  from public.centers as c
  where c.id = 'a2120000-0000-0000-0000-000000000001'
), day_appointments as materialized (
  select a.id, a.starts_at, a.status, a.professional_center_id
  from public.appointments as a cross join params as p
  where a.center_id = p.center_id
    and a.starts_at >= (p.local_date::timestamp at time zone 'UTC') - interval '15 hours'
    and a.starts_at < ((p.local_date+1)::timestamp at time zone 'UTC') + interval '15 hours'
    and (a.starts_at at time zone p.timezone)::date = p.local_date
), counts as (
  select count(*) filter (where status = 'PENDING') as pending_count,
    count(*) filter (where status = 'CONFIRMED') as confirmed_count,
    count(*) filter (where status = 'ATTENDED') as attended_count,
    count(*) filter (where status = 'NO_SHOW') as no_show_count,
    count(*) filter (where status = 'CANCELLED') as cancelled_count,
    count(distinct professional_center_id) filter (where status <> 'CANCELLED') as pc_count
  from day_appointments
), next_five as (
  select id, starts_at from day_appointments cross join params
  where status in ('PENDING','CONFIRMED') and starts_at >= params.as_of
  order by starts_at, id limit 5
)
select counts.*, (select count(*) from next_five) as upcoming_count from counts;

explain (analyze, buffers, timing off)
with params as (
  select c.id as center_id,
    (select pc_id from task021_perf_pc where n = 1) as professional_center_id,
    c.timezone,
    (pg_catalog.statement_timestamp() at time zone c.timezone)::date as local_date,
    pg_catalog.statement_timestamp() as as_of
  from public.centers as c
  where c.id = 'a2120000-0000-0000-0000-000000000001'
), day_appointments as materialized (
  select a.id, a.starts_at, a.status
  from public.appointments as a cross join params as p
  where a.center_id = p.center_id
    and a.professional_center_id = p.professional_center_id
    and a.starts_at >= (p.local_date::timestamp at time zone 'UTC') - interval '15 hours'
    and a.starts_at < ((p.local_date+1)::timestamp at time zone 'UTC') + interval '15 hours'
    and (a.starts_at at time zone p.timezone)::date = p.local_date
), counts as (
  select count(*) filter (where status = 'PENDING') as pending_count,
    count(*) filter (where status = 'CONFIRMED') as confirmed_count,
    count(*) filter (where status = 'ATTENDED') as attended_count,
    count(*) filter (where status = 'NO_SHOW') as no_show_count,
    count(*) filter (where status = 'CANCELLED') as cancelled_count
  from day_appointments
), next_five as (
  select id, starts_at from day_appointments cross join params
  where status in ('PENDING','CONFIRMED') and starts_at >= params.as_of
  order by starts_at, id limit 5
)
select counts.*, (select count(*) from next_five) as upcoming_count from counts;

-- Inspect both plans for unexpected sequential scans, excessive heap reads,
-- sorts spilling to disk and the difference between 10,000 counted and 5 output.
rollback;
