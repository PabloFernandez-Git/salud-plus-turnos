begin;

create extension if not exists btree_gist with schema extensions;

create type public.membership_role as enum ('ADMIN', 'RECEPTION', 'PROFESSIONAL');
create type public.appointment_status as enum (
  'PENDING',
  'CONFIRMED',
  'ATTENDED',
  'CANCELLED',
  'NO_SHOW'
);

create schema if not exists private;
revoke all on schema private from public;

create function private.normalize_document(document text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $function$
  select translate(
    regexp_replace(upper(btrim(document)), '[[:space:].]', '', 'g'),
    U&'-\2010\2011\2012\2013\2014\2015\2212\FE58\FE63\FF0D',
    ''
  );
$function$;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

revoke all on function private.normalize_document(text) from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create table public.centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_path text,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centers_name_not_blank check (btrim(name) <> ''),
  constraint centers_phone_not_blank check (phone is null or btrim(phone) <> ''),
  constraint centers_timezone_not_blank check (btrim(timezone) <> '')
);

create table public.users (
  id uuid primary key,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_auth_user_fk
    foreign key (id) references auth.users (id) on update restrict on delete restrict,
  constraint users_first_name_not_blank check (btrim(first_name) <> ''),
  constraint users_last_name_not_blank check (btrim(last_name) <> '')
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  nationality_code text not null,
  document_number text not null,
  normalized_document text generated always as (
    private.normalize_document(document_number)
  ) stored,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professionals_first_name_not_blank check (btrim(first_name) <> ''),
  constraint professionals_last_name_not_blank check (btrim(last_name) <> ''),
  constraint professionals_nationality_code_format check (
    nationality_code collate "C" ~ '^[A-Z]{2}$'
  ),
  constraint professionals_document_number_not_blank check (btrim(document_number) <> ''),
  constraint professionals_normalized_document_not_blank check (normalized_document <> ''),
  constraint professionals_email_not_blank check (btrim(email) <> ''),
  constraint professionals_phone_not_blank check (phone is null or btrim(phone) <> ''),
  constraint professionals_nationality_document_key unique (
    nationality_code,
    normalized_document
  )
);

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  nationality_code text not null,
  document_number text not null,
  normalized_document text generated always as (
    private.normalize_document(document_number)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint persons_first_name_not_blank check (btrim(first_name) <> ''),
  constraint persons_last_name_not_blank check (btrim(last_name) <> ''),
  constraint persons_nationality_code_format check (
    nationality_code collate "C" ~ '^[A-Z]{2}$'
  ),
  constraint persons_document_number_not_blank check (btrim(document_number) <> ''),
  constraint persons_normalized_document_not_blank check (normalized_document <> ''),
  constraint persons_nationality_document_key unique (
    nationality_code,
    normalized_document
  )
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint specialties_center_fk
    foreign key (center_id) references public.centers (id) on update restrict on delete restrict,
  constraint specialties_name_not_blank check (btrim(name) <> ''),
  constraint specialties_id_center_key unique (id, center_id)
);

create table public.professional_centers (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null,
  center_id uuid not null,
  license_number text,
  usual_appointment_duration_minutes integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_centers_professional_fk
    foreign key (professional_id)
    references public.professionals (id)
    on update restrict
    on delete restrict,
  constraint professional_centers_center_fk
    foreign key (center_id) references public.centers (id) on update restrict on delete restrict,
  constraint professional_centers_center_professional_key unique (center_id, professional_id),
  constraint professional_centers_id_center_key unique (id, center_id),
  constraint professional_centers_duration_range check (
    usual_appointment_duration_minutes between 5 and 480
  ),
  constraint professional_centers_duration_step check (
    usual_appointment_duration_minutes % 5 = 0
  )
);

create table public.center_memberships (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  user_id uuid not null,
  role public.membership_role not null,
  professional_center_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_memberships_center_fk
    foreign key (center_id) references public.centers (id) on update restrict on delete restrict,
  constraint center_memberships_user_fk
    foreign key (user_id) references public.users (id) on update restrict on delete restrict,
  constraint center_memberships_professional_center_fk
    foreign key (professional_center_id, center_id)
    references public.professional_centers (id, center_id)
    on update restrict
    on delete restrict,
  constraint center_memberships_center_user_key unique (center_id, user_id),
  constraint center_memberships_role_professional_center_check check (
    (role = 'PROFESSIONAL' and professional_center_id is not null)
    or (role in ('ADMIN', 'RECEPTION') and professional_center_id is null)
  )
);

create table public.professional_center_specialties (
  professional_center_id uuid not null,
  specialty_id uuid not null,
  center_id uuid not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_center_specialties_pkey primary key (
    professional_center_id,
    specialty_id
  ),
  constraint professional_center_specialties_professional_center_fk
    foreign key (professional_center_id, center_id)
    references public.professional_centers (id, center_id)
    on update restrict
    on delete restrict,
  constraint professional_center_specialties_specialty_fk
    foreign key (specialty_id, center_id)
    references public.specialties (id, center_id)
    on update restrict
    on delete restrict
);

