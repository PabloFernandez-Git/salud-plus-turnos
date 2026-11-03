-- Run only in the independent DEMO project's SQL editor as postgres.
-- First create and confirm demo@salud-plus.example in Supabase Auth (email/password).
-- All names, document IDs, contacts and appointment notes below are fictional.
do $seed$
declare
  demo_user_id uuid;
  demo_center_id constant uuid := 'd0000000-0000-4000-8000-000000000001';
  today_local date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select id into demo_user_id from auth.users
  where lower(email) = 'demo@salud-plus.example';
  if demo_user_id is null then
    raise exception 'Create the confirmed DEMO Auth user before running seed.sql';
  end if;
  if (select count(*) from auth.users where lower(email) = 'demo@salud-plus.example') <> 1 then
    raise exception 'Expected exactly one DEMO Auth user';
  end if;
  if exists (select 1 from auth.users where id <> demo_user_id)
    or exists (select 1 from public.centers where id <> demo_center_id) then
    raise exception 'Refusing to seed a project with other users or centers';
  end if;

  insert into public.centers (id, name, phone, email, address, timezone)
  values (demo_center_id, 'Centro Salud Plus Demo', '+54 11 0000 0000',
    'centro@example.invalid', 'Dirección ficticia 123', 'America/Argentina/Buenos_Aires')
  on conflict (id) do nothing;
  insert into public.users (id, email, first_name, last_name)
  values (demo_user_id, 'demo@salud-plus.example', 'Cuenta', 'Demo')
  on conflict (id) do nothing;
  insert into public.center_memberships (id, center_id, user_id, role)
  values ('d0000000-0000-4000-8000-000000000002', demo_center_id, demo_user_id, 'ADMIN')
  on conflict (id) do nothing;

  insert into public.specialties (id, center_id, name, description) values
    ('d0000000-0000-4000-8000-000000000011', demo_center_id, 'Clínica general', 'Especialidad ficticia de demostración'),
    ('d0000000-0000-4000-8000-000000000012', demo_center_id, 'Pediatría', 'Especialidad ficticia de demostración')
  on conflict (id) do nothing;
  insert into public.professionals
    (id, first_name, last_name, nationality_code, document_number, email, phone) values
    ('d0000000-0000-4000-8000-000000000021', 'Ana', 'Profesional Demo', 'AR', 'DEMO-PRO-001', 'ana@example.invalid', '+54 11 0000 0001'),
    ('d0000000-0000-4000-8000-000000000022', 'Luis', 'Profesional Demo', 'AR', 'DEMO-PRO-002', 'luis@example.invalid', '+54 11 0000 0002')
  on conflict (id) do nothing;
  insert into public.professional_centers (id, professional_id, center_id, license_number) values
    ('d0000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-000000000021', demo_center_id, 'DEMO-001'),
    ('d0000000-0000-4000-8000-000000000032', 'd0000000-0000-4000-8000-000000000022', demo_center_id, 'DEMO-002')
  on conflict (id) do nothing;
  insert into public.professional_center_specialties
    (professional_center_id, specialty_id, center_id) values
    ('d0000000-0000-4000-8000-000000000031', 'd0000000-0000-4000-8000-000000000011', demo_center_id),
    ('d0000000-0000-4000-8000-000000000032', 'd0000000-0000-4000-8000-000000000012', demo_center_id)
  on conflict (professional_center_id, specialty_id) do nothing;

  insert into public.persons
    (id, first_name, last_name, birth_date, nationality_code, document_number) values
    ('d0000000-0000-4000-8000-000000000041', 'Paciente', 'Ficticio Uno', '1990-01-01', 'AR', 'DEMO-PAC-001'),
    ('d0000000-0000-4000-8000-000000000042', 'Paciente', 'Ficticio Dos', '2018-06-15', 'AR', 'DEMO-PAC-002'),
    ('d0000000-0000-4000-8000-000000000043', 'Paciente', 'Ficticio Tres', '1984-09-20', 'AR', 'DEMO-PAC-003')
  on conflict (id) do nothing;
  insert into public.patient_centers
    (id, person_id, center_id, phone, email, insurance_name, administrative_notes) values
    ('d0000000-0000-4000-8000-000000000051', 'd0000000-0000-4000-8000-000000000041', demo_center_id, '+54 11 0000 0101', 'paciente1@example.invalid', 'Cobertura Demo', 'Dato ficticio'),
    ('d0000000-0000-4000-8000-000000000052', 'd0000000-0000-4000-8000-000000000042', demo_center_id, '+54 11 0000 0102', 'paciente2@example.invalid', null, null),
    ('d0000000-0000-4000-8000-000000000053', 'd0000000-0000-4000-8000-000000000043', demo_center_id, '+54 11 0000 0103', 'paciente3@example.invalid', null, null)
  on conflict (id) do nothing;
  insert into public.availabilities
    (id, professional_center_id, center_id, weekday, start_time, end_time)
  select ('d0000000-0000-4000-8000-0000000000' || lpad((60 + weekday_number)::text, 2, '0'))::uuid,
    'd0000000-0000-4000-8000-000000000031', demo_center_id,
    weekday_number::smallint, time '09:00', time '13:00'
  from generate_series(1, 5) as weekday_number
  on conflict (id) do nothing;
  insert into public.availabilities
    (id, professional_center_id, center_id, weekday, start_time, end_time)
  select ('d0000000-0000-4000-8000-0000000000' || lpad((70 + weekday_number)::text, 2, '0'))::uuid,
    'd0000000-0000-4000-8000-000000000032', demo_center_id,
    weekday_number::smallint, time '10:00', time '14:00'
  from generate_series(1, 5) as weekday_number
  on conflict (id) do nothing;

  insert into public.appointments
    (id, center_id, patient_center_id, professional_center_id, specialty_id,
     starts_at, ends_at, status, administrative_note) values
    ('d0000000-0000-4000-8000-000000000081', demo_center_id,
      'd0000000-0000-4000-8000-000000000051', 'd0000000-0000-4000-8000-000000000031',
      'd0000000-0000-4000-8000-000000000011',
      (today_local + time '09:00') at time zone 'America/Argentina/Buenos_Aires',
      (today_local + time '09:30') at time zone 'America/Argentina/Buenos_Aires',
      'CONFIRMED', 'Turno ficticio'),
    ('d0000000-0000-4000-8000-000000000082', demo_center_id,
      'd0000000-0000-4000-8000-000000000052', 'd0000000-0000-4000-8000-000000000032',
      'd0000000-0000-4000-8000-000000000012',
      (today_local + time '10:00') at time zone 'America/Argentina/Buenos_Aires',
      (today_local + time '10:30') at time zone 'America/Argentina/Buenos_Aires',
      'PENDING', 'Turno ficticio'),
    ('d0000000-0000-4000-8000-000000000083', demo_center_id,
      'd0000000-0000-4000-8000-000000000053', 'd0000000-0000-4000-8000-000000000031',
      'd0000000-0000-4000-8000-000000000011',
      ((today_local + 1) + time '11:00') at time zone 'America/Argentina/Buenos_Aires',
      ((today_local + 1) + time '11:30') at time zone 'America/Argentina/Buenos_Aires',
      'CONFIRMED', 'Turno ficticio')
  on conflict (id) do nothing;
end;
$seed$;
