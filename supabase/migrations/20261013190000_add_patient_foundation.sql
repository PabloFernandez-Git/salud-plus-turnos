-- TASK-007A: tenant patient foundation. ISO snapshot: 2026-10-13, ISO 3166-1 alpha-2
-- Source: https://www.iso.org/iso-3166-country-codes.html
-- Codes mirrored in src/modules/patients/schemas/iso-3166-1-alpha-2.json.
create function private.trim_patient_input(p_value text)
returns text language sql immutable strict security invoker set search_path = ''
as $function$
  select pg_catalog.btrim(p_value, E'\t\n\v\f\r ');
$function$;

create function private.is_valid_patient_nationality_code(p_code text)
returns boolean language sql immutable strict security invoker set search_path = ''
as $function$
  select p_code = any (array['AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW']::text[]);
$function$;

create function private.center_local_date_at(p_timezone text, p_instant timestamptz)
returns date language sql stable strict security invoker set search_path = ''
as $function$
  select (p_instant at time zone p_timezone)::date;
$function$;

create function private.patient_required_text(p_value text, p_max integer)
returns text language plpgsql immutable security invoker set search_path = ''
as $function$
declare v_value text := private.trim_patient_input(p_value);
begin
  if v_value is null or v_value = '' or pg_catalog.char_length(v_value) > p_max then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  return v_value;
end;
$function$;

create function private.patient_optional_text(p_value text, p_max integer)
returns text language plpgsql immutable security invoker set search_path = ''
as $function$
declare v_value text := nullif(private.trim_patient_input(p_value), '');
begin
  if v_value is not null and pg_catalog.char_length(v_value) > p_max then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  return v_value;
end;
$function$;

create function private.patient_nationality(p_value text)
returns text language plpgsql immutable security invoker set search_path = ''
as $function$
declare v_value text := pg_catalog.upper(private.trim_patient_input(p_value));
begin
  if v_value is null or not private.is_valid_patient_nationality_code(v_value) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  return v_value;
end;
$function$;

create function private.patient_document(p_value text)
returns text language plpgsql immutable security invoker set search_path = ''
as $function$
declare v_value text := private.patient_required_text(p_value, 100);
begin
  if private.normalize_document(v_value) = '' then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  return v_value;
end;
$function$;

create function private.patient_email(p_value text)
returns text language plpgsql immutable security invoker set search_path = ''
as $function$
declare v_value text := pg_catalog.lower(private.patient_optional_text(p_value, 320));
begin
  if v_value is not null and not private.is_valid_professional_email(v_value) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  return v_value;
end;
$function$;

create function private.patient_center_timezone(p_center_id uuid)
returns text language plpgsql volatile security definer set search_path = ''
as $function$
declare v_timezone text;
begin
  if auth.uid() is null or p_center_id is null
    or not private.has_active_center_role(
      p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
    )
  then
    raise exception using errcode = '42501', message = 'PATIENT_ACCESS_DENIED';
  end if;
  select center_record.timezone into v_timezone
  from public.centers as center_record
  where center_record.id = p_center_id and center_record.is_active;
  if v_timezone is null then
    raise exception using errcode = '42501', message = 'PATIENT_ACCESS_DENIED';
  end if;
  return v_timezone;
end;
$function$;

create function private.patient_lock_identity(p_nationality text, p_document text)
returns void language plpgsql volatile security invoker set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'salud-plus:patient-identity:' || p_nationality || ':' || private.normalize_document(p_document), 0
  ));
end;
$function$;

create function private.patient_lock_center(p_center_id uuid)
returns void language plpgsql volatile security invoker set search_path = ''
as $function$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'salud-plus:center:' || p_center_id::text, 0
  ));
end;
$function$;

