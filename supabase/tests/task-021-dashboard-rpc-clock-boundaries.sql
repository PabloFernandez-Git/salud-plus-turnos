-- Disposable local PostgreSQL only. The POSIX zones put a 23-hour and a
-- 25-hour civil day on the actual server date; no system clock is changed.
begin;

do $test$
begin
  if (pg_catalog.statement_timestamp() at time zone 'UTC')::date <> date '2026-10-22' then
    raise exception 'This synthetic DST fixture is pinned to 2026-10-22';
  end if;
  if ((date '2026-10-23'::timestamp at time zone 'EST5EDT,M10.4.4/2,M11.1.0/2')
      - (date '2026-10-22'::timestamp at time zone 'EST5EDT,M10.4.4/2,M11.1.0/2')) <> interval '23 hours'
    or ((date '2026-10-23'::timestamp at time zone 'EST5EDT,M3.2.0/2,M10.4.4/2')
      - (date '2026-10-22'::timestamp at time zone 'EST5EDT,M3.2.0/2,M10.4.4/2')) <> interval '25 hours' then
    raise exception 'POSIX zone transitions differ';
  end if;
end;
$test$;

insert into public.centers (id, name, timezone) values
  ('a2140000-0000-0000-0000-000000000001', 'TASK021 spring', 'EST5EDT,M10.4.4/2,M11.1.0/2'),
  ('a2140000-0000-0000-0000-000000000002', 'TASK021 fall', 'EST5EDT,M3.2.0/2,M10.4.4/2');
insert into auth.users (id, email) values
  ('a2140000-0000-0000-0000-000000000011', 'task021-clock-admin@example.test'),
  ('a2140000-0000-0000-0000-000000000012', 'task021-clock-prof@example.test');
insert into public.users (id, first_name, last_name, email) values
  ('a2140000-0000-0000-0000-000000000011', 'Clock', 'Admin', 'task021-clock-admin@example.test'),
  ('a2140000-0000-0000-0000-000000000012', 'Clock', 'Professional', 'task021-clock-prof@example.test');
insert into public.professionals (id, first_name, last_name, nationality_code, document_number, email)
values ('a2140000-0000-0000-0000-000000000021', 'Clock', 'Professional', 'AR', 'TASK021-CLOCK-P', 'task021-clock-p@example.test');
insert into public.professional_centers (id, professional_id, center_id) values
  ('a2140000-0000-0000-0000-000000000031', 'a2140000-0000-0000-0000-000000000021', 'a2140000-0000-0000-0000-000000000001'),
  ('a2140000-0000-0000-0000-000000000032', 'a2140000-0000-0000-0000-000000000021', 'a2140000-0000-0000-0000-000000000002');
insert into public.specialties (id, center_id, name) values
  ('a2140000-0000-0000-0000-000000000041', 'a2140000-0000-0000-0000-000000000001', 'Clock spring'),
  ('a2140000-0000-0000-0000-000000000042', 'a2140000-0000-0000-0000-000000000002', 'Clock fall');
insert into public.professional_center_specialties (professional_center_id, specialty_id, center_id) values
  ('a2140000-0000-0000-0000-000000000031', 'a2140000-0000-0000-0000-000000000041', 'a2140000-0000-0000-0000-000000000001'),
  ('a2140000-0000-0000-0000-000000000032', 'a2140000-0000-0000-0000-000000000042', 'a2140000-0000-0000-0000-000000000002');
insert into public.center_memberships (center_id, user_id, role, professional_center_id) values
  ('a2140000-0000-0000-0000-000000000001', 'a2140000-0000-0000-0000-000000000011', 'ADMIN', null),
  ('a2140000-0000-0000-0000-000000000002', 'a2140000-0000-0000-0000-000000000011', 'ADMIN', null),
  ('a2140000-0000-0000-0000-000000000001', 'a2140000-0000-0000-0000-000000000012', 'PROFESSIONAL', 'a2140000-0000-0000-0000-000000000031'),
  ('a2140000-0000-0000-0000-000000000002', 'a2140000-0000-0000-0000-000000000012', 'PROFESSIONAL', 'a2140000-0000-0000-0000-000000000032');
insert into public.persons (id, first_name, last_name, birth_date, nationality_code, document_number)
values ('a2140000-0000-0000-0000-000000000051', 'Clock', 'Patient', '1990-01-01', 'AR', 'TASK021-CLOCK-X');
insert into public.patient_centers (id, person_id, center_id, phone) values
  ('a2140000-0000-0000-0000-000000000061', 'a2140000-0000-0000-0000-000000000051', 'a2140000-0000-0000-0000-000000000001', '100001'),
  ('a2140000-0000-0000-0000-000000000062', 'a2140000-0000-0000-0000-000000000051', 'a2140000-0000-0000-0000-000000000002', '100002');

