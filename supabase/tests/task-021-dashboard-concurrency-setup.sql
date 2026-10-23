-- LOCAL disposable database only. This fixture COMMITs for two-session checks.
begin;
insert into public.centers (id, name, timezone)
select 'a2130000-0000-0000-0000-000000000001', 'TASK021 CONCURRENCY',
  case
    when extract(hour from pg_catalog.statement_timestamp() at time zone 'UTC') < 5
      then 'Pacific/Kiritimati'
    when extract(hour from pg_catalog.statement_timestamp() at time zone 'UTC') < 15
      then 'UTC'
    else 'Pacific/Honolulu'
  end;
insert into auth.users (id, email)
values ('a2130000-0000-0000-0000-000000000011', 'task021-concurrency@example.test');
insert into public.users (id, first_name, last_name, email)
values ('a2130000-0000-0000-0000-000000000011', 'TASK021', 'Concurrency', 'task021-concurrency@example.test');
insert into public.center_memberships (center_id, user_id, role)
values ('a2130000-0000-0000-0000-000000000001',
  'a2130000-0000-0000-0000-000000000011', 'ADMIN');
insert into public.professionals (id, first_name, last_name, nationality_code, document_number, email)
values ('a2130000-0000-0000-0000-000000000021', 'TASK021', 'Professional',
  'AR', 'TASK021-CONC-P', 'task021-conc-prof@example.test');
insert into public.professional_centers (id, professional_id, center_id)
values ('a2130000-0000-0000-0000-000000000031',
  'a2130000-0000-0000-0000-000000000021',
  'a2130000-0000-0000-0000-000000000001');
insert into public.specialties (id, center_id, name)
values ('a2130000-0000-0000-0000-000000000041',
  'a2130000-0000-0000-0000-000000000001', 'TASK021 Specialty');
insert into public.professional_center_specialties (professional_center_id, specialty_id, center_id)
values ('a2130000-0000-0000-0000-000000000031',
  'a2130000-0000-0000-0000-000000000041',
  'a2130000-0000-0000-0000-000000000001');
insert into public.persons (id, first_name, last_name, birth_date, nationality_code, document_number)
values ('a2130000-0000-0000-0000-000000000051', 'TASK021', 'Patient',
  '1990-01-01', 'AR', 'TASK021-CONC-X');
insert into public.patient_centers (id, person_id, center_id, phone)
values ('a2130000-0000-0000-0000-000000000061',
  'a2130000-0000-0000-0000-000000000051',
  'a2130000-0000-0000-0000-000000000001', '100000');
insert into public.appointments
  (id, center_id, patient_center_id, professional_center_id, specialty_id,
   starts_at, ends_at, status)
select 'a2130000-0000-0000-0000-000000000071',
  'a2130000-0000-0000-0000-000000000001',
  'a2130000-0000-0000-0000-000000000061',
  'a2130000-0000-0000-0000-000000000031',
  'a2130000-0000-0000-0000-000000000041',
  pg_catalog.statement_timestamp() + interval '1 hour',
  pg_catalog.statement_timestamp() + interval '1 hour 5 minutes', 'PENDING';
commit;
