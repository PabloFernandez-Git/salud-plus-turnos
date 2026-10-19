begin;

do $test$
declare
  expected_public text[] := array[
    'professional_get_own_appointment(uuid,uuid)',
    'professional_list_own_appointments(uuid,date,date,appointment_status,timestamp with time zone,uuid,integer)',
    'staff_bookable_professional_centers_for_specialty(uuid,uuid)',
    'staff_get_appointment(uuid,uuid)',
    'staff_list_appointments(uuid,date,date,appointment_status,uuid,timestamp with time zone,uuid,integer)',
    'staff_list_bookable_specialties(uuid)',
    'staff_search_appointment_slots(uuid,uuid,uuid,date)'
  ];
  actual_public text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.proname)
  into actual_public
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (
    p.proname like '%appointment%' or p.proname like 'staff_list_bookable_%'
    or p.proname='staff_bookable_professional_centers_for_specialty'
  ) and p.proname <> 'staff_update_usual_appointment_duration';
  if actual_public is distinct from expected_public then
    raise exception 'TASK-009 public RPC signatures differ: %', actual_public;
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'professional_get_own_appointment','professional_list_own_appointments',
      'staff_get_appointment','staff_list_appointments',
      'staff_bookable_professional_centers_for_specialty','staff_list_bookable_specialties',
      'staff_search_appointment_slots'
    ]) and (
      not p.prosecdef or p.proconfig is distinct from array['search_path=""']::text[]
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE')
      or not has_function_privilege('authenticated',p.oid,'EXECUTE')
    )
  ) then raise exception 'TASK-009 public RPC security/grants differ'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname like '%appointment%'
      and (has_function_privilege('authenticated',p.oid,'EXECUTE')
        or has_function_privilege('anon',p.oid,'EXECUTE'))
  ) then raise exception 'TASK-009 private helper is executable by clients'; end if;
  if not (select relrowsecurity from pg_class where oid='public.appointments'::regclass)
    or has_table_privilege('authenticated','public.appointments','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.appointments','SELECT,INSERT,UPDATE,DELETE')
    or exists (select 1 from pg_policy where polrelid='public.appointments'::regclass)
  then raise exception 'Appointment table access widened'; end if;
  if not exists (
    select 1 from pg_trigger t where t.tgrelid='public.appointments'::regclass
      and t.tgname='appointments_set_updated_at'
      and t.tgfoid='private.set_task006_cas_updated_at()'::regprocedure
  ) then raise exception 'Appointment CAS trigger differs'; end if;
  if not exists (
    select 1 from pg_constraint c where c.conrelid='public.appointments'::regclass
      and c.conname='appointments_no_blocking_overlap' and c.contype='x'
      and pg_get_constraintdef(c.oid) like '%gist%'
  ) then raise exception 'Appointment GiST exclusion missing'; end if;
end;
$test$;

insert into public.centers (id,name,timezone) values
  ('90000000-0000-0000-0000-000000000001','TASK009 A','America/Argentina/Buenos_Aires'),
  ('90000000-0000-0000-0000-000000000002','TASK009 B','America/New_York');

insert into auth.users (id,email) values
  ('90000000-0000-0000-0000-000000000011','task009-admin@example.test'),
  ('90000000-0000-0000-0000-000000000012','task009-reception@example.test'),
  ('90000000-0000-0000-0000-000000000013','task009-professional@example.test'),
  ('90000000-0000-0000-0000-000000000014','task009-platform@example.test'),
  ('90000000-0000-0000-0000-000000000015','task009-inactive@example.test');
insert into public.users (id,first_name,last_name,email)
select id,'TASK009','Actor',email from auth.users
where id::text like '90000000-0000-0000-0000-00000000001%';
insert into public.platform_admins (user_id)
values ('90000000-0000-0000-0000-000000000014');

insert into public.professionals
  (id,first_name,last_name,nationality_code,document_number,email)
