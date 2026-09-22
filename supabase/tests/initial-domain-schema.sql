begin;

do $test$
declare
  domain_tables constant text[] := array[
    'appointments',
    'availabilities',
    'center_memberships',
    'centers',
    'patient_centers',
    'persons',
    'professional_center_specialties',
    'professional_centers',
    'professionals',
    'specialties',
    'users'
  ];
  appointment_blocking_predicate text;
begin
  if (
    select array_agg(tablename::text order by tablename)
    from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = any(domain_tables)
  ) is distinct from domain_tables then
    raise exception 'The expected public domain tables are not present';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class
    where oid = any(
      select format('public.%I', table_name)::regclass
      from unnest(domain_tables) as table_name
    )
      and not relrowsecurity
  ) then
    raise exception 'Every domain table must have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = any(domain_tables)
  ) then
    raise exception 'TASK-004 must not create permissive RLS policies';
  end if;

  if exists (
    select 1
    from unnest(domain_tables) as table_name
    cross join unnest(array['anon', 'authenticated']) as role_name
    where has_any_column_privilege(role_name, format('public.%I', table_name), 'SELECT,INSERT,UPDATE,REFERENCES')
      or has_table_privilege(role_name, format('public.%I', table_name), 'DELETE,TRUNCATE,TRIGGER')
  ) then
    raise exception 'anon/authenticated unexpectedly has a domain-table privilege';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_trigger
    where not tgisinternal
      and tgrelid = any(
        select format('public.%I', table_name)::regclass
        from unnest(domain_tables) as table_name
      )
      and tgname like '%_set_updated_at'
  ) <> 11 then
    raise exception 'Every mutable domain table must have an updated_at trigger';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_constraint
    where conname in (
      'appointments_no_blocking_overlap',
      'availabilities_no_active_overlap'
    ) and contype = 'x'
  ) <> 2 then
    raise exception 'Both approved exclusion constraints must exist';
  end if;

  select pg_get_expr(index_definition.indpred, index_definition.indrelid, true)
  into appointment_blocking_predicate
  from pg_catalog.pg_constraint constraint_definition
  join pg_catalog.pg_index index_definition
    on index_definition.indexrelid = constraint_definition.conindid
  where constraint_definition.conrelid = 'public.appointments'::regclass
    and constraint_definition.conname = 'appointments_no_blocking_overlap';

  if appointment_blocking_predicate is distinct from
    'status = ANY (ARRAY[''PENDING''::appointment_status, ''CONFIRMED''::appointment_status, ''ATTENDED''::appointment_status, ''NO_SHOW''::appointment_status])' then
    raise exception 'The appointment exclusion predicate is not the approved closed status list: %',
      appointment_blocking_predicate;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint
    where connamespace = 'public'::regnamespace
      and contype = 'f'
      and confdeltype <> 'r'
  ) then
    raise exception 'Every domain foreign key must use ON DELETE RESTRICT';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc
    where oid = 'private.normalize_document(text)'::regprocedure
      and provolatile = 'i'
      and proisstrict
      and not prosecdef
      and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
  ) then
    raise exception 'normalize_document security or volatility properties are incorrect';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_attribute
    where attrelid in ('public.persons'::regclass, 'public.professionals'::regclass)
      and attname = 'normalized_document'
      and attnotnull
      and attgenerated = 's'
  ) <> 2 then
    raise exception 'Both normalized_document columns must be generated stored and NOT NULL';
  end if;

  if has_function_privilege('anon', 'private.normalize_document(text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.normalize_document(text)', 'EXECUTE')
    or has_function_privilege('anon', 'private.set_updated_at()', 'EXECUTE')
    or has_function_privilege('authenticated', 'private.set_updated_at()', 'EXECUTE') then
    raise exception 'Internal functions must not be executable by API roles';
  end if;
end;
$test$;

do $test$
begin
  if private.normalize_document(
    U&'  ab.\0009-\2010\2011\2012\2013\2014\2015\2212\FE58\FE63\FF0D00  '
  ) <> 'AB00' then
    raise exception 'The approved whitespace, dot and hyphen variants were not removed';
  end if;

  if private.normalize_document('  00-01  ') <> '0001' then
    raise exception 'Leading zeroes were not preserved';
  end if;

  if private.normalize_document('á./_001') <> 'Á/_001' then
    raise exception 'Non-approved characters were removed or text was transliterated';
  end if;
end;
$test$;

insert into public.centers (id, name)
values
  ('00000000-0000-0000-0000-000000000101', 'Centro Uno'),
  ('00000000-0000-0000-0000-000000000102', 'Centro Dos');

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000203');

