-- Run only after explicit authorization, against a disposable LOCAL database.
-- All fixtures and changes are rolled back, including auth.users.
begin;

do $test$
declare p record;
begin
  for p in
    select oid, proname from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('staff_get_daily_dashboard', 'professional_get_own_daily_dashboard')
  loop
    if not p.oid::regprocedure::text like '%(uuid)'
      or not (select prosecdef and provolatile = 's' and proconfig = array['search_path=""']::text[]
              from pg_proc where oid = p.oid)
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('service_role', p.oid, 'EXECUTE')
      or not has_function_privilege('authenticated', p.oid, 'EXECUTE') then
      raise exception 'Dashboard RPC security contract differs: %', p.proname;
    end if;
  end loop;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
      and proname in ('staff_get_daily_dashboard', 'professional_get_own_daily_dashboard')) <> 2
    or has_table_privilege('authenticated', 'public.appointments', 'SELECT')
    or has_table_privilege('anon', 'public.appointments', 'SELECT') then
    raise exception 'Dashboard RPC count or appointments grants differ';
  end if;
end;
$test$;

create temp table task021_clock as
select pg_catalog.statement_timestamp() as now_at,
  case
    when extract(hour from pg_catalog.statement_timestamp() at time zone 'UTC') < 5
      then 'Pacific/Kiritimati'
    when extract(hour from pg_catalog.statement_timestamp() at time zone 'UTC') < 15
      then 'UTC'
    else 'Pacific/Honolulu'
  end::text as zone_name;

insert into public.centers (id, name, timezone) values
  ('a2100000-0000-0000-0000-000000000001', 'TASK021 A', (select zone_name from task021_clock)),
  ('a2100000-0000-0000-0000-000000000002', 'TASK021 B', 'Pacific/Kiritimati');

insert into auth.users (id, email) values
  ('a2100000-0000-0000-0000-000000000011', 'task021-admin@example.test'),
  ('a2100000-0000-0000-0000-000000000012', 'task021-reception@example.test'),
  ('a2100000-0000-0000-0000-000000000013', 'task021-prof1@example.test'),
  ('a2100000-0000-0000-0000-000000000014', 'task021-prof2@example.test'),
  ('a2100000-0000-0000-0000-000000000015', 'task021-platform@example.test'),
  ('a2100000-0000-0000-0000-000000000016', 'task021-inactive@example.test'),
  ('a2100000-0000-0000-0000-000000000017', 'task021-other-center@example.test'),
  ('a2100000-0000-0000-0000-000000000018', 'task021-no-membership@example.test');
insert into public.users (id, first_name, last_name, email)
select id, 'TASK021', 'Actor', email from auth.users
where id::text like 'a2100000-0000-0000-0000-00000000001%';
insert into public.platform_admins (user_id)
values ('a2100000-0000-0000-0000-000000000015');

insert into public.professionals (id, first_name, last_name, nationality_code, document_number, email)
values
  ('a2100000-0000-0000-0000-000000000021', 'Profesional', 'Uno', 'AR', 'TASK021-P1', 'p1@example.test'),
  ('a2100000-0000-0000-0000-000000000022', 'Profesional', 'Dos', 'AR', 'TASK021-P2', 'p2@example.test');
insert into public.professional_centers (id, professional_id, center_id) values
  ('a2100000-0000-0000-0000-000000000031', 'a2100000-0000-0000-0000-000000000021', 'a2100000-0000-0000-0000-000000000001'),
  ('a2100000-0000-0000-0000-000000000032', 'a2100000-0000-0000-0000-000000000022', 'a2100000-0000-0000-0000-000000000001'),
  ('a2100000-0000-0000-0000-000000000033', 'a2100000-0000-0000-0000-000000000021', 'a2100000-0000-0000-0000-000000000002');
insert into public.specialties (id, center_id, name) values
  ('a2100000-0000-0000-0000-000000000041', 'a2100000-0000-0000-0000-000000000001', 'Clínica A'),
  ('a2100000-0000-0000-0000-000000000042', 'a2100000-0000-0000-0000-000000000002', 'Clínica B');