values ('90000000-0000-0000-0000-000000000021','Ana','Profesional','AR','TASK009-P1','private@example.test');
insert into public.professional_centers
  (id,professional_id,center_id,usual_appointment_duration_minutes)
values
  ('90000000-0000-0000-0000-000000000031','90000000-0000-0000-0000-000000000021','90000000-0000-0000-0000-000000000001',30),
  ('90000000-0000-0000-0000-000000000032','90000000-0000-0000-0000-000000000021','90000000-0000-0000-0000-000000000002',30);
insert into public.specialties (id,center_id,name) values
  ('90000000-0000-0000-0000-000000000041','90000000-0000-0000-0000-000000000001','Clínica'),
  ('90000000-0000-0000-0000-000000000042','90000000-0000-0000-0000-000000000002','Clínica B');
insert into public.professional_center_specialties
  (professional_center_id,specialty_id,center_id) values
  ('90000000-0000-0000-0000-000000000031','90000000-0000-0000-0000-000000000041','90000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000032','90000000-0000-0000-0000-000000000042','90000000-0000-0000-0000-000000000002');
insert into public.center_memberships
  (center_id,user_id,role,professional_center_id,is_active) values
  ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000011','ADMIN',null,true),
  ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000012','RECEPTION',null,true),
  ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000013','PROFESSIONAL','90000000-0000-0000-0000-000000000031',true),
  ('90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000015','RECEPTION',null,false);
insert into public.persons
  (id,first_name,last_name,birth_date,nationality_code,document_number)
values ('90000000-0000-0000-0000-000000000051','Paciente','Privado','1990-01-01','AR','TASK009-X1');
insert into public.patient_centers
  (id,person_id,center_id,phone,email,administrative_notes)
values ('90000000-0000-0000-0000-000000000061','90000000-0000-0000-0000-000000000051','90000000-0000-0000-0000-000000000001','123456','secret@example.test','SECRET PATIENT');

-- Next Monday, at least seven days out; adjacent intervals must retain their grids.
insert into public.availabilities (professional_center_id,center_id,weekday,start_time,end_time)
values
  ('90000000-0000-0000-0000-000000000031','90000000-0000-0000-0000-000000000001',1,'09:00','10:00'),
  ('90000000-0000-0000-0000-000000000031','90000000-0000-0000-0000-000000000001',1,'10:00','12:00');

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_count integer;
begin
  select count(*) into v_count from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000031',
    '90000000-0000-0000-0000-000000000041',v_day
  );
  if v_count <> 6 then raise exception 'Adjacent grids should yield 6 slots, got %',v_count; end if;
  if (select array_agg((starts_at at time zone 'America/Argentina/Buenos_Aires')::time order by starts_at)
      from public.staff_search_appointment_slots(
        '90000000-0000-0000-0000-000000000001',
        '90000000-0000-0000-0000-000000000031',
        '90000000-0000-0000-0000-000000000041',v_day
      )) is distinct from array['09:00','09:30','10:00','10:30','11:00','11:30']::time[]
  then raise exception 'Slots misaligned'; end if;
  if (select count(*) from public.staff_list_bookable_specialties('90000000-0000-0000-0000-000000000001')) <> 1
  then raise exception 'Active specialty catalog missing'; end if;
  if (select count(*) from public.staff_bookable_professional_centers_for_specialty(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000041')) <> 1
  then raise exception 'Active PC catalog missing'; end if;
  begin
    perform * from public.staff_list_appointments('90000000-0000-0000-0000-000000000002',v_day,v_day);
    raise exception 'Cross-center read accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',v_day,v_day,p_limit=>0);
    raise exception 'Zero page limit accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',v_day,v_day,p_limit=>51);
    raise exception 'Oversized page limit accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',v_day,v_day+31);
    raise exception 'Oversized date range accepted';
  exception when invalid_parameter_value then null; end;
