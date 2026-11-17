-- TASK-039: a DOB mismatch must not disclose global Person or center relationship data.
-- Keep the existing signature, authorization, SECURITY DEFINER and EXECUTE grants.
create or replace function public.staff_resolve_patient_identity(
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
  if v_person.birth_date <> p_birth_date then
    return query select 'UNVERIFIED'::text, null::text, null::text, false,
      null::text, null::uuid, null::uuid, null::timestamptz;
    return;
  end if;
  select * into v_relation from public.patient_centers as pc
  where pc.center_id = p_center_id and pc.person_id = v_person.id;
  return query select 'FOUND'::text, v_person.first_name, v_person.last_name, true,
    case when v_relation.id is null then 'NOT_LINKED'
      when v_relation.is_active then 'ACTIVE' else 'INACTIVE' end::text,
    v_person.id, v_relation.id, v_relation.updated_at;
end;
$function$;