insert into public.users (id, first_name, last_name)
values
  ('00000000-0000-0000-0000-000000000201', 'Admin', 'Uno'),
  ('00000000-0000-0000-0000-000000000202', 'Profesional', 'Uno'),
  ('00000000-0000-0000-0000-000000000203', 'Prueba', 'Uno');

insert into public.professionals (
  id,
  first_name,
  last_name,
  nationality_code,
  document_number,
  email
)
values
  (
    '00000000-0000-0000-0000-000000000301',
    'Ana',
    'Profesional',
    'AR',
    '00-123.456',
    'ana@example.test'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'Bruno',
    'Profesional',
    'BR',
    'BR-002',
    'bruno@example.test'
  );

insert into public.professional_centers (
  id,
  professional_id,
  center_id,
  license_number
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101',
    'DUPLICADA'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000102',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000101',
    'DUPLICADA'
  );

do $test$
begin
  if (
    select usual_appointment_duration_minutes
    from public.professional_centers
    where id = '00000000-0000-0000-0000-000000000401'
  ) <> 30 then
    raise exception 'The usual appointment duration default must be 30';
  end if;

  update public.professional_centers
  set usual_appointment_duration_minutes = 5
  where id = '00000000-0000-0000-0000-000000000401';

  update public.professional_centers
  set usual_appointment_duration_minutes = 480
  where id = '00000000-0000-0000-0000-000000000401';

  begin
    update public.professional_centers
    set usual_appointment_duration_minutes = 0
    where id = '00000000-0000-0000-0000-000000000401';
    raise exception 'Duration 0 was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.professional_centers
    set usual_appointment_duration_minutes = 481
    where id = '00000000-0000-0000-0000-000000000401';
    raise exception 'Duration 481 was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.professional_centers
    set usual_appointment_duration_minutes = 7
    where id = '00000000-0000-0000-0000-000000000401';
    raise exception 'A non-multiple-of-five duration was accepted';
  exception when check_violation then null;
  end;
end;
$test$;

do $test$
begin
  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email
    ) values ('Duplicada', 'Profesional', 'AR', E'  00123 456 ', 'duplicate@example.test');
    raise exception 'A duplicate Professional identity was accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email
    ) values ('Inválida', 'Nacionalidad', 'ar', '991', 'invalid@example.test');
    raise exception 'A lowercase nationality was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email
    ) values ('Inválida', 'Nacionalidad', 'ARG', '992', 'invalid@example.test');
    raise exception 'A three-letter nationality was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email
    ) values ('Inválida', 'Nacionalidad', 'ÁR', '993', 'invalid@example.test');
    raise exception 'A non-ASCII nationality was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email
    ) values ('Vacía', 'Documento', 'UY', U&' . -\0009\2010 ', 'invalid@example.test');
    raise exception 'An empty normalized document was accepted';
  exception when check_violation then null;
  end;
end;
$test$;

insert into public.persons (
  id,
  first_name,
  last_name,
  birth_date,
  nationality_code,
  document_number
)
values
  (
    '00000000-0000-0000-0000-000000000501',
    'Paciente',
    'Uno',
    '1990-01-01',
    'AR',
    '10-000.001'
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    'Paciente',
    'Dos',
    '1991-02-02',
    'BR',
    '20-000.002'
  );

do $test$
begin
  begin
    insert into public.persons (
      first_name,
      last_name,
      birth_date,
      nationality_code,
      document_number
    ) values ('Duplicada', 'Persona', '1992-03-03', 'AR', E' 10000 001 ');
    raise exception 'A duplicate Person identity was accepted';
  exception when unique_violation then null;
  end;
end;
$test$;

insert into public.specialties (id, center_id, name, is_active)
values
  (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000101',
    'Cardiología',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000101',
    'Cardiologia',
    true
  ),
  (
    '00000000-0000-0000-0000-000000000603',
    '00000000-0000-0000-0000-000000000102',
    'Cardiología',
    true
  );

do $test$
begin
  begin
    insert into public.specialties (center_id, name)
    values ('00000000-0000-0000-0000-000000000101', '  CARDIOLOGÍA  ');
    raise exception 'The inactive specialty name was not reserved case-insensitively';
  exception when unique_violation then null;
  end;
end;
$test$;

insert into public.professional_center_specialties (
  professional_center_id,
  specialty_id,
  center_id
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000101'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000603',
    '00000000-0000-0000-0000-000000000102'
  );