end;
$test$;
reset role;

insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status,administrative_note)
select '90000000-0000-0000-0000-000000000071',
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000061',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  starts_at,ends_at,'PENDING','SECRET APPOINTMENT'
from private.appointment_slot_candidates(
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7))
) limit 1;

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_first timestamptz;
  v_id uuid;
begin
  if (select count(*) from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000031',
    '90000000-0000-0000-0000-000000000041',v_day)) <> 5
  then raise exception 'PENDING did not block'; end if;
  if (select count(*) from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day,p_limit=>1)) <> 1
  then raise exception 'ADMIN list missing'; end if;
  if (select administrative_note from public.staff_get_appointment(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071')) <> 'SECRET APPOINTMENT'
  then raise exception 'ADMIN detail missing note'; end if;
  select starts_at,appointment_id into v_first,v_id from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day,p_limit=>1);
  if (select count(*) from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day,
    p_cursor_starts_at=>v_first,p_cursor_id=>v_id)) <> 0
  then raise exception 'Cursor did not advance'; end if;
end;
$test$;
reset role;

savepoint task009_page_lookahead;
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status)
select '90000000-0000-0000-0000-000000000072',
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000061',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  starts_at,ends_at,'PENDING'
from private.appointment_slot_candidates(
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7))
) order by starts_at limit 1;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_first record;
  v_second record;
begin
  select * into v_first from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day,p_limit=>1);
  if not v_first.has_more then raise exception 'List lookahead not signaled'; end if;
  select * into v_second from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day,
    p_cursor_starts_at=>v_first.starts_at,p_cursor_id=>v_first.appointment_id,p_limit=>50);
  if v_second.appointment_id = v_first.appointment_id or v_second.has_more
  then raise exception 'Cursor or maximum legal page limit differs'; end if;
