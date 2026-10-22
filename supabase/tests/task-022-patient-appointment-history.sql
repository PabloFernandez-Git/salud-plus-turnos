begin;

do $test$
declare
  v_function oid := 'public.staff_list_patient_appointments(uuid,uuid,text,timestamptz,timestamptz,uuid,integer)'::regprocedure;
begin
  if not exists (
    select 1 from pg_proc as procedure
    where procedure.oid = v_function and procedure.prosecdef
      and procedure.provolatile = 's'
      and procedure.proconfig = array['search_path=""']::text[]
  ) then raise exception 'TASK-022 RPC security attributes differ'; end if;
  if not has_function_privilege('authenticated', v_function, 'EXECUTE')
    or has_function_privilege('anon', v_function, 'EXECUTE')
    or has_function_privilege('service_role', v_function, 'EXECUTE')
  then raise exception 'TASK-022 RPC EXECUTE grants differ'; end if;
  if pg_get_function_result(v_function) ~* 'administrative_note|document|birth_date|phone|email|insurance|person|patient_first_name'
  then raise exception 'TASK-022 RPC leaks sensitive columns'; end if;
  if not (select relrowsecurity from pg_class where oid='public.appointments'::regclass)
    or has_table_privilege('authenticated', 'public.appointments', 'SELECT')
    or has_table_privilege('anon', 'public.appointments', 'SELECT')
    or exists (select 1 from pg_policy where polrelid='public.appointments'::regclass)
  then raise exception 'Appointment table access widened'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='appointments'
      and indexname='appointments_patient_center_starts_at_id_idx'
      and indexdef like '%(patient_center_id, starts_at, id)%'
  ) then raise exception 'TASK-022 keyset index missing'; end if;
end;
$test$;

insert into public.centers (id,name,timezone) values
  ('92000000-0000-0000-0000-000000000001','TASK022 A','America/New_York'),
  ('92000000-0000-0000-0000-000000000002','TASK022 B','America/Argentina/Buenos_Aires');

insert into auth.users (id,email) values
  ('92000000-0000-0000-0000-000000000011','task022-admin@example.test'),
  ('92000000-0000-0000-0000-000000000012','task022-reception@example.test'),
  ('92000000-0000-0000-0000-000000000013','task022-professional@example.test'),
  ('92000000-0000-0000-0000-000000000014','task022-no-membership@example.test'),
  ('92000000-0000-0000-0000-000000000015','task022-inactive@example.test'),
  ('92000000-0000-0000-0000-000000000016','task022-other-center@example.test');
insert into public.users (id,first_name,last_name,email)
select id,'TASK022','Actor',email from auth.users
where id::text like '92000000-0000-0000-0000-00000000001%';

insert into public.professionals
  (id,first_name,last_name,nationality_code,document_number,email) values
  ('92000000-0000-0000-0000-000000000021','Ana','Histórica','AR','TASK022-P1','professional-a@example.test'),
  ('92000000-0000-0000-0000-000000000022','Beto','Privado','AR','TASK022-P2','professional-b@example.test');
insert into public.professional_centers
  (id,professional_id,center_id,usual_appointment_duration_minutes) values
  ('92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000021','92000000-0000-0000-0000-000000000001',30),
  ('92000000-0000-0000-0000-000000000032','92000000-0000-0000-0000-000000000022','92000000-0000-0000-0000-000000000002',30);
insert into public.specialties (id,center_id,name) values
  ('92000000-0000-0000-0000-000000000041','92000000-0000-0000-0000-000000000001','Especialidad histórica'),
  ('92000000-0000-0000-0000-000000000042','92000000-0000-0000-0000-000000000002','Especialidad privada');
insert into public.professional_center_specialties
  (professional_center_id,specialty_id,center_id) values
  ('92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','92000000-0000-0000-0000-000000000001'),
  ('92000000-0000-0000-0000-000000000032','92000000-0000-0000-0000-000000000042','92000000-0000-0000-0000-000000000002');
insert into public.center_memberships
  (center_id,user_id,role,professional_center_id,is_active) values
  ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000011','ADMIN',null,true),
  ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000012','RECEPTION',null,true),
  ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000013','PROFESSIONAL','92000000-0000-0000-0000-000000000031',true),
  ('92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000015','RECEPTION',null,false),
  ('92000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000016','ADMIN',null,true);
insert into public.persons
  (id,first_name,last_name,birth_date,nationality_code,document_number) values
  ('92000000-0000-0000-0000-000000000051','Paciente','Compartido','1990-01-01','AR','TASK022-X1'),
  ('92000000-0000-0000-0000-000000000052','Paciente','Vacío','1991-01-01','AR','TASK022-X2');
