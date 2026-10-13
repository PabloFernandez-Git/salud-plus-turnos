create function private.is_valid_professional_email(p_email text)
returns boolean
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $function$
declare
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_local text;
  v_domain text;
  v_domain_labels text[];
  v_label text;
begin
  if pg_catalog.char_length(v_email) > 320
    or v_email collate "C" ~ '[[:space:]]'
    or pg_catalog.length(v_email) - pg_catalog.length(pg_catalog.replace(v_email, '@', '')) <> 1
  then
    return false;
  end if;

  v_local := pg_catalog.split_part(v_email, '@', 1);
  v_domain := pg_catalog.split_part(v_email, '@', 2);

  if v_local = ''
    or v_domain = ''
    or pg_catalog.char_length(v_local) > 64
    or pg_catalog.char_length(v_domain) > 255
    or v_local collate "C" !~ '^[a-z0-9_+.''-]+$'
    or v_local like '.%'
    or v_local like '%.'
    or v_local like '%..%'
    or pg_catalog.right(v_local, 1) = ''''
    or v_domain like '.%'
    or v_domain like '%.'
    or v_domain like '%..%'
  then
    return false;
  end if;

  v_domain_labels := pg_catalog.string_to_array(v_domain, '.');
  if pg_catalog.array_length(v_domain_labels, 1) < 2 then
    return false;
  end if;

  foreach v_label in array v_domain_labels
  loop
    if pg_catalog.char_length(v_label) > 63
      or v_label collate "C" !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
    then
      return false;
    end if;
  end loop;

  if v_domain_labels[pg_catalog.array_length(v_domain_labels, 1)] collate "C" !~ '^[a-z]{2,}$'
  then
    return false;
  end if;

  return true;
end;
$function$;

revoke all on function private.is_valid_professional_email(text)
from public, anon, authenticated;

alter table public.professionals
  add constraint professionals_email_contract_check
  check (
    email = pg_catalog.lower(pg_catalog.btrim(email))
    and private.is_valid_professional_email(email)
  ) not valid;

alter table public.professionals
  validate constraint professionals_email_contract_check;

create or replace function public.admin_create_professional_with_center(
  p_center_id uuid,
  p_first_name text,
  p_last_name text,
  p_nationality_code text,
  p_document_number text,
  p_email text,
  p_phone text,
  p_license_number text,
  p_usual_appointment_duration_minutes integer
)
returns table (
  professional_id uuid,
  professional_center_id uuid,
  professional_center_is_active boolean,
  professional_center_updated_at timestamptz,
  outcome text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_first_name text := pg_catalog.btrim(p_first_name);
  v_last_name text := pg_catalog.btrim(p_last_name);
  v_nationality_code text := pg_catalog.upper(pg_catalog.btrim(p_nationality_code));
  v_document_number text := pg_catalog.btrim(p_document_number);
  v_normalized_document text := private.normalize_document(p_document_number);
  v_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_phone text := nullif(pg_catalog.btrim(p_phone), '');
  v_license_number text := nullif(pg_catalog.btrim(p_license_number), '');
  v_professional_id uuid;
  v_professional_center_id uuid;
  v_professional_center_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if v_first_name is null
    or v_first_name = ''
    or v_last_name is null
    or v_last_name = ''
    or v_nationality_code is null
    or v_nationality_code collate "C" !~ '^[A-Z]{2}$'
    or v_document_number is null
    or v_document_number = ''
    or v_normalized_document is null
    or v_normalized_document = ''
    or v_email is null
    or not private.is_valid_professional_email(v_email)
    or p_usual_appointment_duration_minutes is null
    or p_usual_appointment_duration_minutes < 5
    or p_usual_appointment_duration_minutes > 480
    or p_usual_appointment_duration_minutes % 5 <> 0
  then
    raise exception using errcode = '22023', message = 'INVALID_PROFESSIONAL_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'salud-plus:professional-identity:'
        || v_nationality_code
        || ':'
        || v_normalized_document,
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if exists (
    select 1
    from public.professionals as professional
    where professional.nationality_code = v_nationality_code
      and professional.normalized_document = v_normalized_document
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PROFESSIONAL_IDENTITY_ALREADY_EXISTS';
  end if;

  begin
    insert into public.professionals (
      first_name,
      last_name,
      nationality_code,
      document_number,
      email,
      phone
    ) values (
      v_first_name,
      v_last_name,
      v_nationality_code,
      v_document_number,
      v_email,
      v_phone
    )
    returning id into v_professional_id;
  exception
    when unique_violation then
      raise exception using
        errcode = 'P0001',
        message = 'PROFESSIONAL_IDENTITY_ALREADY_EXISTS';
  end;

  insert into public.professional_centers (
    professional_id,
    center_id,
    license_number,
    usual_appointment_duration_minutes
  ) values (
    v_professional_id,
    p_center_id,
    v_license_number,
    p_usual_appointment_duration_minutes
  )
  returning id, updated_at
  into v_professional_center_id, v_professional_center_updated_at;

  return query
  select
    v_professional_id,
    v_professional_center_id,
    true,
    v_professional_center_updated_at,
    'CREATED'::text;
end;
$function$;

revoke all on function public.admin_create_professional_with_center(
  uuid, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;

grant execute on function public.admin_create_professional_with_center(
  uuid, text, text, text, text, text, text, text, integer
) to authenticated;