end;
$test$;
reset role;
rollback to savepoint task009_page_lookahead;

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
declare v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
begin
  if (select count(*) from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day)) <> 1
  then raise exception 'RECEPTION list missing'; end if;
  if (select count(*) from public.staff_get_appointment(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071')) <> 1
  then raise exception 'RECEPTION detail missing'; end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000013',true);
set local role authenticated;
do $test$
declare v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
begin
  if (select count(*) from public.professional_list_own_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day)) <> 1
  then raise exception 'Own Professional list missing'; end if;
  if (select count(*) from public.professional_get_own_appointment(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071')) <> 1
  then raise exception 'Own Professional detail missing'; end if;
  begin
    perform * from public.staff_get_appointment(
      '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071');
    raise exception 'Professional called administrative detail';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

-- The Professional projections expose only their fixed safe columns.
do $test$
begin
  if pg_get_function_result('public.professional_get_own_appointment(uuid,uuid)'::regprocedure)
    ~* 'administrative_note|document|nationality|phone|email|birth_date|insurance'
  then raise exception 'Professional detail signature leaks sensitive fields'; end if;
  if pg_get_function_result('public.professional_list_own_appointments(uuid,date,date,public.appointment_status,timestamptz,uuid,integer)'::regprocedure)
    ~* 'administrative_note|document|nationality|phone|email|birth_date|insurance'
  then raise exception 'Professional list signature leaks sensitive fields'; end if;
end;
$test$;

update public.appointments set status='CANCELLED'
where id='90000000-0000-0000-0000-000000000071';
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
begin
  if (select count(*) from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000031',
    '90000000-0000-0000-0000-000000000041',v_day)) <> 6
  then raise exception 'CANCELLED did not free slot'; end if;
end;
$test$;
reset role;

-- Every effective update in the same transaction advances the shared CAS token.
do $test$
declare v_first timestamptz; v_second timestamptz; v_third timestamptz;
begin
  select updated_at into v_first from public.appointments
  where id='90000000-0000-0000-0000-000000000071';
  update public.appointments set status='PENDING'
  where id='90000000-0000-0000-0000-000000000071';
  select updated_at into v_second from public.appointments
  where id='90000000-0000-0000-0000-000000000071';
  update public.appointments set administrative_note='NEW NOTE'
  where id='90000000-0000-0000-0000-000000000071';
  select updated_at into v_third from public.appointments
  where id='90000000-0000-0000-0000-000000000071';
  if not (v_first < v_second and v_second < v_third)
  then raise exception 'Appointment CAS did not advance monotonically'; end if;
end;
$test$;

-- All four GiST blocking states hide the interval; CANCELLED alone frees it.
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_status public.appointment_status;
begin
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
  foreach v_status in array array[
    'PENDING','CONFIRMED','ATTENDED','NO_SHOW'
  ]::public.appointment_status[] loop
    update public.appointments set status=v_status
    where id='90000000-0000-0000-0000-000000000071';
    if (select count(*) from public.staff_search_appointment_slots(
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000031',
      '90000000-0000-0000-0000-000000000041',v_day)) <> 5
    then raise exception '% failed to block',v_status; end if;
  end loop;
  update public.appointments set status='CANCELLED'
  where id='90000000-0000-0000-0000-000000000071';
  if (select count(*) from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000031',
    '90000000-0000-0000-0000-000000000041',v_day)) <> 6
  then raise exception 'CANCELLED still blocks'; end if;
end;
$test$;

-- Maximum legal active daily coverage and minimum duration reach, but never exceed, 288.
update public.availabilities set is_active=false
where professional_center_id='90000000-0000-0000-0000-000000000031';
update public.professional_centers set usual_appointment_duration_minutes=5
where id='90000000-0000-0000-0000-000000000031';
insert into public.availabilities
  (professional_center_id,center_id,weekday,start_time,end_time)
values ('90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000001',1,'00:00','24:00');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_started timestamptz := clock_timestamp();
begin
  if (select count(*) from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000001',
    '90000000-0000-0000-0000-000000000031',
    '90000000-0000-0000-0000-000000000041',v_day)) <> 288
  then raise exception 'Duration-5 maximum day is not 288'; end if;
  if (select max((starts_at at time zone 'America/Argentina/Buenos_Aires')::time)
    from public.staff_search_appointment_slots(
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000031',
      '90000000-0000-0000-0000-000000000041',v_day)) <> time '23:55'
  then raise exception 'Final five-minute slot missing'; end if;
  raise notice 'TASK009 max-day 288-slot SQL checks completed in % ms',
    round(extract(epoch from (clock_timestamp() - v_started)) * 1000, 2);
end;
$test$;
reset role;