do $test$
begin
  begin
    insert into public.professional_center_specialties (
      professional_center_id,
      specialty_id,
      center_id
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000603',
      '00000000-0000-0000-0000-000000000101'
    );
    raise exception 'A cross-center professional specialty was accepted';
  exception when foreign_key_violation then null;
  end;
end;
$test$;

insert into public.center_memberships (center_id, user_id, role)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000201',
  'ADMIN'
);

insert into public.center_memberships (
  center_id,
  user_id,
  role,
  professional_center_id
)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000202',
  'PROFESSIONAL',
  '00000000-0000-0000-0000-000000000401'
);

do $test$
begin
  begin
    insert into public.center_memberships (center_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000203',
      'PROFESSIONAL'
    );
    raise exception 'A Professional membership without ProfessionalCenter was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.center_memberships (
      center_id,
      user_id,
      role,
      professional_center_id
    ) values (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000203',
      'RECEPTION',
      '00000000-0000-0000-0000-000000000402'
    );
    raise exception 'A non-Professional membership with ProfessionalCenter was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.center_memberships (
      center_id,
      user_id,
      role,
      professional_center_id
    ) values (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000203',
      'PROFESSIONAL',
      '00000000-0000-0000-0000-000000000401'
    );
    raise exception 'A cross-center Professional membership was accepted';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.center_memberships (center_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000201',
      'RECEPTION'
    );
    raise exception 'A duplicate User-Center membership was accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.center_memberships (center_id, user_id, role)
    values (
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000203',
      'OWNER'
    );
    raise exception 'An unsupported membership role was accepted';
  exception when invalid_text_representation then null;
  end;
end;
$test$;

insert into public.patient_centers (id, person_id, center_id, phone)
values
  (
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000101',
    '+54 11 0000 0001'
  ),
  (
    '00000000-0000-0000-0000-000000000702',
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000102',
    '+55 11 0000 0002'
  );

do $test$
begin
  begin
    insert into public.patient_centers (person_id, center_id, phone)
    values (
      '00000000-0000-0000-0000-000000000501',
      '00000000-0000-0000-0000-000000000101',
      'duplicado'
    );
    raise exception 'A duplicate Person-Center registration was accepted';
  exception when unique_violation then null;
  end;
end;
$test$;

insert into public.availabilities (
  professional_center_id,
  center_id,
  weekday,
  start_time,
  end_time
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    1,
    '09:00',
    '10:00'
  ),
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    1,
    '10:00',
    '11:00'
  );

do $test$
begin
  if (
    select count(*)
    from public.availabilities
    where professional_center_id = '00000000-0000-0000-0000-000000000401'
      and weekday = 1
  ) <> 2 then
    raise exception 'Contiguous availability behavior is incorrect';
  end if;

  begin
    insert into public.availabilities (
      professional_center_id,
      center_id,
      weekday,
      start_time,
      end_time
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000101',
      1,
      '09:30',
      '10:30'
    );
    raise exception 'An overlapping active availability was accepted';
  exception when exclusion_violation then null;
  end;

  insert into public.availabilities (
    professional_center_id,
    center_id,
    weekday,
    start_time,
    end_time,
    is_active
  ) values (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    2,
    '09:00',
    '11:00',
    false
  );

  insert into public.availabilities (
    professional_center_id,
    center_id,
    weekday,
    start_time,
    end_time
  ) values (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    2,
    '10:00',
    '12:00'
  );

  insert into public.availabilities (
    professional_center_id,
    center_id,
    weekday,
    start_time,
    end_time
  ) values (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000101',
    1,
    '09:30',
    '10:30'
  );

  begin
    insert into public.availabilities (
      professional_center_id,
      center_id,
      weekday,
      start_time,
      end_time
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000101',
      0,
      '12:00',
      '13:00'
    );
    raise exception 'Weekday 0 was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.availabilities (
      professional_center_id,
      center_id,
      weekday,
      start_time,
      end_time
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000101',
      3,
      '13:00',
      '13:00'
    );
    raise exception 'An empty availability interval was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.availabilities (
      professional_center_id,
      center_id,
      weekday,
      start_time,
      end_time
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000102',
      3,
      '13:00',
      '14:00'
    );
    raise exception 'A cross-center availability was accepted';
  exception when foreign_key_violation then null;
  end;
end;
$test$;

do $test$
begin
  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000702',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000601',
      '2027-01-04 09:00+00',
      '2027-01-04 10:00+00'
    );
    raise exception 'A cross-center PatientCenter was accepted';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000402',
      '00000000-0000-0000-0000-000000000603',
      '2027-01-04 09:00+00',
      '2027-01-04 10:00+00'
    );
    raise exception 'A cross-center ProfessionalCenter was accepted';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000602',
      '2027-01-04 09:00+00',
      '2027-01-04 10:00+00'
    );
    raise exception 'An unassigned specialty was accepted';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000601',
      '2027-01-04 10:00+00',
      '2027-01-04 10:00+00'
    );
    raise exception 'An empty appointment interval was accepted';
  exception when check_violation then null;
  end;