insert into public.professional_center_specialties (professional_center_id, specialty_id, center_id) values
  ('a2100000-0000-0000-0000-000000000031', 'a2100000-0000-0000-0000-000000000041', 'a2100000-0000-0000-0000-000000000001'),
  ('a2100000-0000-0000-0000-000000000032', 'a2100000-0000-0000-0000-000000000041', 'a2100000-0000-0000-0000-000000000001'),
  ('a2100000-0000-0000-0000-000000000033', 'a2100000-0000-0000-0000-000000000042', 'a2100000-0000-0000-0000-000000000002');
insert into public.center_memberships (center_id, user_id, role, professional_center_id, is_active) values
  ('a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000011', 'ADMIN', null, true),
  ('a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000012', 'RECEPTION', null, true),
  ('a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000013', 'PROFESSIONAL', 'a2100000-0000-0000-0000-000000000031', true),
  ('a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000014', 'PROFESSIONAL', 'a2100000-0000-0000-0000-000000000032', true),
  ('a2100000-0000-0000-0000-000000000001', 'a2100000-0000-0000-0000-000000000016', 'RECEPTION', null, false),
  ('a2100000-0000-0000-0000-000000000002', 'a2100000-0000-0000-0000-000000000017', 'ADMIN', null, true);
insert into public.persons (id, first_name, last_name, birth_date, nationality_code, document_number)
values ('a2100000-0000-0000-0000-000000000051', 'Paciente', 'Visible', '1990-01-01', 'AR', 'TASK021-X1');
insert into public.patient_centers (id, person_id, center_id, phone, email, administrative_notes) values
  ('a2100000-0000-0000-0000-000000000061', 'a2100000-0000-0000-0000-000000000051', 'a2100000-0000-0000-0000-000000000001', 'SECRET-PHONE', 'secret@example.test', 'SECRET-PATIENT-NOTE'),
  ('a2100000-0000-0000-0000-000000000062', 'a2100000-0000-0000-0000-000000000051', 'a2100000-0000-0000-0000-000000000002', 'SECRET-PHONE-B', null, null);

select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 0 or r.confirmed_count <> 0 or r.attended_count <> 0
    or r.no_show_count <> 0 or r.cancelled_count <> 0
    or r.professional_centers_with_appointments_count <> 0 or r.upcoming <> '[]'::jsonb
    or r.local_date <> (r.as_of at time zone r.timezone)::date then
    raise exception 'Zero-row dashboard contract differs';
  end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000014', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 0 or r.cancelled_count <> 0 or r.upcoming <> '[]'::jsonb then
    raise exception 'Empty own-professional dashboard differs';
  end if;
end;
$test$;
reset role;

-- Choose a local morning to leave enough of today's hours for >50 five-minute slots.
create temp table task021_base as
select date_trunc('minute', now_at) + interval '10 minutes' as base_at
from task021_clock;
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status)
select 'a2100000-0000-0000-0000-000000000080',
  'a2100000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000061',
  'a2100000-0000-0000-0000-000000000031',
  'a2100000-0000-0000-0000-000000000041',
  base_at, base_at + interval '5 minutes', 'CANCELLED'
from task021_base;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count + r.confirmed_count + r.attended_count + r.no_show_count <> 0
    or r.cancelled_count <> 1 or r.upcoming <> '[]'::jsonb then
    raise exception 'Cancelled-only empty state differs';
  end if;
end;
$test$;
reset role;
delete from public.appointments where id = 'a2100000-0000-0000-0000-000000000080';