update public.professional_centers set is_active=false
where id='90000000-0000-0000-0000-000000000031';
update public.specialties set is_active=false
where id='90000000-0000-0000-0000-000000000041';
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
begin
  if (select count(*) from public.staff_get_appointment(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071')) <> 1
  then raise exception 'Historical inactive PC/Specialty appointment hidden'; end if;
  if (select count(*) from public.staff_list_appointments(
    '90000000-0000-0000-0000-000000000001',v_day,v_day)) <> 1
  then raise exception 'Historical inactive appointment missing from list'; end if;
  if (select count(*) from public.staff_list_bookable_specialties('90000000-0000-0000-0000-000000000001')) <> 0
  then raise exception 'Inactive Specialty still bookable'; end if;
  if (select count(*) from public.staff_bookable_professional_centers_for_specialty(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000041')) <> 0
  then raise exception 'Inactive PC still bookable'; end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
declare v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
begin
  if (select count(*) from public.staff_get_appointment(
    '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071')) <> 1
    or (select count(*) from public.staff_list_appointments(
      '90000000-0000-0000-0000-000000000001',v_day,v_day)) <> 1
  then raise exception 'RECEPTION historical inactive read missing'; end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000014',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_get_appointment(
      '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071');
    raise exception 'PLATFORM_ADMIN-only access accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000015',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_get_appointment(
      '90000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000071');
    raise exception 'Inactive membership access accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

-- A second Center gains its own ADMIN only after the cross-center denial above.
insert into public.center_memberships (center_id,user_id,role)
values ('90000000-0000-0000-0000-000000000002',
  '90000000-0000-0000-0000-000000000011','ADMIN');
insert into public.availabilities
  (professional_center_id,center_id,weekday,start_time,end_time)
values ('90000000-0000-0000-0000-000000000032',
  '90000000-0000-0000-0000-000000000002',7,'00:00','04:00');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_year integer := extract(year from current_date)::integer + 1;
  v_spring date;
  v_fall date;
  v_spring_times time[];
  v_fall_times time[];
begin
  v_spring := make_date(v_year,3,1);
  v_spring := v_spring + mod(7 - extract(dow from v_spring)::integer,7) + 7;
  v_fall := make_date(v_year,11,1);
  v_fall := v_fall + mod(7 - extract(dow from v_fall)::integer,7);
  select array_agg((starts_at at time zone 'America/New_York')::time order by starts_at)
  into v_spring_times from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000032',
    '90000000-0000-0000-0000-000000000042',v_spring);
  select array_agg((starts_at at time zone 'America/New_York')::time order by starts_at)
  into v_fall_times from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000032',
    '90000000-0000-0000-0000-000000000042',v_fall);
  if v_spring_times is distinct from array['00:00','00:30','01:00','03:00','03:30']::time[]
  then raise exception 'New York nonexistent time handling differs: %',v_spring_times; end if;
  if v_fall_times is distinct from array['00:00','02:00','02:30','03:00','03:30']::time[]
  then raise exception 'New York ambiguous time handling differs: %',v_fall_times; end if;
end;
$test$;
reset role;

do $test$
declare
  v_year integer := extract(year from current_date)::integer + 1;
  v_spring date;
  v_fall date;
begin
  v_spring := make_date(v_year,3,1);
  v_spring := v_spring + mod(7 - extract(dow from v_spring)::integer,7) + 7;
  v_fall := make_date(v_year,11,1);
  v_fall := v_fall + mod(7 - extract(dow from v_fall)::integer,7);
  if (select classification from private.classify_appointment_local_time(
    v_spring::timestamp + interval '2 hours 15 minutes','America/New_York',
    array[-18000,-14400])) <> 'NONEXISTENT'
  then raise exception 'Spring gap not classified'; end if;
  if (select classification from private.classify_appointment_local_time(
    v_fall::timestamp + interval '1 hour 15 minutes','America/New_York',
    array[-18000,-14400])) <> 'AMBIGUOUS'
  then raise exception 'Fall overlap not classified'; end if;
end;
$test$;

update public.centers set timezone='Pacific/Auckland'
where id='90000000-0000-0000-0000-000000000002';
insert into public.availabilities
  (professional_center_id,center_id,weekday,start_time,end_time)
values
  ('90000000-0000-0000-0000-000000000032','90000000-0000-0000-0000-000000000002',1,'00:00','01:00'),
  ('90000000-0000-0000-0000-000000000032','90000000-0000-0000-0000-000000000002',1,'23:00','23:59');
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_day date := current_date + (7 + mod(1 - extract(isodow from current_date)::integer + 7,7));
  v_first timestamptz;
  v_last timestamptz;
  v_count integer;
begin
  select min(starts_at),max(starts_at),count(*) into v_first,v_last,v_count
  from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000032',
    '90000000-0000-0000-0000-000000000042',v_day);
  if v_count <> 3 or v_first::date <> v_day - 1
    or (v_first at time zone 'Pacific/Auckland')::time <> time '00:00'
    or (v_last at time zone 'Pacific/Auckland')::time <> time '23:00'
  then raise exception 'Local-day boundary or 23:59 containment differs'; end if;