end;
$test$;

do $test$
declare
  blocking_status public.appointment_status;
begin
  foreach blocking_status in array array[
    'PENDING'::public.appointment_status,
    'CONFIRMED'::public.appointment_status,
    'ATTENDED'::public.appointment_status,
    'NO_SHOW'::public.appointment_status
  ] loop
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at,
      status
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000601',
      '2027-01-05 09:00+00',
      '2027-01-05 10:00+00',
      blocking_status
    );

    begin
      insert into public.appointments (
        center_id,
        patient_center_id,
        professional_center_id,
        specialty_id,
        starts_at,
        ends_at
      ) values (
        '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000701',
        '00000000-0000-0000-0000-000000000401',
        '00000000-0000-0000-0000-000000000601',
        '2027-01-05 09:30+00',
        '2027-01-05 10:30+00'
      );
      raise exception 'A blocking status allowed an overlapping appointment';
    exception when exclusion_violation then null;
    end;

    delete from public.appointments
    where professional_center_id = '00000000-0000-0000-0000-000000000401';
  end loop;
end;
$test$;

insert into public.appointments (
  id,
  center_id,
  patient_center_id,
  professional_center_id,
  specialty_id,
  starts_at,
  ends_at
)
values (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000601',
  '2027-01-06 09:00+00',
  '2027-01-06 10:00+00'
);

do $test$
begin
  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000601',
      '2027-01-06 08:00+00',
      '2027-01-06 11:00+00'
    );
    raise exception 'A fully covering appointment overlap was accepted';
  exception when exclusion_violation then null;
  end;

  begin
    insert into public.appointments (
      center_id,
      patient_center_id,
      professional_center_id,
      specialty_id,
      starts_at,
      ends_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000701',
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000601',
      '2027-01-06 09:15+00',
      '2027-01-06 09:45+00'
    );
    raise exception 'A contained appointment overlap was accepted';
  exception when exclusion_violation then null;
  end;
end;
$test$;

insert into public.appointments (
  id,
  center_id,
  patient_center_id,
  professional_center_id,
  specialty_id,
  starts_at,
  ends_at
)
values (
  '00000000-0000-0000-0000-000000000802',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000601',
  '2027-01-06 10:00+00',
  '2027-01-06 11:00+00'
);

insert into public.appointments (
  center_id,
  patient_center_id,
  professional_center_id,
  specialty_id,
  starts_at,
  ends_at,
  status
)
values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000601',
  '2027-01-06 09:15+00',
  '2027-01-06 09:45+00',
  'CANCELLED'
);

insert into public.appointments (
  center_id,
  patient_center_id,
  professional_center_id,
  specialty_id,
  starts_at,
  ends_at
)
values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000702',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000603',
  '2027-01-06 09:00+00',
  '2027-01-06 10:00+00'
);

do $test$
begin
  begin
    update public.appointments
    set starts_at = '2027-01-06 09:30+00', ends_at = '2027-01-06 10:30+00'
    where id = '00000000-0000-0000-0000-000000000802';
    raise exception 'An overlapping reschedule was accepted';
  exception when exclusion_violation then null;
  end;

  update public.appointments
  set status = 'CANCELLED'
  where id = '00000000-0000-0000-0000-000000000801';

  insert into public.appointments (
    center_id,
    patient_center_id,
    professional_center_id,
    specialty_id,
    starts_at,
    ends_at
  ) values (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000701',
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000601',
    '2027-01-06 09:00+00',
    '2027-01-06 10:00+00'
  );

  update public.professional_center_specialties
  set is_active = false
  where professional_center_id = '00000000-0000-0000-0000-000000000401'
    and specialty_id = '00000000-0000-0000-0000-000000000601';
end;
$test$;

do $test$
declare
  supplied_updated_at constant timestamptz := '2000-01-01 00:00+00';
  actual_updated_at timestamptz;
begin
  update public.centers
  set name = 'Centro Uno Actualizado', updated_at = supplied_updated_at
  where id = '00000000-0000-0000-0000-000000000101'
  returning updated_at into actual_updated_at;

  if actual_updated_at = supplied_updated_at then
    raise exception 'updated_at accepted a client-supplied value';
  end if;
end;
$test$;

rollback;