create table public.patient_centers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  center_id uuid not null,
  phone text not null,
  email text,
  insurance_name text,
  administrative_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_centers_person_fk
    foreign key (person_id) references public.persons (id) on update restrict on delete restrict,
  constraint patient_centers_center_fk
    foreign key (center_id) references public.centers (id) on update restrict on delete restrict,
  constraint patient_centers_phone_not_blank check (btrim(phone) <> ''),
  constraint patient_centers_center_person_key unique (center_id, person_id),
  constraint patient_centers_id_center_key unique (id, center_id)
);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  professional_center_id uuid not null,
  center_id uuid not null,
  weekday smallint not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availabilities_professional_center_fk
    foreign key (professional_center_id, center_id)
    references public.professional_centers (id, center_id)
    on update restrict
    on delete restrict,
  constraint availabilities_weekday_range check (weekday between 1 and 7),
  constraint availabilities_time_order check (start_time < end_time),
  constraint availabilities_no_active_overlap
    exclude using gist (
      professional_center_id with =,
      weekday with =,
      numrange(
        extract(epoch from start_time)::numeric,
        extract(epoch from end_time)::numeric,
        '[)'
      ) with &&
    ) where (is_active)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  patient_center_id uuid not null,
  professional_center_id uuid not null,
  specialty_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'PENDING',
  administrative_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_patient_center_fk
    foreign key (patient_center_id, center_id)
    references public.patient_centers (id, center_id)
    on update restrict
    on delete restrict,
  constraint appointments_professional_center_fk
    foreign key (professional_center_id, center_id)
    references public.professional_centers (id, center_id)
    on update restrict
    on delete restrict,
  constraint appointments_professional_center_specialty_fk
    foreign key (professional_center_id, specialty_id)
    references public.professional_center_specialties (professional_center_id, specialty_id)
    on update restrict
    on delete restrict,
  constraint appointments_time_order check (starts_at < ends_at),
  constraint appointments_no_blocking_overlap
    exclude using gist (
      professional_center_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status <> 'CANCELLED')
);

create unique index specialties_center_normalized_name_key
  on public.specialties (center_id, lower(btrim(name)));
create index specialties_active_center_idx
  on public.specialties (center_id) where is_active;

create index professional_centers_professional_idx
  on public.professional_centers (professional_id);
create index professional_centers_active_center_idx
  on public.professional_centers (center_id) where is_active;

create index center_memberships_user_center_idx
  on public.center_memberships (user_id, center_id);
create index center_memberships_active_center_role_idx
  on public.center_memberships (center_id, role) where is_active;
create index center_memberships_professional_center_idx
  on public.center_memberships (professional_center_id)
  where professional_center_id is not null;

create index professional_center_specialties_specialty_center_idx
  on public.professional_center_specialties (specialty_id, center_id);

create index patient_centers_person_idx
  on public.patient_centers (person_id);
create index patient_centers_active_center_idx
  on public.patient_centers (center_id) where is_active;

create index availabilities_professional_center_center_idx
  on public.availabilities (professional_center_id, center_id);
create index availabilities_active_professional_center_weekday_idx
  on public.availabilities (professional_center_id, weekday) where is_active;

create index appointments_center_starts_at_idx
  on public.appointments (center_id, starts_at);
create index appointments_professional_center_starts_at_idx
  on public.appointments (professional_center_id, starts_at);
create index appointments_professional_center_specialty_idx
  on public.appointments (professional_center_id, specialty_id);
create index appointments_patient_center_starts_at_idx
  on public.appointments (patient_center_id, starts_at desc);
create index appointments_center_status_starts_at_idx
  on public.appointments (center_id, status, starts_at);

create trigger centers_set_updated_at
before update on public.centers
for each row execute function private.set_updated_at();

create trigger users_set_updated_at
before update on public.users
for each row execute function private.set_updated_at();

create trigger professionals_set_updated_at
before update on public.professionals
for each row execute function private.set_updated_at();

create trigger persons_set_updated_at
before update on public.persons
for each row execute function private.set_updated_at();

create trigger specialties_set_updated_at
before update on public.specialties
for each row execute function private.set_updated_at();

create trigger professional_centers_set_updated_at
before update on public.professional_centers
for each row execute function private.set_updated_at();

create trigger center_memberships_set_updated_at
before update on public.center_memberships
for each row execute function private.set_updated_at();

create trigger professional_center_specialties_set_updated_at
before update on public.professional_center_specialties
for each row execute function private.set_updated_at();

create trigger patient_centers_set_updated_at
before update on public.patient_centers
for each row execute function private.set_updated_at();

create trigger availabilities_set_updated_at
before update on public.availabilities
for each row execute function private.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

alter table public.centers enable row level security;
alter table public.users enable row level security;
alter table public.center_memberships enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_centers enable row level security;
alter table public.specialties enable row level security;
alter table public.professional_center_specialties enable row level security;
alter table public.persons enable row level security;
alter table public.patient_centers enable row level security;
alter table public.availabilities enable row level security;
alter table public.appointments enable row level security;

revoke all on table
  public.centers,
  public.users,
  public.center_memberships,
  public.professionals,
  public.professional_centers,
  public.specialties,
  public.professional_center_specialties,
  public.persons,
  public.patient_centers,
  public.availabilities,
  public.appointments
from anon, authenticated;

commit;