end;
$test$;
reset role;

-- Future 30-minute transition zone is selected from the live PostgreSQL catalog.
do $test$
declare
  v_zone text;
  v_date date;
  v_offsets integer[];
  v_transition timestamptz;
  v_old_offset integer;
  v_new_offset integer;
  v_local timestamp;
  v_classification text;
  v_slot_count integer;
begin
  select name into v_zone from pg_timezone_names
  where name in ('Australia/Lord_Howe','Australia/LHI')
  order by case when name='Australia/Lord_Howe' then 0 else 1 end limit 1;
  if v_zone is null then raise exception 'No 30-minute transition zone in tzdata'; end if;
  select day_at::date into v_date
  from generate_series(current_date + 1,current_date + 1460,interval '1 day') as day_at
  where abs(extract(epoch from (
    ((day_at + interval '1 day') at time zone v_zone) - (day_at at time zone v_zone)
  )) - 86400) = 1800
  order by day_at limit 1;
  if v_date is null then raise exception 'No future 30-minute transition found'; end if;
  select array_agg(offset_seconds) into v_offsets
  from private.appointment_utc_offsets(v_zone,v_date);
  if cardinality(v_offsets) <> 2 then
    raise exception '30-minute transition offsets missing';
  end if;
  with probes as (
    select tick as instant,
      extract(epoch from ((tick at time zone v_zone) - (tick at time zone 'UTC')))::integer
        as offset_seconds
    from generate_series(
      (v_date::timestamp at time zone 'UTC') - interval '15 hours',
      (v_date::timestamp at time zone 'UTC') + interval '39 hours',
      interval '1 minute'
    ) as tick
  ), changes as (
    select instant,lag(offset_seconds) over (order by instant) as old_offset,
      offset_seconds as new_offset from probes
  )
  select instant,old_offset,new_offset
  into v_transition,v_old_offset,v_new_offset
  from changes where abs(new_offset-old_offset)=1800
  order by instant limit 1;
  if v_transition is null then
    raise exception '30-minute transition instant not found';
  end if;
  v_local := (v_transition at time zone 'UTC')
    + make_interval(secs => least(v_old_offset,v_new_offset))
    + interval '15 minutes';
  select classification into v_classification
  from private.classify_appointment_local_time(v_local,v_zone,v_offsets);
  if v_classification is distinct from (case
    when v_new_offset > v_old_offset then 'NONEXISTENT' else 'AMBIGUOUS' end)
  then raise exception '30-minute transition classified as %',v_classification; end if;
  v_date := (v_transition at time zone v_zone)::date;
  if extract(isodow from v_date) <> 7 then
    raise exception 'Selected 30-minute transition was not Sunday';
  end if;
  update public.centers set timezone=v_zone
  where id='90000000-0000-0000-0000-000000000002';
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
  select count(*) into v_slot_count from public.staff_search_appointment_slots(
    '90000000-0000-0000-0000-000000000002',
    '90000000-0000-0000-0000-000000000032',
    '90000000-0000-0000-0000-000000000042',v_date);
  if v_slot_count < 1 or v_slot_count >= 8 then
    raise exception '30-minute transition slots not filtered: %',v_slot_count;
  end if;
end;
$test$;

-- A conservative UTC envelope includes adjacent local dates. The exact local
-- predicate must remove those false positives, including at DST boundaries.
savepoint task009_list_date_boundaries;
update public.centers set timezone='Pacific/Auckland'
where id='90000000-0000-0000-0000-000000000001';
update public.professional_centers set is_active=true
where id='90000000-0000-0000-0000-000000000031';
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status)
select fixture.id::uuid,
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000061',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  fixture.local_start at time zone 'Pacific/Auckland',
  (fixture.local_start at time zone 'Pacific/Auckland') + interval '1 minute',
  'CANCELLED'
