-- Follow-up to the applied TASK-007A foundation: eliminate unused local variables.

create or replace function public.staff_search_patient_centers(
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
  v_query text := private.trim_patient_input(p_query);
  v_document text;
  v_state text := coalesce(p_state, 'ACTIVE');
begin
  perform private.patient_center_timezone(p_center_id);
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

create or replace function public.staff_update_patient_center(
  p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz,
  p_phone text, p_email text, p_insurance_name text, p_administrative_notes text
)
returns table (patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_phone text;
  v_email text;
  v_insurance text;
  v_notes text;
  v_relation public.patient_centers%rowtype;
begin
  perform private.patient_center_timezone(p_center_id);
  v_phone := private.patient_required_text(p_phone, 50);
  v_email := private.patient_email(p_email);
  v_insurance := private.patient_optional_text(p_insurance_name, 160);
  v_notes := private.patient_optional_text(p_administrative_notes, 4000);
  if p_patient_center_id is null or p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_center(p_center_id);
  perform private.patient_center_timezone(p_center_id);
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

create or replace function public.staff_deactivate_patient_center(
  p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz,
  p_confirmed boolean
)
returns table (patient_center_id uuid, updated_at timestamptz, outcome text)
language plpgsql security definer set search_path = ''
as $function$
declare
  v_relation public.patient_centers%rowtype;
begin
  perform private.patient_center_timezone(p_center_id);
  if p_patient_center_id is null or p_expected_updated_at is null or p_confirmed is distinct from true then
    raise exception using errcode = '22023', message = 'INVALID_PATIENT_INPUT';
  end if;
  perform private.patient_lock_center(p_center_id);
  perform private.patient_center_timezone(p_center_id);
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