create temp table task021_seed as
select n,
  ('a2110000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid as id,
  'a2100000-0000-0000-0000-000000000001'::uuid as center_id,
  'a2100000-0000-0000-0000-000000000061'::uuid as patient_center_id,
  'a2100000-0000-0000-0000-000000000031'::uuid as professional_center_id,
  'a2100000-0000-0000-0000-000000000041'::uuid as specialty_id,
  base_at + (n-1) * interval '5 minutes' as starts_at,
  base_at + n * interval '5 minutes' as ends_at,
  case when n <= 51 then 'PENDING'
    when n = 52 then 'CONFIRMED' when n = 53 then 'ATTENDED'
    when n = 54 then 'NO_SHOW' else 'CANCELLED' end::public.appointment_status as status,
  'SECRET-APPOINTMENT-NOTE'::text as administrative_note
from generate_series(1,55) as n cross join task021_base;
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status, administrative_note)
select id, center_id, patient_center_id, professional_center_id, specialty_id,
  starts_at, ends_at, status, administrative_note from task021_seed where n = 1;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 1 or jsonb_array_length(r.upcoming) <> 1 then
    raise exception 'One-appointment dashboard differs';
  end if;
end;
$test$;
reset role;
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status, administrative_note)
select id, center_id, patient_center_id, professional_center_id, specialty_id,
  starts_at, ends_at, status, administrative_note from task021_seed where n between 2 and 50;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 50 or jsonb_array_length(r.upcoming) <> 5 then
    raise exception '50-appointment dashboard differs';
  end if;
end;
$test$;
reset role;
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status, administrative_note)
select id, center_id, patient_center_id, professional_center_id, specialty_id,
  starts_at, ends_at, status, administrative_note from task021_seed where n between 51 and 55;
-- Same starts_at, different ProfessionalCenter: deterministic id tiebreak.
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id, starts_at, ends_at, status)
select 'a2100000-0000-0000-0000-000000000070',
  'a2100000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000061',
  'a2100000-0000-0000-0000-000000000032',
  'a2100000-0000-0000-0000-000000000041', base_at, base_at + interval '5 minutes', 'PENDING'
from task021_base;
-- Other center: the same Person is not authority to see another center's appointment.
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id, starts_at, ends_at, status)
select 'a2100000-0000-0000-0000-000000000071',
  'a2100000-0000-0000-0000-000000000002',
  'a2100000-0000-0000-0000-000000000062',
  'a2100000-0000-0000-0000-000000000033',
  'a2100000-0000-0000-0000-000000000042', base_at, base_at + interval '5 minutes', 'PENDING'
from task021_base;

select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record; ids uuid[];
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if (r.pending_count, r.confirmed_count, r.attended_count, r.no_show_count, r.cancelled_count,
      r.professional_centers_with_appointments_count)
      is distinct from (52::bigint,1::bigint,1::bigint,1::bigint,1::bigint,2::bigint)
    or r.pending_count + r.confirmed_count + r.attended_count + r.no_show_count <> 55
    or jsonb_array_length(r.upcoming) <> 5 then
    raise exception 'Staff >50 totals or upcoming cap differ';
  end if;
  select array_agg((item->>'appointment_id')::uuid order by ordinal) into ids
  from jsonb_array_elements(r.upcoming) with ordinality as x(item, ordinal);
  if ids[1] <> 'a2100000-0000-0000-0000-000000000070'
    or ids[2] <> 'a2110000-0000-0000-0000-000000000001'
    or exists (select 1 from jsonb_array_elements(r.upcoming) as x(item)
      where (x.item->>'starts_at')::timestamptz < r.as_of
        or x.item->>'status' not in ('PENDING','CONFIRMED')) then
    raise exception 'Staff upcoming ordering or as_of cut differs';
  end if;
  if (select array_agg(key order by key) from jsonb_object_keys(r.upcoming->0) as key)
    is distinct from array['appointment_id','ends_at','patient_first_name','patient_last_name',
      'professional_center_id','professional_first_name','professional_last_name',
      'specialty_name','starts_at','status']::text[] then
    raise exception 'Staff projection differs';
  end if;
  if r.upcoming::text like '%SECRET%' or r.upcoming::text like '%example.test%' then
    raise exception 'Sensitive data leaked in staff projection';
  end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000012', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 52 or r.professional_centers_with_appointments_count <> 2 then
    raise exception 'RECEPTION totals differ';
  end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000013', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if (r.pending_count,r.confirmed_count,r.attended_count,r.no_show_count,r.cancelled_count)
      is distinct from (51::bigint,1::bigint,1::bigint,1::bigint,1::bigint)
    or jsonb_array_length(r.upcoming) <> 5
    or r.upcoming->0->>'appointment_id' <> 'a2110000-0000-0000-0000-000000000001'
    or (select array_agg(key order by key) from jsonb_object_keys(r.upcoming->0) as key)
      is distinct from array['appointment_id','ends_at','patient_first_name',
        'patient_last_name','specialty_name','starts_at','status']::text[]
    or r.upcoming::text like '%SECRET%' or r.upcoming::text like '%example.test%'
    or to_jsonb(r) ? 'professional_centers_with_appointments_count' then
    raise exception 'Professional own totals/projection differ';
  end if;
  begin
    perform * from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
    raise exception 'Professional used staff RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000002');
    raise exception 'Professional crossed centers';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000014', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 1 or r.confirmed_count <> 0 or jsonb_array_length(r.upcoming) <> 1
    or r.upcoming->0->>'appointment_id' <> 'a2100000-0000-0000-0000-000000000070' then
    raise exception 'Second professional saw foreign activity';
  end if;