with zones as (
  select id as center_id, timezone, (pg_catalog.statement_timestamp() at time zone timezone)::date as local_date,
    case when id = 'a2140000-0000-0000-0000-000000000001' then 1 else 2 end as n
  from public.centers where id in ('a2140000-0000-0000-0000-000000000001', 'a2140000-0000-0000-0000-000000000002')
), bounds as (
  select *, local_date::timestamp at time zone timezone as day_start,
    (local_date + 1)::timestamp at time zone timezone as next_day_start from zones
)
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id, starts_at, ends_at, status)
select ('a2140000-0000-0000-0000-' || lpad((n*10 + slot)::text, 12, '0'))::uuid,
  center_id,
  case n when 1 then 'a2140000-0000-0000-0000-000000000061'::uuid else 'a2140000-0000-0000-0000-000000000062'::uuid end,
  case n when 1 then 'a2140000-0000-0000-0000-000000000031'::uuid else 'a2140000-0000-0000-0000-000000000032'::uuid end,
  case n when 1 then 'a2140000-0000-0000-0000-000000000041'::uuid else 'a2140000-0000-0000-0000-000000000042'::uuid end,
  case slot when 1 then day_start when 2 then next_day_start - interval '1 minute' else next_day_start end,
  case slot when 1 then day_start + interval '1 minute' when 2 then next_day_start else next_day_start + interval '1 minute' end,
  case slot when 1 then 'PENDING' when 2 then 'CONFIRMED' else 'CANCELLED' end::public.appointment_status
from bounds cross join generate_series(1,3) as slot;

select set_config('request.jwt.claim.sub','a2140000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare v record; c record;
begin
  for c in select id, timezone from public.centers where id in
    ('a2140000-0000-0000-0000-000000000001', 'a2140000-0000-0000-0000-000000000002') loop
    select * into strict v from public.staff_get_daily_dashboard(c.id);
    if v.local_date <> date '2026-10-22' or v.timezone <> c.timezone
      or v.pending_count <> 1 or v.confirmed_count <> 1 or v.cancelled_count <> 0
      or jsonb_array_length(v.upcoming) <> 1
      or (v.upcoming->0->>'status') <> 'CONFIRMED' then
      raise exception 'staff DST boundary failed for %', c.id;
    end if;
    raise notice 'staff DST RPC: %, local date %, pending %, confirmed %, next %',
      c.timezone, v.local_date, v.pending_count, v.confirmed_count, v.upcoming->0->>'appointment_id';
  end loop;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','a2140000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
declare v record; c record;
begin
  for c in select id, timezone from public.centers where id in
    ('a2140000-0000-0000-0000-000000000001', 'a2140000-0000-0000-0000-000000000002') loop
    select * into strict v from public.professional_get_own_daily_dashboard(c.id);
    if v.local_date <> date '2026-10-22' or v.timezone <> c.timezone
      or v.pending_count <> 1 or v.confirmed_count <> 1 or v.cancelled_count <> 0
      or jsonb_array_length(v.upcoming) <> 1
      or (v.upcoming->0->>'status') <> 'CONFIRMED' then
      raise exception 'professional DST boundary failed for %', c.id;
    end if;
    raise notice 'professional DST RPC: %, local date %, pending %, confirmed %, next %',
      c.timezone, v.local_date, v.pending_count, v.confirmed_count, v.upcoming->0->>'appointment_id';
  end loop;
end;
$test$;
reset role;

-- One client statement fixes statement_timestamp() for the inserted row and
-- both RPC calls. Separate statements inside this volatile DO see the insert.
do $test$
declare v_exact timestamptz := pg_catalog.statement_timestamp(); s record; p record;
begin
  insert into public.appointments
    (id, center_id, patient_center_id, professional_center_id, specialty_id, starts_at, ends_at, status)
  values ('a2140000-0000-0000-0000-000000000077',
    'a2140000-0000-0000-0000-000000000001',
    'a2140000-0000-0000-0000-000000000061',
    'a2140000-0000-0000-0000-000000000031',
    'a2140000-0000-0000-0000-000000000041',
    v_exact, v_exact + interval '5 minutes', 'PENDING');
  perform set_config('request.jwt.claim.sub','a2140000-0000-0000-0000-000000000011',true);
  execute 'set local role authenticated';
  select * into strict s from public.staff_get_daily_dashboard('a2140000-0000-0000-0000-000000000001');
  if s.as_of <> v_exact or s.pending_count <> 2 or jsonb_array_length(s.upcoming) <> 2
    or s.upcoming->0->>'appointment_id' <> 'a2140000-0000-0000-0000-000000000077' then
    raise exception 'staff exact as_of boundary failed';
  end if;
  perform set_config('request.jwt.claim.sub','a2140000-0000-0000-0000-000000000012',true);
  select * into strict p from public.professional_get_own_daily_dashboard('a2140000-0000-0000-0000-000000000001');
  if p.as_of <> v_exact or p.pending_count <> 2 or jsonb_array_length(p.upcoming) <> 2
    or p.upcoming->0->>'appointment_id' <> 'a2140000-0000-0000-0000-000000000077' then
    raise exception 'professional exact as_of boundary failed';
  end if;
  raise notice 'exact as_of RPC: %, staff next %, professional next %',
    v_exact, s.upcoming->0->>'appointment_id', p.upcoming->0->>'appointment_id';
  execute 'reset role';
end;
$test$;

rollback;