revoke all on function private.trim_patient_input(text),
  private.is_valid_patient_nationality_code(text),
  private.center_local_date_at(text, timestamptz),
  private.patient_required_text(text, integer),
  private.patient_optional_text(text, integer),
  private.patient_nationality(text),
  private.patient_document(text),
  private.patient_email(text),
  private.patient_center_timezone(uuid),
  private.patient_lock_identity(text, text),
  private.patient_lock_center(uuid)
from public, anon, authenticated;

drop trigger patient_centers_set_updated_at on public.patient_centers;
create trigger patient_centers_set_updated_at
before update on public.patient_centers
for each row execute function private.set_task006_cas_updated_at();

create policy patient_centers_select_tenant_staff on public.patient_centers
for select to authenticated
using (private.has_active_center_role(
  center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
));

create policy persons_select_linked_tenant_staff on public.persons
for select to authenticated
using (exists (
  select 1 from public.patient_centers as patient_center
  where patient_center.person_id = persons.id
    and private.has_active_center_role(
      patient_center.center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
    )
));

grant select on public.persons, public.patient_centers to authenticated;

create function public.staff_search_patient_centers(
  p_center_id uuid, p_query text default null, p_state text default null,
  p_limit integer default 25, p_offset integer default 0
)
returns table (
  patient_center_id uuid, person_id uuid, first_name text, last_name text,
  nationality_code text, document_number text, birth_date date, phone text,
  email text, insurance_name text, is_active boolean, updated_at timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_query text := private.trim_patient_input(p_query);
  v_document text;
  v_state text := coalesce(p_state, 'ACTIVE');
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  if p_limit is null or p_limit < 1 or p_limit > 50
    or p_offset is null or p_offset < 0 or p_offset > 10000
    or v_state not in ('ACTIVE', 'INACTIVE', 'ALL')
    or (v_query is not null and pg_catalog.char_length(v_query) > 100)
  then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  if v_query is not null and v_query <> '' then
    v_document := private.normalize_document(v_query);
  end if;
  return query
  select pc.id, person_record.id, person_record.first_name, person_record.last_name,
    person_record.nationality_code, person_record.document_number, person_record.birth_date,
    pc.phone, pc.email, pc.insurance_name, pc.is_active, pc.updated_at
  from public.patient_centers as pc
  join public.persons as person_record on person_record.id = pc.person_id
  where pc.center_id = p_center_id
    and (v_state = 'ALL' or (v_state = 'ACTIVE' and pc.is_active)
      or (v_state = 'INACTIVE' and not pc.is_active))
    and (v_query is null or v_query = ''
      or (v_document <> '' and person_record.normalized_document = v_document)
      or pg_catalog.strpos(pg_catalog.lower(private.trim_patient_input(person_record.first_name)), pg_catalog.lower(v_query)) > 0
      or pg_catalog.strpos(pg_catalog.lower(private.trim_patient_input(person_record.last_name)), pg_catalog.lower(v_query)) > 0
      or pg_catalog.strpos(pg_catalog.lower(private.trim_patient_input(person_record.first_name || ' ' || person_record.last_name)), pg_catalog.lower(v_query)) > 0
      or pg_catalog.strpos(private.trim_patient_input(pc.phone), v_query) > 0
      or pg_catalog.strpos(pg_catalog.lower(private.trim_patient_input(pc.email)), pg_catalog.lower(v_query)) > 0)
  order by pg_catalog.lower(private.trim_patient_input(person_record.last_name)),
    pg_catalog.lower(private.trim_patient_input(person_record.first_name)), pc.id
  limit p_limit offset p_offset;
end;
$function$;

create function public.staff_resolve_patient_identity(
  p_center_id uuid, p_nationality_code text, p_document_number text, p_birth_date date
)
returns table (
  identity_status text, first_name text, last_name text, birth_date_matches boolean,
  relationship_state text, person_id uuid, patient_center_id uuid,
  patient_center_updated_at timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_nationality text;
  v_document text;
  v_person public.persons%rowtype;
  v_relation public.patient_centers%rowtype;
  v_matches boolean;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  v_nationality := private.patient_nationality(p_nationality_code);
  v_document := private.patient_document(p_document_number);
  if p_birth_date is null
    or p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp())
  then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  select * into v_person from public.persons as p
  where p.nationality_code = v_nationality
    and p.normalized_document = private.normalize_document(v_document);
  if not found then
    return query select 'NOT_FOUND'::text, null::text, null::text, null::boolean,
      null::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;
  v_matches := v_person.birth_date = p_birth_date;
  select * into v_relation from public.patient_centers as pc
  where pc.center_id = p_center_id and pc.person_id = v_person.id;
  return query select 'FOUND'::text, v_person.first_name, v_person.last_name, v_matches,
    case when v_relation.id is null then 'NOT_LINKED'
      when v_relation.is_active then 'ACTIVE' else 'INACTIVE' end::text,
    case when v_matches then v_person.id else null::uuid end,
    case when v_matches then v_relation.id else null::uuid end,
    case when v_matches then v_relation.updated_at else null::timestamptz end;
end;
$function$;

create function public.staff_create_patient_with_center(
  p_center_id uuid, p_first_name text, p_last_name text, p_birth_date date,
  p_nationality_code text, p_document_number text, p_phone text,
  p_email text, p_insurance_name text, p_administrative_notes text
)
returns table (person_id uuid, patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_first text;
  v_last text;
  v_nationality text;
  v_document text;
  v_phone text;
  v_email text;
  v_insurance text;
  v_notes text;
  v_person_id uuid;
  v_patient_center_id uuid;
  v_updated_at timestamptz;
  v_constraint text;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  v_first := private.patient_required_text(p_first_name, 100);
  v_last := private.patient_required_text(p_last_name, 100);
  v_nationality := private.patient_nationality(p_nationality_code);
  v_document := private.patient_document(p_document_number);
  v_phone := private.patient_required_text(p_phone, 50);
  v_email := private.patient_email(p_email);
  v_insurance := private.patient_optional_text(p_insurance_name, 160);
  v_notes := private.patient_optional_text(p_administrative_notes, 4000);
  if p_birth_date is null
    or p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp())
  then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_identity(v_nationality, v_document);
  perform private.patient_lock_center(p_center_id);
  v_timezone := private.patient_center_timezone(p_center_id);
  if p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp()) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  if exists (select 1 from public.persons as p where p.nationality_code = v_nationality
    and p.normalized_document = private.normalize_document(v_document))
  then
    raise exception using errcode = 'P0001', message = 'PATIENT_IDENTITY_ALREADY_EXISTS';
  end if;
  begin
    insert into public.persons (first_name, last_name, birth_date, nationality_code, document_number)
    values (v_first, v_last, p_birth_date, v_nationality, v_document)
    returning id into v_person_id;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'persons_nationality_document_key' then
      raise exception using errcode = 'P0001', message = 'PATIENT_IDENTITY_ALREADY_EXISTS';
    end if;
    raise;
  end;
  insert into public.patient_centers (person_id, center_id, phone, email, insurance_name, administrative_notes)
  values (v_person_id, p_center_id, v_phone, v_email, v_insurance, v_notes)
  returning id, patient_centers.updated_at into v_patient_center_id, v_updated_at;
  return query select v_person_id, v_patient_center_id, v_updated_at, 'CREATED'::text;
