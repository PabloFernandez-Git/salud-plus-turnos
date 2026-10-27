begin;

insert into public.centers (id,name,timezone) values
  ('91000000-0000-0000-0000-000000000001','B0 A','America/Argentina/Buenos_Aires'),
  ('91000000-0000-0000-0000-000000000002','B0 B','America/New_York');
insert into auth.users (id,email) values
  ('91000000-0000-0000-0000-000000000011','b0-admin@example.test'),
  ('91000000-0000-0000-0000-000000000012','b0-reception@example.test'),
  ('91000000-0000-0000-0000-000000000013','b0-professional@example.test'),
  ('91000000-0000-0000-0000-000000000014','b0-platform@example.test'),
  ('91000000-0000-0000-0000-000000000015','b0-inactive@example.test');
insert into public.users (id,first_name,last_name,email)
select id,'B0','Actor',email from auth.users
where id::text like '91000000-0000-0000-0000-00000000001%';
insert into public.platform_admins (user_id)
values ('91000000-0000-0000-0000-000000000014');
insert into public.professionals
  (id,first_name,last_name,nationality_code,document_number,email)
values
  ('91000000-0000-0000-0000-000000000021','B0','Professional','AR','B0-P1','b0-prof@example.test'),
  ('91000000-0000-0000-0000-000000000022','B0','Other','AR','B0-P2','b0-other@example.test');
insert into public.professional_centers
  (id,professional_id,center_id,usual_appointment_duration_minutes)
values
  ('91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000021','91000000-0000-0000-0000-000000000001',30),
  ('91000000-0000-0000-0000-000000000032','91000000-0000-0000-0000-000000000021','91000000-0000-0000-0000-000000000002',30),
  ('91000000-0000-0000-0000-000000000033','91000000-0000-0000-0000-000000000022','91000000-0000-0000-0000-000000000001',30);
insert into public.specialties (id,center_id,name) values
  ('91000000-0000-0000-0000-000000000041','91000000-0000-0000-0000-000000000001','B0 A'),
  ('91000000-0000-0000-0000-000000000042','91000000-0000-0000-0000-000000000002','B0 B');
insert into public.professional_center_specialties
  (professional_center_id,specialty_id,center_id) values
  ('91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041','91000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000032','91000000-0000-0000-0000-000000000042','91000000-0000-0000-0000-000000000002'),
  ('91000000-0000-0000-0000-000000000033','91000000-0000-0000-0000-000000000041','91000000-0000-0000-0000-000000000001');
insert into public.center_memberships
  (center_id,user_id,role,professional_center_id,is_active) values
  ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000011','ADMIN',null,true),
  ('91000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000011','ADMIN',null,true),
  ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000012','RECEPTION',null,true),
  ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000013','PROFESSIONAL','91000000-0000-0000-0000-000000000031',true),
  ('91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000015','RECEPTION',null,false);
insert into public.persons
  (id,first_name,last_name,birth_date,nationality_code,document_number)
values ('91000000-0000-0000-0000-000000000051','B0','Patient','1990-01-01','AR','B0-X1');
insert into public.patient_centers
  (id,person_id,center_id,phone)
values
  ('91000000-0000-0000-0000-000000000061','91000000-0000-0000-0000-000000000051','91000000-0000-0000-0000-000000000001','123456'),
  ('91000000-0000-0000-0000-000000000062','91000000-0000-0000-0000-000000000051','91000000-0000-0000-0000-000000000002','123456');
insert into public.availabilities (professional_center_id,center_id,weekday,start_time,end_time)
values
  ('91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000001',1,'09:00','12:00'),
  ('91000000-0000-0000-0000-000000000032','91000000-0000-0000-0000-000000000002',7,'01:00','04:00'),
  ('91000000-0000-0000-0000-000000000033','91000000-0000-0000-0000-000000000001',1,'09:00','12:00'),
  ('91000000-0000-0000-0000-000000000033','91000000-0000-0000-0000-000000000001',1,'13:00','15:00');

do $test$
declare
  v_count integer;
  v_signatures text[];