end;
$test$;
reset role;

-- Open appointment already started today remains counted but not upcoming;
-- an open appointment tomorrow contributes to neither today's count nor list.
savepoint task021_temporal_edges;
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status)
select 'a2100000-0000-0000-0000-000000000081',
  'a2100000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000061',
  'a2100000-0000-0000-0000-000000000032',
  'a2100000-0000-0000-0000-000000000041',
  pg_catalog.statement_timestamp() - interval '5 minutes',
  pg_catalog.statement_timestamp(), 'PENDING';
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status)
select 'a2100000-0000-0000-0000-000000000082',
  'a2100000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000061',
  'a2100000-0000-0000-0000-000000000032',
  'a2100000-0000-0000-0000-000000000041',
  ((pg_catalog.statement_timestamp() at time zone zone_name)::date + 1)::timestamp
    at time zone zone_name,
  (((pg_catalog.statement_timestamp() at time zone zone_name)::date + 1)::timestamp
    at time zone zone_name) + interval '5 minutes', 'PENDING'
from task021_clock;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 53 or r.upcoming::text like '%000000000081%'
    or r.upcoming::text like '%000000000082%'
    or jsonb_array_length(r.upcoming) <> 5 then
    raise exception 'Past/open and next-day/open boundaries differ';
  end if;
end;
$test$;
reset role;
rollback to savepoint task021_temporal_edges;