end;
$function$;

create function public.staff_link_person_to_center(
  p_center_id uuid, p_person_id uuid, p_nationality_code text, p_document_number text,
  p_birth_date date, p_phone text, p_email text, p_insurance_name text,
  p_administrative_notes text, p_confirmed boolean
)
returns table (person_id uuid, patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_nationality text;
  v_document text;
  v_phone text;
  v_email text;
  v_insurance text;
  v_notes text;
  v_person public.persons%rowtype;
  v_relation public.patient_centers%rowtype;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  v_nationality := private.patient_nationality(p_nationality_code);
  v_document := private.patient_document(p_document_number);
  v_phone := private.patient_required_text(p_phone, 50);
  v_email := private.patient_email(p_email);
  v_insurance := private.patient_optional_text(p_insurance_name, 160);
  v_notes := private.patient_optional_text(p_administrative_notes, 4000);
  if p_person_id is null or p_confirmed is distinct from true or p_birth_date is null
    or p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp())
  then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_identity(v_nationality, v_document);
  perform private.patient_lock_center(p_center_id);
  v_timezone := private.patient_center_timezone(p_center_id);
  if p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp()) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  select * into v_person from public.persons as p
  where p.id = p_person_id and p.nationality_code = v_nationality
    and p.normalized_document = private.normalize_document(v_document);
  if not found then
    raise exception using errcode = 'P0001', message = 'PATIENT_IDENTITY_MISMATCH';
  end if;
  if v_person.birth_date <> p_birth_date then
    raise exception using errcode = 'P0001', message = 'PATIENT_BIRTH_DATE_MISMATCH';
  end if;
  select * into v_relation from public.patient_centers as pc
  where pc.center_id = p_center_id and pc.person_id = v_person.id for update;
  if found then
    if not v_relation.is_active then
      raise exception using errcode = 'P0001', message = 'PATIENT_RELATIONSHIP_INACTIVE';
    end if;
    return query select v_person.id, v_relation.id, v_relation.updated_at, 'ALREADY_ACTIVE'::text;
    return;
  end if;
  insert into public.patient_centers (person_id, center_id, phone, email, insurance_name, administrative_notes)
  values (v_person.id, p_center_id, v_phone, v_email, v_insurance, v_notes)
  returning * into v_relation;
  return query select v_person.id, v_relation.id, v_relation.updated_at, 'LINKED'::text;