insert into public.patient_centers
  (id,person_id,center_id,phone,email,administrative_notes) values
  ('92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000051','92000000-0000-0000-0000-000000000001','111','private-a@example.test','SECRET PATIENT A'),
  ('92000000-0000-0000-0000-000000000062','92000000-0000-0000-0000-000000000051','92000000-0000-0000-0000-000000000002','222','private-b@example.test','SECRET PATIENT B'),
  ('92000000-0000-0000-0000-000000000063','92000000-0000-0000-0000-000000000052','92000000-0000-0000-0000-000000000001','333',null,null);

-- Sixty cancelled rows can overlap. They exercise long histories without
-- weakening the exclusion constraint on blocking appointments.
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status,administrative_note)
select ('92000000-0000-0000-0000-' || lpad((1000+n)::text,12,'0'))::uuid,
  '92000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000061',
  '92000000-0000-0000-0000-000000000031',
  '92000000-0000-0000-0000-000000000041',
  '2026-01-01 00:00+00'::timestamptz + n * interval '1 minute',
  '2026-01-01 00:30+00'::timestamptz + n * interval '1 minute',
  'CANCELLED','SECRET APPOINTMENT A'
from generate_series(0,59) as series(n);

insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status,administrative_note) values
  ('92000000-0000-0000-0000-000000002001','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 08:00+00','2026-10-21 08:30+00','PENDING','SECRET'),
  ('92000000-0000-0000-0000-000000002002','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 09:00+00','2026-10-21 09:30+00','CONFIRMED','SECRET'),
  ('92000000-0000-0000-0000-000000002003','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 10:00+00','2026-10-21 10:30+00','ATTENDED','SECRET'),
  ('92000000-0000-0000-0000-000000002004','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 11:00+00','2026-10-21 11:30+00','NO_SHOW','SECRET'),
  ('92000000-0000-0000-0000-000000002005','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-12-01 08:00+00','2026-12-01 08:30+00','PENDING','SECRET'),
  ('92000000-0000-0000-0000-000000002006','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-12-02 08:00+00','2026-12-02 08:30+00','CONFIRMED','SECRET'),
  ('92000000-0000-0000-0000-000000002007','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-12-03 08:00+00','2026-12-03 08:30+00','ATTENDED','SECRET'),
  ('92000000-0000-0000-0000-000000002008','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-12-04 08:00+00','2026-12-04 08:30+00','NO_SHOW','SECRET'),
  ('92000000-0000-0000-0000-000000002009','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-12-05 08:00+00','2026-12-05 08:30+00','CANCELLED','SECRET'),
  ('92000000-0000-0000-0000-000000002010','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-11-01 05:30+00','2026-11-01 06:00+00','CANCELLED','SECRET'),
  ('92000000-0000-0000-0000-000000002011','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-11-01 06:30+00','2026-11-01 07:00+00','CANCELLED','SECRET'),
  ('92000000-0000-0000-0000-000000002012','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-22 00:00+00','2026-10-22 00:30+00','PENDING','SECRET'),
  ('92000000-0000-0000-0000-000000002013','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-22 00:00+00','2026-10-22 00:30+00','CANCELLED','SECRET'),
  ('92000000-0000-0000-0000-000000002014','92000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000062','92000000-0000-0000-0000-000000000032','92000000-0000-0000-0000-000000000042','2026-12-06 08:00+00','2026-12-06 08:30+00','PENDING','SECRET APPOINTMENT B');

-- Three equal timestamps test the UUID tie-breaker across page boundaries.
insert into public.appointments
  (id,center_id,patient_center_id,professional_center_id,specialty_id,
   starts_at,ends_at,status) values
  ('92000000-0000-0000-0000-000000002015','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 12:00+00','2026-10-21 12:30+00','CANCELLED'),
  ('92000000-0000-0000-0000-000000002016','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 12:00+00','2026-10-21 12:30+00','CANCELLED'),
  ('92000000-0000-0000-0000-000000002017','92000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000061','92000000-0000-0000-0000-000000000031','92000000-0000-0000-0000-000000000041','2026-10-21 12:00+00','2026-10-21 12:30+00','CANCELLED');

update public.professional_centers set is_active=false
where id='92000000-0000-0000-0000-000000000031';
update public.professional_center_specialties set is_active=false
where professional_center_id='92000000-0000-0000-0000-000000000031';
update public.specialties set is_active=false
where id='92000000-0000-0000-0000-000000000041';
update public.patient_centers set is_active=false
where id='92000000-0000-0000-0000-000000000061';

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000011',true);
set local role authenticated;
do $test$
declare
  v_center uuid := '92000000-0000-0000-0000-000000000001';
  v_patient uuid := '92000000-0000-0000-0000-000000000061';
  v_as_of timestamptz := '2026-10-22 00:00+00';
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_previous_at timestamptz;
  v_previous_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_row record;
  v_more boolean;
  v_rows integer;
  v_pages integer := 0;
  v_up_first record;
  v_up_second record;
  v_up_third record;