from (values
  ('90000000-0000-0000-0000-000000000081','2027-04-03 23:59'::timestamp),
  ('90000000-0000-0000-0000-000000000082','2027-04-04 00:00'::timestamp),
  ('90000000-0000-0000-0000-000000000083','2027-04-04 23:59'::timestamp),
  ('90000000-0000-0000-0000-000000000084','2027-04-05 00:00'::timestamp)
) as fixture(id,local_start);
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_actual uuid[];
  v_expected uuid[] := array[
    '90000000-0000-0000-0000-000000000082'::uuid,
    '90000000-0000-0000-0000-000000000083'::uuid];
begin
  if ('2027-04-04 00:00'::timestamp at time zone 'Pacific/Auckland')::date
      = date '2027-04-04' then
    raise exception 'Auckland test does not cross a UTC date';
  end if;
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
  select array_agg(appointment_id order by starts_at) into v_actual
  from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',
    date '2027-04-04',date '2027-04-04');
  if v_actual is distinct from v_expected then
    raise exception 'Auckland ADMIN local boundary list differs: %',v_actual;
  end if;
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000012',true);
  select array_agg(appointment_id order by starts_at) into v_actual
  from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',
    date '2027-04-04',date '2027-04-04');
  if v_actual is distinct from v_expected then
    raise exception 'Auckland RECEPTION local boundary list differs: %',v_actual;
  end if;
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000013',true);
  select array_agg(appointment_id order by starts_at) into v_actual
  from public.professional_list_own_appointments(
    '90000000-0000-0000-0000-000000000001',date '2027-04-04',date '2027-04-04');
  if v_actual is distinct from v_expected then
    raise exception 'Auckland Professional local boundary list differs: %',v_actual;
  end if;
end;
$test$;
reset role;
rollback to savepoint task009_list_date_boundaries;

savepoint task009_list_dst_boundaries;
update public.centers set timezone='America/New_York'
where id='90000000-0000-0000-0000-000000000001';
update public.professional_centers set is_active=true
where id='90000000-0000-0000-0000-000000000031';
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status)
select fixture.id::uuid,
  '90000000-0000-0000-0000-000000000001',
  '90000000-0000-0000-0000-000000000061',
  '90000000-0000-0000-0000-000000000031',
  '90000000-0000-0000-0000-000000000041',
  fixture.local_start at time zone 'America/New_York',
  (fixture.local_start at time zone 'America/New_York') + interval '1 minute',
  'CANCELLED'
from (values
  ('90000000-0000-0000-0000-000000000085','2027-03-13 23:59'::timestamp),
  ('90000000-0000-0000-0000-000000000086','2027-03-14 00:00'::timestamp),
  ('90000000-0000-0000-0000-000000000087','2027-03-14 23:59'::timestamp),
  ('90000000-0000-0000-0000-000000000088','2027-03-15 00:00'::timestamp)
) as fixture(id,local_start);
set local role authenticated;
do $test$
declare
  v_actual uuid[];
  v_expected uuid[] := array[
    '90000000-0000-0000-0000-000000000086'::uuid,
    '90000000-0000-0000-0000-000000000087'::uuid];
begin
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000011',true);
  select array_agg(appointment_id order by starts_at) into v_actual
  from public.staff_list_appointments('90000000-0000-0000-0000-000000000001',
    date '2027-03-14',date '2027-03-14');
  if v_actual is distinct from v_expected then
    raise exception 'New York ADMIN DST boundary list differs: %',v_actual;
  end if;
  perform set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000013',true);
  select array_agg(appointment_id order by starts_at) into v_actual
  from public.professional_list_own_appointments(
    '90000000-0000-0000-0000-000000000001',date '2027-03-14',date '2027-03-14');
  if v_actual is distinct from v_expected then
    raise exception 'New York Professional DST boundary list differs: %',v_actual;
  end if;
end;
$test$;
reset role;
rollback to savepoint task009_list_dst_boundaries;

rollback;