end;
$function$;

create function public.staff_reactivate_patient_center(
  p_center_id uuid, p_patient_center_id uuid, p_nationality_code text,
  p_document_number text, p_birth_date date, p_expected_updated_at timestamptz,
  p_confirmed boolean
)
returns table (patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_nationality text;
  v_document text;
  v_relation public.patient_centers%rowtype;
  v_person public.persons%rowtype;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  v_nationality := private.patient_nationality(p_nationality_code);
  v_document := private.patient_document(p_document_number);
  if p_patient_center_id is null or p_expected_updated_at is null
    or p_confirmed is distinct from true or p_birth_date is null
    or p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp())
  then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_identity(v_nationality, v_document);
  perform private.patient_lock_center(p_center_id);
  v_timezone := private.patient_center_timezone(p_center_id);
  if p_birth_date > private.center_local_date_at(v_timezone, pg_catalog.statement_timestamp()) then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  select * into v_relation from public.patient_centers as pc
  where pc.id = p_patient_center_id and pc.center_id = p_center_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PATIENT_CENTER_NOT_FOUND';
  end if;
  select * into v_person from public.persons as p where p.id = v_relation.person_id
    and p.nationality_code = v_nationality
    and p.normalized_document = private.normalize_document(v_document);
  if not found then
    raise exception using errcode = 'P0001', message = 'PATIENT_IDENTITY_MISMATCH';
  end if;
  if v_person.birth_date <> p_birth_date then
    raise exception using errcode = 'P0001', message = 'PATIENT_BIRTH_DATE_MISMATCH';
  end if;
  if v_relation.updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PATIENT_CENTER_STATE';
  end if;
  if v_relation.is_active then
    return query select v_relation.id, v_relation.updated_at, 'ALREADY_ACTIVE'::text;
    return;
  end if;
  update public.patient_centers as pc set is_active = true
  where pc.id = v_relation.id returning * into v_relation;
  return query select v_relation.id, v_relation.updated_at, 'REACTIVATED'::text;
end;
$function$;