begin
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,v_patient,'UPCOMING',v_as_of)) <> 3
  then raise exception 'ADMIN upcoming count differs'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,'92000000-0000-0000-0000-000000000062','HISTORY',v_as_of)) <> 0
  then raise exception 'Foreign PatientCenter exposed'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,'92000000-0000-0000-0000-000000000099','HISTORY',v_as_of)) <> 0
  then raise exception 'Nonexistent PatientCenter exposed'; end if;
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000099',v_patient,'HISTORY',v_as_of);
    raise exception 'Nonexistent Center accepted';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,'92000000-0000-0000-0000-000000000063','HISTORY',v_as_of)) <> 0
  then raise exception 'Empty history differs'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,v_patient,'HISTORY',v_as_of,p_limit=>50)) <> 50
  then raise exception 'Maximum legal page limit differs'; end if;
  if exists (
    select 1 from public.staff_list_patient_appointments(
      v_center,v_patient,'HISTORY',v_as_of,p_limit=>50)
    where professional_first_name <> 'Ana'
      or specialty_name <> 'Especialidad histórica'
  ) then raise exception 'Inactive historical names missing'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,v_patient,'HISTORY',v_as_of,p_limit=>50)
    where appointment_id in (
      '92000000-0000-0000-0000-000000002007',
      '92000000-0000-0000-0000-000000002008',
      '92000000-0000-0000-0000-000000002009'
    )) <> 3 then raise exception 'Future terminal states absent from history'; end if;
  if exists (
    select 1 from public.staff_list_patient_appointments(
      v_center,v_patient,'UPCOMING',v_as_of)
    where appointment_id in (
      '92000000-0000-0000-0000-000000002007',
      '92000000-0000-0000-0000-000000002008',
      '92000000-0000-0000-0000-000000002009',
      '92000000-0000-0000-0000-000000002013'
    )
  ) then raise exception 'Terminal state also appeared as upcoming'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,v_patient,'HISTORY',v_as_of,p_limit=>50)
    where appointment_id='92000000-0000-0000-0000-000000002013') <> 1
  then raise exception 'Cancelled boundary absent from history'; end if;

  loop
    v_rows := 0;
    v_more := false;
    for v_row in select * from public.staff_list_patient_appointments(
      v_center,v_patient,'HISTORY',v_as_of,v_cursor_at,v_cursor_id,7)
    loop
      v_rows := v_rows + 1;
      if array_position(v_seen,v_row.appointment_id) is not null
      then raise exception 'History page repeated an appointment'; end if;
      if v_previous_at is not null
        and (v_row.starts_at,v_row.appointment_id) >= (v_previous_at,v_previous_id)
      then raise exception 'History order is not descending'; end if;
      v_seen := array_append(v_seen,v_row.appointment_id);
      v_previous_at := v_row.starts_at;
      v_previous_id := v_row.appointment_id;
      v_cursor_at := v_row.starts_at;
      v_cursor_id := v_row.appointment_id;
      v_more := v_row.has_more;
    end loop;
    v_pages := v_pages + 1;
    if v_rows < 1 or v_rows > 7 or v_pages > 20
    then raise exception 'History page bounds differ'; end if;
    exit when not v_more;
  end loop;
  if cardinality(v_seen) <> 73 or v_pages < 2
  then raise exception 'History pagination incomplete: % rows, % pages', cardinality(v_seen),v_pages; end if;
  if array_position(v_seen,'92000000-0000-0000-0000-000000002015'::uuid) is null
    or array_position(v_seen,'92000000-0000-0000-0000-000000002016'::uuid) is null
    or array_position(v_seen,'92000000-0000-0000-0000-000000002017'::uuid) is null
  then raise exception 'Same-start appointments lost'; end if;
  if exists (
    select 1 from public.staff_list_patient_appointments(
      v_center,v_patient,'UPCOMING',v_as_of)
    where appointment_id = any(v_seen)
  ) then raise exception 'Appointment appeared in both sections'; end if;
  if (select count(*) from public.staff_list_patient_appointments(
    v_center,v_patient,'HISTORY',v_as_of,v_cursor_at,v_cursor_id,7)) <> 0
  then raise exception 'History final cursor did not exhaust'; end if;
  select * into v_up_first from public.staff_list_patient_appointments(
    v_center,v_patient,'UPCOMING',v_as_of,p_limit=>1);
  select * into v_up_second from public.staff_list_patient_appointments(
    v_center,v_patient,'UPCOMING',v_as_of,
    v_up_first.starts_at,v_up_first.appointment_id,1);
  select * into v_up_third from public.staff_list_patient_appointments(
    v_center,v_patient,'UPCOMING',v_as_of,
    v_up_second.starts_at,v_up_second.appointment_id,1);
  if v_up_first.appointment_id is null
    or v_up_second.appointment_id is null or v_up_third.appointment_id is null
    or v_up_first.appointment_id <> '92000000-0000-0000-0000-000000002012'::uuid
    or not v_up_first.has_more or not v_up_second.has_more or v_up_third.has_more
    or (v_up_first.starts_at,v_up_first.appointment_id)
      >= (v_up_second.starts_at,v_up_second.appointment_id)
    or (v_up_second.starts_at,v_up_second.appointment_id)
      >= (v_up_third.starts_at,v_up_third.appointment_id)
    or (select count(*) from public.staff_list_patient_appointments(
      v_center,v_patient,'UPCOMING',v_as_of,
      v_up_third.starts_at,v_up_third.appointment_id,1)) <> 0
  then raise exception 'Upcoming keyset or exact as_of boundary differs'; end if;

  begin
    perform * from public.staff_list_patient_appointments(v_center,v_patient,'HISTORY',v_as_of,p_limit=>0);
    raise exception 'Zero limit accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(v_center,v_patient,'HISTORY',v_as_of,p_limit=>51);
    raise exception 'Oversized limit accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(v_center,v_patient,'WRONG',v_as_of);
    raise exception 'Invalid section accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(v_center,v_patient,'HISTORY',null);
    raise exception 'Null cutoff accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(
      v_center,v_patient,'HISTORY','infinity'::timestamptz);
    raise exception 'Infinite cutoff accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(
      v_center,v_patient,'HISTORY',v_as_of,
      'infinity'::timestamptz,'92000000-0000-0000-0000-000000002001');
    raise exception 'Infinite cursor accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.staff_list_patient_appointments(
      v_center,v_patient,'HISTORY',v_as_of,p_cursor_id=>'92000000-0000-0000-0000-000000002001');
    raise exception 'Half cursor accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.appointments limit 1;
    raise exception 'Direct SELECT accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