begin
  select array_agg(p.oid::regprocedure::text order by p.proname)
  into v_signatures
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('staff_create_appointment','staff_reschedule_appointment',
     'staff_transition_appointment_status','staff_update_appointment_note');
  if v_signatures is distinct from array[
    'staff_create_appointment(uuid,uuid,uuid,uuid,date,time without time zone,text)',
    'staff_reschedule_appointment(uuid,uuid,timestamp with time zone,uuid,uuid,date,time without time zone)',
    'staff_transition_appointment_status(uuid,uuid,timestamp with time zone,text)',
    'staff_update_appointment_note(uuid,uuid,timestamp with time zone,text)'
  ]::text[] then raise exception 'B0 RPC signatures differ: %',v_signatures; end if;
  select count(*) into v_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
    ('staff_create_appointment','staff_reschedule_appointment',
     'staff_transition_appointment_status','staff_update_appointment_note')
    and p.prosecdef and p.proconfig=array['search_path=""']::text[]
    and pg_get_userbyid(p.proowner)='postgres'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE');
  if v_count <> 4 then raise exception 'B0 signatures/security/grants differ'; end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in
      ('appointment_slot_grid','appointment_lock_booking_entities',
       'appointment_resolve_requested_slot')
      and (has_function_privilege('authenticated',p.oid,'EXECUTE')
        or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('service_role',p.oid,'EXECUTE'))
  ) then raise exception 'B0 private helper executable by client'; end if;
  if not (select relrowsecurity from pg_class where oid='public.appointments'::regclass)
    or has_table_privilege('authenticated','public.appointments','SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon','public.appointments','SELECT,INSERT,UPDATE,DELETE')
    or exists (select 1 from pg_policy where polrelid='public.appointments'::regclass)
  then raise exception 'B0 RLS/generic access widened'; end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.appointments'::regclass
      and conname='appointments_administrative_note_length_check'
  ) then raise exception 'B0 note limit missing'; end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.appointments'::regclass
      and conname='appointments_no_blocking_overlap' and contype='x'
  ) then raise exception 'B0 GiST missing'; end if;
  if not exists (
    select 1 from pg_trigger where tgrelid='public.appointments'::regclass
      and tgname='appointments_set_updated_at'
      and tgfoid='private.set_task006_cas_updated_at()'::regprocedure
  ) then raise exception 'B0 CAS trigger missing'; end if;
  if pg_get_function_result(
    'public.staff_transition_appointment_status(uuid,uuid,timestamptz,text)'::regprocedure
  ) like '%note%'
  then raise exception 'Status response exposes note'; end if;
end;
$test$;

select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_id uuid;
  v_token timestamptz;
  v_next timestamptz;
  v_start timestamptz;
  v_note text;