create function public.staff_update_patient_center(
  p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz,
  p_phone text, p_email text, p_insurance_name text, p_administrative_notes text
)
returns table (patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_phone text;
  v_email text;
  v_insurance text;
  v_notes text;
  v_relation public.patient_centers%rowtype;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  v_phone := private.patient_required_text(p_phone, 50);
  v_email := private.patient_email(p_email);
  v_insurance := private.patient_optional_text(p_insurance_name, 160);
  v_notes := private.patient_optional_text(p_administrative_notes, 4000);
  if p_patient_center_id is null or p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_center(p_center_id);
  v_timezone := private.patient_center_timezone(p_center_id);
  select * into v_relation from public.patient_centers as pc
  where pc.id = p_patient_center_id and pc.center_id = p_center_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PATIENT_CENTER_NOT_FOUND';
  end if;
  if v_relation.updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PATIENT_CENTER_STATE';
  end if;
  if v_relation.phone = v_phone and v_relation.email is not distinct from v_email
    and v_relation.insurance_name is not distinct from v_insurance
    and v_relation.administrative_notes is not distinct from v_notes
  then
    return query select v_relation.id, v_relation.updated_at, 'UNCHANGED'::text;
    return;
  end if;
  update public.patient_centers as pc
  set phone = v_phone, email = v_email, insurance_name = v_insurance,
    administrative_notes = v_notes
  where pc.id = v_relation.id returning * into v_relation;
  return query select v_relation.id, v_relation.updated_at, 'UPDATED'::text;
end;
$function$;

create function public.staff_deactivate_patient_center(
  p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz,
  p_confirmed boolean
)
returns table (patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_relation public.patient_centers%rowtype;
begin
  v_timezone := private.patient_center_timezone(p_center_id);
  if p_patient_center_id is null or p_expected_updated_at is null or p_confirmed is distinct from true then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_center(p_center_id);
  v_timezone := private.patient_center_timezone(p_center_id);
  select * into v_relation from public.patient_centers as pc
  where pc.id = p_patient_center_id and pc.center_id = p_center_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PATIENT_CENTER_NOT_FOUND';
  end if;
  if v_relation.updated_at <> p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PATIENT_CENTER_STATE';
  end if;
  if not v_relation.is_active then
    return query select v_relation.id, v_relation.updated_at, 'UNCHANGED'::text;
    return;
  end if;
  update public.patient_centers as pc set is_active = false
  where pc.id = v_relation.id returning * into v_relation;
  return query select v_relation.id, v_relation.updated_at, 'DEACTIVATED'::text;
end;
$function$;

revoke all on function
  public.staff_search_patient_centers(uuid, text, text, integer, integer),
  public.staff_resolve_patient_identity(uuid, text, text, date),
  public.staff_create_patient_with_center(uuid, text, text, date, text, text, text, text, text, text),
  public.staff_link_person_to_center(uuid, uuid, text, text, date, text, text, text, text, boolean),
  public.staff_reactivate_patient_center(uuid, uuid, text, text, date, timestamptz, boolean),
  public.staff_update_patient_center(uuid, uuid, timestamptz, text, text, text, text),
  public.staff_deactivate_patient_center(uuid, uuid, timestamptz, boolean)
from public, anon, authenticated;

grant execute on function
  public.staff_search_patient_centers(uuid, text, text, integer, integer),
  public.staff_resolve_patient_identity(uuid, text, text, date),
  public.staff_create_patient_with_center(uuid, text, text, date, text, text, text, text, text, text),
  public.staff_link_person_to_center(uuid, uuid, text, text, date, text, text, text, text, boolean),
  public.staff_reactivate_patient_center(uuid, uuid, text, text, date, timestamptz, boolean),
  public.staff_update_patient_center(uuid, uuid, timestamptz, text, text, text, text),
  public.staff_deactivate_patient_center(uuid, uuid, timestamptz, boolean)
to authenticated;