-- DST fallback: both instants are 01:30 in New York, with distinct UTC offsets.
do $test$
declare
  v_first timestamptz;
  v_second timestamptz;
begin
  select starts_at into v_first from public.appointments
  where id='92000000-0000-0000-0000-000000002010';
  select starts_at into v_second from public.appointments
  where id='92000000-0000-0000-0000-000000002011';
  if v_first = v_second
    or (v_first at time zone 'America/New_York')
      <> (v_second at time zone 'America/New_York')
    or extract(epoch from v_second-v_first) <> 3600
  then raise exception 'DST repeated-hour instants collapsed'; end if;
  if ('2026-10-22 00:00+00'::timestamptz at time zone 'America/New_York')::date
    <> '2026-10-21'::date
  then raise exception 'Center-local date collapsed into UTC date'; end if;
end;
$test$;

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000012',true);
set local role authenticated;
do $test$
begin
  if (select count(*) from public.staff_list_patient_appointments(
    '92000000-0000-0000-0000-000000000001',
    '92000000-0000-0000-0000-000000000061',
    'UPCOMING','2026-10-22 00:00+00')) <> 3
  then raise exception 'RECEPTION read missing'; end if;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000013',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000061',
      'HISTORY','2026-10-22 00:00+00');
    raise exception 'PROFESSIONAL read accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000014',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000061',
      'HISTORY','2026-10-22 00:00+00');
    raise exception 'Unmembered user read accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000015',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000061',
      'HISTORY','2026-10-22 00:00+00');
    raise exception 'Inactive membership read accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000016',true);
set local role authenticated;
do $test$
begin
  if (select count(*) from public.staff_list_patient_appointments(
    '92000000-0000-0000-0000-000000000002',
    '92000000-0000-0000-0000-000000000062',
    'UPCOMING','2026-10-22 00:00+00')) <> 1
  then raise exception 'Other Center own appointment missing'; end if;
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000061',
      'HISTORY','2026-10-22 00:00+00');
    raise exception 'Other Center user read accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

update public.centers set is_active=false
where id='92000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub','92000000-0000-0000-0000-000000000016',true);
set local role authenticated;
do $test$
begin
  begin
    perform * from public.staff_list_patient_appointments(
      '92000000-0000-0000-0000-000000000002',
      '92000000-0000-0000-0000-000000000062',
      'UPCOMING','2026-10-22 00:00+00');
    raise exception 'Inactive Center read accepted';
  exception when insufficient_privilege then null; end;
end;
$test$;
reset role;

rollback;