-- Denials: cross-center, no membership, inactive membership, inactive link,
-- and PLATFORM_ADMIN without center membership. Each must be SQLSTATE 42501.
do $test$
declare v_actor uuid;
begin
  foreach v_actor in array array[
    'a2100000-0000-0000-0000-000000000015'::uuid,
    'a2100000-0000-0000-0000-000000000016'::uuid,
    'a2100000-0000-0000-0000-000000000017'::uuid,
    'a2100000-0000-0000-0000-000000000018'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    execute 'set local role authenticated';
    begin
      perform * from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
      raise exception 'Unauthorized staff read for %', v_actor;
    exception when insufficient_privilege then null; end;
    begin
      perform * from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000001');
      raise exception 'Unauthorized professional read for %', v_actor;
    exception when insufficient_privilege then null; end;
    execute 'reset role';
  end loop;
end;
$test$;
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000002');
    raise exception 'Cross-center staff read';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

update public.professional_centers set is_active = false
where id = 'a2100000-0000-0000-0000-000000000031';
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000013', true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.professional_get_own_daily_dashboard('a2100000-0000-0000-0000-000000000001');
    raise exception 'Inactive ProfessionalCenter read';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

-- These old appointments must remain in staff totals after related entities deactivate.
update public.specialties set is_active = false where id = 'a2100000-0000-0000-0000-000000000041';
update public.patient_centers set is_active = false where id = 'a2100000-0000-0000-0000-000000000061';
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 52 or jsonb_array_length(r.upcoming) <> 5 then
    raise exception 'Historical related-entity deactivation changed dashboard';
  end if;
end;
$test$;
reset role;

savepoint task021_no_upcoming;
update public.appointments set status = 'ATTENDED'
where center_id = 'a2100000-0000-0000-0000-000000000001'
  and status in ('PENDING', 'CONFIRMED');
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.attended_count = 0 or r.upcoming <> '[]'::jsonb then
    raise exception 'Active totals with no upcoming differ';
  end if;
end;
$test$;
reset role;
rollback to savepoint task021_no_upcoming;

-- Current status and current scheduled day define totals, not update time.
update public.appointments set status = 'CANCELLED'
where id = 'a2100000-0000-0000-0000-000000000070';
update public.appointments set starts_at = starts_at + interval '1 day',
  ends_at = ends_at + interval '1 day'
where id = 'a2110000-0000-0000-0000-000000000055';
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000011', true);
set local role authenticated;
do $test$
declare r record;
begin
  select * into strict r from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000001');
  if r.pending_count <> 51 or r.cancelled_count <> 1
    or r.professional_centers_with_appointments_count <> 1 then
    raise exception 'Cancellation/reschedule current-state totals differ';
  end if;
end;
$test$;
reset role;

-- An inactive Center denies its own active ADMIN without returning zeroes.
update public.centers set is_active = false
where id = 'a2100000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', 'a2100000-0000-0000-0000-000000000017', true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_get_daily_dashboard('a2100000-0000-0000-0000-000000000002');
    raise exception 'Inactive Center read';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

-- Deterministic temporal geometry for both DST transitions, independent of
-- today's real date. These validate the same date predicate and conservative
-- index bounds used in the RPC; the wall clock is not injectable into the RPC.
do $test$
declare d date; z text := 'America/New_York'; lower_utc timestamptz; upper_utc timestamptz;
  first_instant timestamptz; last_instant timestamptz;
  cut_at timestamptz := '2026-11-01 05:30+00'::timestamptz;
begin
  foreach d in array array['2026-03-08'::date, '2026-11-01'::date] loop
    first_instant := d::timestamp at time zone z;
    last_instant := (d+1)::timestamp at time zone z;
    lower_utc := (d::timestamp at time zone 'UTC') - interval '15 hours';
    upper_utc := ((d+1)::timestamp at time zone 'UTC') + interval '15 hours';
    if (d = '2026-03-08' and last_instant - first_instant <> interval '23 hours')
      or (d = '2026-11-01' and last_instant - first_instant <> interval '25 hours')
      or not (first_instant >= lower_utc and first_instant < upper_utc)
      or not (last_instant - interval '1 microsecond' >= lower_utc
              and last_instant - interval '1 microsecond' < upper_utc)
      or (first_instant at time zone z)::date <> d
      or ((last_instant - interval '1 microsecond') at time zone z)::date <> d
      or (last_instant at time zone z)::date = d then
      raise exception 'DST boundary failed for %', d;
    end if;
  end loop;
  if ('2026-11-01 01:30-04'::timestamptz at time zone z)
       <> ('2026-11-01 01:30-05'::timestamptz at time zone z)
    or '2026-11-01 01:30-04'::timestamptz = '2026-11-01 01:30-05'::timestamptz then
    raise exception 'Repeated DST hour geometry differs';
  end if;
  if ('2026-10-22 00:30+00'::timestamptz at time zone 'Pacific/Kiritimati')::date
       = ('2026-10-22 00:30+00'::timestamptz at time zone 'Pacific/Honolulu')::date
    or (select count(*) from unnest(array[
      cut_at - interval '1 microsecond', cut_at, cut_at + interval '1 microsecond'
    ]) as candidate(starts_at) where starts_at >= cut_at) <> 2 then
    raise exception 'Distinct IANA centers or exact temporal cuts differ';
  end if;
end;
$test$;

rollback;