begin
  select starts_at into v_start from public.staff_search_appointment_slots(
    '91000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07')
  where starts_at at time zone 'America/Argentina/Buenos_Aires' = '2030-01-07 09:00'::timestamp;
  if v_start is null then raise exception 'Search did not expose 09:00'; end if;
  select appointment_id, updated_at into v_id,v_token
  from public.staff_create_appointment(
    '91000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000061',
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07','09:00','initial note');
  if v_id is null or (select starts_at from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001',v_id)) <> v_start
    or (select status from public.staff_get_appointment(
      '91000000-0000-0000-0000-000000000001',v_id)) <> 'PENDING'
  then raise exception 'Create/search parity or PENDING failed'; end if;
  select updated_at into v_next from public.staff_update_appointment_note(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,'initial note');
  if v_next <> v_token then raise exception 'Note no-op advanced CAS'; end if;
  select updated_at into v_next from public.staff_update_appointment_note(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,null);
  if v_next <= v_token then raise exception 'Note CAS not monotonic'; end if;
  v_token := v_next;
  begin
    perform * from public.staff_update_appointment_note(
      '91000000-0000-0000-0000-000000000001',v_id,v_token - interval '1 microsecond','stale');
    raise exception 'Stale note accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'STALE_APPOINTMENT_STATE' then raise; end if;
  end;
  select updated_at into v_next from public.staff_reschedule_appointment(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07','09:00');
  if v_next <> v_token then raise exception 'Same-slot reschedule advanced CAS'; end if;
  select updated_at into v_next from public.staff_reschedule_appointment(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07','10:00');
  if v_next <= v_token then raise exception 'Reschedule CAS not monotonic'; end if;
  v_token := v_next;
  if (select patient_center_id from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001',v_id))
    <> '91000000-0000-0000-0000-000000000061'::uuid
  then raise exception 'Reschedule changed patient'; end if;
  select updated_at into v_next from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,'CONFIRMED');
  if v_next <= v_token then raise exception 'Status CAS not monotonic'; end if;
  v_token := v_next;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001',v_id,v_token,'CONFIRMED');
    raise exception 'Same-status transition accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'INVALID_STATUS_TRANSITION' then raise; end if;
  end;
  select updated_at into v_next from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001',v_id,v_token,'CANCELLED');
  if v_next <= v_token then raise exception 'Cancel CAS not monotonic'; end if;
  select updated_at into v_token from public.staff_update_appointment_note(
    '91000000-0000-0000-0000-000000000001',v_id,v_next,repeat('x',2000));
  if v_token <= v_next then raise exception 'Maximum note length rejected'; end if;
  begin
    perform * from public.staff_update_appointment_note(
      '91000000-0000-0000-0000-000000000001',v_id,v_token,repeat('x',2001));
    raise exception 'Overlong note update accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_INPUT' then raise; end if;
  end;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001',v_id,v_token,'ATTENDED');
    raise exception 'Terminal transition accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'INVALID_STATUS_TRANSITION' then raise; end if;
  end;
  perform * from public.staff_create_appointment(
    '91000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000061',
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07','10:00',null);
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','10:00',null);
    raise exception 'Occupied slot accepted';
  exception when exclusion_violation then
    if sqlerrm <> 'SLOT_ALREADY_TAKEN' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000062',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:00',null);
    raise exception 'Cross-center PatientCenter accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'PATIENT_NOT_AVAILABLE' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','09:15',null);
    raise exception 'Off-grid slot accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'OUTSIDE_AVAILABILITY' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:00',
      repeat('x',2001));
    raise exception 'Overlong note accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_INPUT' then raise; end if;
  end;
end;
$test$;

reset role;
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status)
values
  ('91000000-0000-0000-0000-000000000071',
   '91000000-0000-0000-0000-000000000001',
   '91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000033',
   '91000000-0000-0000-0000-000000000041',
   '2030-01-07 12:00+00','2030-01-07 12:30+00','PENDING');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
begin
  perform * from public.staff_create_appointment(
    '91000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000061',
    '91000000-0000-0000-0000-000000000031',
    '91000000-0000-0000-0000-000000000041','2030-01-07','11:00',null);
end;
$test$;

reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000013',true);
set local role authenticated;
do $test$
declare v_id uuid; v_token timestamptz; v_status public.appointment_status;
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Professional created appointment';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000071',pg_catalog.statement_timestamp(),
      'ATTENDED');
    raise exception 'Professional changed another PC appointment';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000002',
      '91000000-0000-0000-0000-000000000071',pg_catalog.statement_timestamp(),
      'ATTENDED');
    raise exception 'Professional cross-center mutation accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
  select appointment_id, updated_at into v_id,v_token
  from public.professional_list_own_appointments(
    '91000000-0000-0000-0000-000000000001','2030-01-07','2030-01-07')
  where starts_at at time zone 'America/Argentina/Buenos_Aires' = '2030-01-07 11:00'::timestamp;
  if v_id is null then raise exception 'Professional own projection missing'; end if;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001',v_id,v_token,'NO_SHOW');
    raise exception 'Professional marked future NO_SHOW';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'APPOINTMENT_TIME_RESTRICTION' then raise; end if;
  end;
  begin
    perform * from public.staff_update_appointment_note(
      '91000000-0000-0000-0000-000000000001',v_id,v_token,'forbidden');
    raise exception 'Professional note accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
end;
$test$;

reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000014',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'PLATFORM_ADMIN-only created appointment';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
end;
$test$;

reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000015',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive member created appointment';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
end;
$test$;

reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_id uuid;
  v_token timestamptz;
  v_start timestamptz;
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2030-01-07','11:30',null);
    raise exception 'Cross-center PC accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'PROFESSIONAL_NOT_AVAILABLE' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000042','2030-01-07','11:30',null);
    raise exception 'Cross-center Specialty accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'SPECIALTY_NOT_AVAILABLE' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2020-01-06','09:00',null);
    raise exception 'Past appointment accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'APPOINTMENT_IN_PAST' then raise; end if;
  end;

  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000002',
      '91000000-0000-0000-0000-000000000062',
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2027-03-14','02:30',null);
    raise exception 'DST gap accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_LOCAL_TIME' then raise; end if;
  end;
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000002',
      '91000000-0000-0000-0000-000000000062',
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2027-11-07','01:30',null);
    raise exception 'DST overlap accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'AMBIGUOUS_LOCAL_TIME' then raise; end if;
  end;
  select starts_at into v_start from public.staff_search_appointment_slots(
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000032',
    '91000000-0000-0000-0000-000000000042','2027-03-14')
  where starts_at at time zone 'America/New_York' = '2027-03-14 03:00'::timestamp;
  if v_start is null then raise exception 'DST valid slot missing from search'; end if;
  select appointment_id,updated_at into v_id,v_token
  from public.staff_create_appointment(
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000062',
    '91000000-0000-0000-0000-000000000032',
    '91000000-0000-0000-0000-000000000042','2027-03-14','03:00',null);
  if (select starts_at from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000002',v_id)) <> v_start
  then raise exception 'DST search/create parity failed'; end if;
  begin
    perform * from public.staff_reschedule_appointment(
      '91000000-0000-0000-0000-000000000002',v_id,v_token,
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2027-03-14','02:30');
    raise exception 'Reschedule accepted DST gap';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_LOCAL_TIME' then raise; end if;
  end;
  begin
    perform * from public.staff_reschedule_appointment(
      '91000000-0000-0000-0000-000000000002',v_id,v_token,
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2027-11-07','01:30');
    raise exception 'Reschedule accepted DST overlap';
  exception when sqlstate '22023' then
    if sqlerrm <> 'AMBIGUOUS_LOCAL_TIME' then raise; end if;
  end;
end;
$test$;

do $test$
declare
  v_times time[] := array['09:30','10:00','10:30','11:00','11:30','13:00','13:30']::time[];
  v_targets text[] := array[
    'CONFIRMED','ATTENDED','NO_SHOW','CANCELLED',
    'ATTENDED','NO_SHOW','CANCELLED'
  ];
  v_id uuid;
  v_token timestamptz;
  v_status public.appointment_status;
begin
  for i in 1..7 loop
    select appointment_id,updated_at into v_id,v_token
    from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000033',
      '91000000-0000-0000-0000-000000000041',
      '2030-01-07',v_times[i],null);
    if i >= 5 then
      select updated_at into v_token from public.staff_transition_appointment_status(
        '91000000-0000-0000-0000-000000000001',v_id,v_token,'CONFIRMED');
    end if;
    if i in (2,3,5,6) then
      begin
        perform * from public.staff_transition_appointment_status(
          '91000000-0000-0000-0000-000000000001',v_id,v_token,v_targets[i]);
        raise exception 'Future status accepted at %',i;
      exception when sqlstate 'P0001' then
        if sqlerrm <> 'APPOINTMENT_TIME_RESTRICTION' then raise; end if;
      end;
    else
      select status into v_status from public.staff_transition_appointment_status(
        '91000000-0000-0000-0000-000000000001',v_id,v_token,v_targets[i]);
      if v_status::text <> v_targets[i] then raise exception 'Status matrix mismatch at %',i; end if;
    end if;
  end loop;
end;
$test$;

-- TASK-031: the ordinary RPC receives only IDs, CAS and target status. The test
-- creates timestamps around PostgreSQL's clock; no test-only clock argument exists.
reset role;
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,starts_at,ends_at,status)
values
  ('91000000-0000-0000-0000-000000000072',
   '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041',
   pg_catalog.clock_timestamp()-interval '5 minutes',pg_catalog.clock_timestamp()+interval '5 minutes','PENDING'),
  ('91000000-0000-0000-0000-000000000073',
   '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041',
   pg_catalog.clock_timestamp()-interval '2 hours',pg_catalog.clock_timestamp()-interval '90 minutes','PENDING'),
  ('91000000-0000-0000-0000-000000000074',
   '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041',
   pg_catalog.clock_timestamp()-interval '4 hours',pg_catalog.clock_timestamp()-interval '210 minutes','PENDING'),
  ('91000000-0000-0000-0000-000000000075',
   '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041',
   pg_catalog.clock_timestamp()-interval '6 hours',pg_catalog.clock_timestamp()-interval '330 minutes','PENDING'),
  ('91000000-0000-0000-0000-000000000076',
   '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000061',
   '91000000-0000-0000-0000-000000000031','91000000-0000-0000-0000-000000000041',
   pg_catalog.clock_timestamp()-interval '8 hours',pg_catalog.clock_timestamp()-interval '450 minutes','PENDING');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare v_token timestamptz;
begin
  select updated_at into v_token from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000072');
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000072',v_token,'CONFIRMED');
    raise exception 'Retroactive confirmation accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'APPOINTMENT_TIME_RESTRICTION' then raise; end if;
  end;
  begin
    perform * from public.staff_transition_appointment_status(
      '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000072',v_token,'NO_SHOW');
    raise exception 'In-progress NO_SHOW accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'APPOINTMENT_TIME_RESTRICTION' then raise; end if;
  end;
  perform * from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000072',v_token,'ATTENDED');
  select updated_at into v_token from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000073');
  perform * from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000073',v_token,'NO_SHOW');
  select updated_at into v_token from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000074');
  perform * from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000074',v_token,'ATTENDED');
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
declare v_token timestamptz;
begin
  select updated_at into v_token from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000076');
  perform * from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000076',v_token,'ATTENDED');
end;
$test$;
reset role;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000013',true);
set local role authenticated;
do $test$
declare v_token timestamptz;
begin
  select updated_at into v_token from public.professional_get_own_appointment(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000075');
  perform * from public.staff_transition_appointment_status(
    '91000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000075',v_token,'NO_SHOW');
end;
$test$;

-- The equality truth table is deterministic; the production RPC does not expose
-- an injectable clock and uses these same strict comparisons after FOR UPDATE.
do $test$
declare v_start timestamptz := '2026-01-01 10:00+00'; v_end timestamptz := '2026-01-01 10:30+00';
begin
  if not ('2026-01-01 09:59:59.999999+00'::timestamptz < v_start)
    or ('2026-01-01 10:00+00'::timestamptz < v_start)
    or not ('2026-01-01 10:00+00'::timestamptz >= v_start)
    or ('2026-01-01 10:29:59.999999+00'::timestamptz >= v_end)
    or not ('2026-01-01 10:30+00'::timestamptz >= v_end)
    or not ('2026-01-01 10:30:00.000001+00'::timestamptz >= v_end)
  then raise exception 'TASK-031 boundary comparison failed'; end if;
end;
$test$;

reset role;
update public.patient_centers set is_active=false
where id='91000000-0000-0000-0000-000000000061';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive PatientCenter accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'PATIENT_NOT_AVAILABLE' then raise; end if;
  end;
end;
$test$;

reset role;
update public.patient_centers set is_active=true
where id='91000000-0000-0000-0000-000000000061';
update public.professional_center_specialties set is_active=false
where professional_center_id='91000000-0000-0000-0000-000000000031'
  and specialty_id='91000000-0000-0000-0000-000000000041';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive specialty assignment accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'SPECIALTY_NOT_ASSIGNED' then raise; end if;
  end;
end;
$test$;

reset role;
update public.professional_center_specialties set is_active=true
where professional_center_id='91000000-0000-0000-0000-000000000031'
  and specialty_id='91000000-0000-0000-0000-000000000041';
update public.professional_centers set is_active=false
where id='91000000-0000-0000-0000-000000000031';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive ProfessionalCenter accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'PROFESSIONAL_NOT_AVAILABLE' then raise; end if;
  end;
end;
$test$;

reset role;
update public.professional_centers set is_active=true
where id='91000000-0000-0000-0000-000000000031';
update public.specialties set is_active=false
where id='91000000-0000-0000-0000-000000000041';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive Specialty accepted';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'SPECIALTY_NOT_AVAILABLE' then raise; end if;
  end;
end;
$test$;

reset role;
update public.specialties set is_active=true
where id='91000000-0000-0000-0000-000000000041';
update public.centers set is_active=false
where id='91000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000001',
      '91000000-0000-0000-0000-000000000061',
      '91000000-0000-0000-0000-000000000031',
      '91000000-0000-0000-0000-000000000041','2030-01-07','11:30',null);
    raise exception 'Inactive Center accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'ACCESS_DENIED' then raise; end if;
  end;
end;
$test$;

reset role;
update public.centers set is_active=true
where id='91000000-0000-0000-0000-000000000001';
update public.centers set timezone='Invalid/Zone'
where id='91000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_create_appointment(
      '91000000-0000-0000-0000-000000000002',
      '91000000-0000-0000-0000-000000000062',
      '91000000-0000-0000-0000-000000000032',
      '91000000-0000-0000-0000-000000000042','2030-01-07','00:00',null);
    raise exception 'Invalid timezone accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'INVALID_TIMEZONE' then raise; end if;
  end;
end;
$test$;

reset role;
update public.centers set timezone='Pacific/Auckland'
where id='91000000-0000-0000-0000-000000000002';
insert into public.availabilities (professional_center_id,center_id,weekday,start_time,end_time)
values ('91000000-0000-0000-0000-000000000032',
        '91000000-0000-0000-0000-000000000002',1,'00:00','01:00');
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare v_start timestamptz; v_id uuid;
begin
  select starts_at into v_start from public.staff_search_appointment_slots(
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000032',
    '91000000-0000-0000-0000-000000000042','2030-01-07')
  where starts_at at time zone 'Pacific/Auckland' = '2030-01-07 00:00'::timestamp;
  if v_start is null or v_start::date <> '2030-01-06'::date
  then raise exception 'Auckland local-date boundary missing'; end if;
  select appointment_id into v_id from public.staff_create_appointment(
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000062',
    '91000000-0000-0000-0000-000000000032',
    '91000000-0000-0000-0000-000000000042','2030-01-07','00:00',null);
  if (select starts_at from public.staff_get_appointment(
    '91000000-0000-0000-0000-000000000002',v_id)) <> v_start
  then raise exception 'Auckland search/create parity failed'; end if;
end;
$test$;

rollback;
