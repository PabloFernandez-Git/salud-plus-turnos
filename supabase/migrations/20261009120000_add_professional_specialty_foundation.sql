begin;

create policy specialties_select_center_admin
on public.specialties
for select
to authenticated
using (
  private.has_active_center_role(
    center_id,
    array['ADMIN']::public.membership_role[]
  )
);

create policy professional_center_specialties_select_center_admin
on public.professional_center_specialties
for select
to authenticated
using (
  private.has_active_center_role(
    center_id,
    array['ADMIN']::public.membership_role[]
  )
);

grant select on table
  public.specialties,
  public.professional_center_specialties
to authenticated;

create function public.admin_resolve_professional_by_document(
  p_center_id uuid,
  p_nationality_code text,
  p_document_number text
)
returns table (
  resolution_status text,
  professional_id uuid,
  first_name text,
  last_name text,
  professional_center_id uuid,
  professional_center_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_nationality_code text := pg_catalog.upper(pg_catalog.btrim(p_nationality_code));
  v_normalized_document text := private.normalize_document(p_document_number);
  v_professional_id uuid;
  v_first_name text;
  v_last_name text;
  v_professional_center_id uuid;
  v_professional_center_is_active boolean;
  v_professional_center_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if v_nationality_code is null
    or v_nationality_code collate "C" !~ '^[A-Z]{2}$'
    or v_normalized_document is null
    or v_normalized_document = ''
  then
    raise exception using errcode = '22023', message = 'INVALID_PROFESSIONAL_INPUT';
  end if;

  select
    professional.id,
    professional.first_name,
    professional.last_name,
    professional_center.id,
    professional_center.is_active,
    professional_center.updated_at
  into
    v_professional_id,
    v_first_name,
    v_last_name,
    v_professional_center_id,
    v_professional_center_is_active,
    v_professional_center_updated_at
  from public.professionals as professional
  left join public.professional_centers as professional_center
    on professional_center.professional_id = professional.id
   and professional_center.center_id = p_center_id
  where professional.nationality_code = v_nationality_code
    and professional.normalized_document = v_normalized_document;

  if not found then
    return query
    select
      'NOT_FOUND'::text,
      null::uuid,
      null::text,
      null::text,
      null::uuid,
      null::timestamptz;
    return;
  end if;

  return query
  select
    case
      when v_professional_center_id is null then 'NOT_LINKED'
      when v_professional_center_is_active then 'LINKED_ACTIVE'
      else 'LINKED_INACTIVE'
    end::text,
    v_professional_id,
    v_first_name,
    v_last_name,
    v_professional_center_id,
    v_professional_center_updated_at;
end;
$function$;

create function public.admin_update_professional_center(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_updated_at timestamptz,
  p_license_number text,
  p_usual_appointment_duration_minutes integer
)
returns table (
  professional_center_id uuid,
  license_number text,
  usual_appointment_duration_minutes integer,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_license_number text := nullif(pg_catalog.btrim(p_license_number), '');
  v_current_license_number text;
  v_current_duration integer;
  v_current_is_active boolean;
  v_current_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_professional_center_id is null
    or p_usual_appointment_duration_minutes is null
    or p_usual_appointment_duration_minutes < 5
    or p_usual_appointment_duration_minutes > 480
    or p_usual_appointment_duration_minutes % 5 <> 0
  then
    raise exception using errcode = '22023', message = 'INVALID_PROFESSIONAL_CENTER_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  select
    professional_center.license_number,
    professional_center.usual_appointment_duration_minutes,
    professional_center.is_active,
    professional_center.updated_at
  into
    v_current_license_number,
    v_current_duration,
    v_current_is_active,
    v_current_updated_at
  from public.professional_centers as professional_center
  where professional_center.id = p_professional_center_id
    and professional_center.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
  end if;

  if v_current_license_number is not distinct from v_license_number
    and v_current_duration = p_usual_appointment_duration_minutes
  then
    return query
    select
      p_professional_center_id,
      v_current_license_number,
      v_current_duration,
      v_current_is_active,
      v_current_updated_at;
    return;
  end if;

  update public.professional_centers as professional_center
  set
    license_number = v_license_number,
    usual_appointment_duration_minutes = p_usual_appointment_duration_minutes
  where professional_center.id = p_professional_center_id
  returning
    professional_center.license_number,
    professional_center.usual_appointment_duration_minutes,
    professional_center.is_active,
    professional_center.updated_at
  into
    v_current_license_number,
    v_current_duration,
    v_current_is_active,
    v_current_updated_at;

  return query
  select
    p_professional_center_id,
    v_current_license_number,
    v_current_duration,
    v_current_is_active,
    v_current_updated_at;
end;
$function$;

create function public.admin_set_professional_center_active(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_updated_at timestamptz,
  p_is_active boolean
)
returns table (
  professional_center_id uuid,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_is_active boolean;
  v_current_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_professional_center_id is null or p_is_active is null then
    raise exception using errcode = '22023', message = 'INVALID_PROFESSIONAL_CENTER_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  select professional_center.is_active, professional_center.updated_at
  into v_current_is_active, v_current_updated_at
  from public.professional_centers as professional_center
  where professional_center.id = p_professional_center_id
    and professional_center.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
  end if;

  if not p_is_active and exists (
    select 1
    from public.center_memberships as membership
    where membership.center_id = p_center_id
      and membership.professional_center_id = p_professional_center_id
      and membership.role = 'PROFESSIONAL'::public.membership_role
      and membership.is_active
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP';
  end if;

  if v_current_is_active = p_is_active then
    return query
    select p_professional_center_id, v_current_is_active, v_current_updated_at;
    return;
  end if;

  update public.professional_centers as professional_center
  set is_active = p_is_active
  where professional_center.id = p_professional_center_id
  returning professional_center.is_active, professional_center.updated_at
  into v_current_is_active, v_current_updated_at;

  return query
  select p_professional_center_id, v_current_is_active, v_current_updated_at;
end;
$function$;

create function public.admin_create_professional_with_center(
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
    or pg_catalog.octet_length(v_email) > 320
    or v_email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
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

create function public.admin_link_professional_to_center(
  p_center_id uuid,
  p_professional_id uuid,
  p_nationality_code text,
  p_document_number text,
  p_expected_professional_center_updated_at timestamptz
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
  v_nationality_code text := pg_catalog.upper(pg_catalog.btrim(p_nationality_code));
  v_normalized_document text := private.normalize_document(p_document_number);
  v_professional_center_id uuid;
  v_professional_center_is_active boolean;
  v_professional_center_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_professional_id is null
    or v_nationality_code is null
    or v_nationality_code collate "C" !~ '^[A-Z]{2}$'
    or v_normalized_document is null
    or v_normalized_document = ''
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

  if not exists (
    select 1
    from public.professionals as professional
    where professional.id = p_professional_id
      and professional.nationality_code = v_nationality_code
      and professional.normalized_document = v_normalized_document
  ) then
    raise exception using errcode = 'P0001', message = 'PROFESSIONAL_IDENTITY_MISMATCH';
  end if;

  select
    professional_center.id,
    professional_center.is_active,
    professional_center.updated_at
  into
    v_professional_center_id,
    v_professional_center_is_active,
    v_professional_center_updated_at
  from public.professional_centers as professional_center
  where professional_center.center_id = p_center_id
    and professional_center.professional_id = p_professional_id
  for update;

  if not found then
    if p_expected_professional_center_updated_at is not null then
      raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
    end if;

    insert into public.professional_centers (professional_id, center_id)
    values (p_professional_id, p_center_id)
    returning id, updated_at
    into v_professional_center_id, v_professional_center_updated_at;

    return query
    select
      p_professional_id,
      v_professional_center_id,
      true,
      v_professional_center_updated_at,
      'CREATED_LINK'::text;
    return;
  end if;

  if v_professional_center_is_active then
    if p_expected_professional_center_updated_at is not null
      and v_professional_center_updated_at
        is distinct from p_expected_professional_center_updated_at
    then
      raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
    end if;

    return query
    select
      p_professional_id,
      v_professional_center_id,
      true,
      v_professional_center_updated_at,
      'REUSED_ACTIVE'::text;
    return;
  end if;

  if v_professional_center_updated_at is distinct from p_expected_professional_center_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
  end if;

  update public.professional_centers as professional_center
  set is_active = true
  where professional_center.id = v_professional_center_id
  returning professional_center.updated_at
  into v_professional_center_updated_at;

  return query
  select
    p_professional_id,
    v_professional_center_id,
    true,
    v_professional_center_updated_at,
    'REACTIVATED'::text;
end;
$function$;

create function public.admin_create_specialty(
  p_center_id uuid,
  p_name text,
  p_description text
)
returns table (
  specialty_id uuid,
  name text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := pg_catalog.btrim(p_name);
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_specialty_id uuid;
  v_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if v_name is null or v_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  begin
    insert into public.specialties (center_id, name, description)
    values (p_center_id, v_name, v_description)
    returning id, specialties.updated_at into v_specialty_id, v_updated_at;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'SPECIALTY_NAME_ALREADY_EXISTS';
  end;

  return query
  select v_specialty_id, v_name, v_description, true, v_updated_at;
end;
$function$;

create function public.admin_update_professional_center_specialties(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_professional_center_updated_at timestamptz,
  p_activate_specialty_ids uuid[],
  p_deactivate_specialty_ids uuid[]
)
returns table (
  professional_center_id uuid,
  professional_center_updated_at timestamptz,
  activated_count integer,
  deactivated_count integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_all_specialty_ids uuid[];
  v_current_professional_center_is_active boolean;
  v_current_professional_center_updated_at timestamptz;
  v_activated_count integer := 0;
  v_deactivated_count integer := 0;
  v_changed_count integer;
  v_requested_count integer;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_professional_center_id is null
    or p_activate_specialty_ids is null
    or p_deactivate_specialty_ids is null
    or pg_catalog.array_position(p_activate_specialty_ids, null) is not null
    or pg_catalog.array_position(p_deactivate_specialty_ids, null) is not null
    or coalesce(pg_catalog.array_ndims(p_activate_specialty_ids), 1) <> 1
    or coalesce(pg_catalog.array_ndims(p_deactivate_specialty_ids), 1) <> 1
    or exists (
      select 1
      from pg_catalog.unnest(p_activate_specialty_ids) as requested(specialty_id)
      group by requested.specialty_id
      having pg_catalog.count(*) > 1
    )
    or exists (
      select 1
      from pg_catalog.unnest(p_deactivate_specialty_ids) as requested(specialty_id)
      group by requested.specialty_id
      having pg_catalog.count(*) > 1
    )
    or exists (
      select 1
      from pg_catalog.unnest(p_activate_specialty_ids) as activate(specialty_id)
      join pg_catalog.unnest(p_deactivate_specialty_ids) as deactivate(specialty_id)
        using (specialty_id)
    )
  then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_BATCH';
  end if;

  if pg_catalog.cardinality(p_activate_specialty_ids) = 0
    and pg_catalog.cardinality(p_deactivate_specialty_ids) = 0
  then
    raise exception using errcode = '22023', message = 'NO_SPECIALTY_CHANGES';
  end if;

  v_all_specialty_ids := p_activate_specialty_ids || p_deactivate_specialty_ids;
  v_requested_count := pg_catalog.cardinality(v_all_specialty_ids);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  select professional_center.is_active, professional_center.updated_at
  into
    v_current_professional_center_is_active,
    v_current_professional_center_updated_at
  from public.professional_centers as professional_center
  where professional_center.id = p_professional_center_id
    and professional_center.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  if v_current_professional_center_updated_at
    is distinct from p_expected_professional_center_updated_at
  then
    raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
  end if;

  perform specialty.id
  from public.specialties as specialty
  where specialty.center_id = p_center_id
    and specialty.id = any(v_all_specialty_ids)
  order by specialty.id
  for update;

  if (
    select pg_catalog.count(*)::integer
    from public.specialties as specialty
    where specialty.center_id = p_center_id
      and specialty.id = any(v_all_specialty_ids)
  ) <> v_requested_count then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_BATCH';
  end if;

  perform association.specialty_id
  from public.professional_center_specialties as association
  where association.professional_center_id = p_professional_center_id
    and association.specialty_id = any(v_all_specialty_ids)
  order by association.specialty_id
  for update;

  if pg_catalog.cardinality(p_activate_specialty_ids) > 0 then
    if not v_current_professional_center_is_active then
      raise exception using errcode = 'P0001', message = 'PROFESSIONAL_CENTER_NOT_ACTIVE';
    end if;

    if exists (
      select 1
      from public.specialties as specialty
      where specialty.id = any(p_activate_specialty_ids)
        and specialty.center_id = p_center_id
        and not specialty.is_active
    ) then
      raise exception using errcode = 'P0001', message = 'SPECIALTY_NOT_ACTIVE';
    end if;
  end if;

  if (
    select pg_catalog.count(*)::integer
    from public.professional_center_specialties as association
    where association.professional_center_id = p_professional_center_id
      and association.center_id = p_center_id
      and association.specialty_id = any(p_deactivate_specialty_ids)
  ) <> pg_catalog.cardinality(p_deactivate_specialty_ids) then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_BATCH';
  end if;

  update public.professional_center_specialties as association
  set is_active = true
  where association.professional_center_id = p_professional_center_id
    and association.center_id = p_center_id
    and association.specialty_id = any(p_activate_specialty_ids)
    and not association.is_active;
  get diagnostics v_activated_count = row_count;

  insert into public.professional_center_specialties (
    professional_center_id,
    specialty_id,
    center_id,
    is_active
  )
  select
    p_professional_center_id,
    requested.specialty_id,
    p_center_id,
    true
  from pg_catalog.unnest(p_activate_specialty_ids) as requested(specialty_id)
  where not exists (
    select 1
    from public.professional_center_specialties as association
    where association.professional_center_id = p_professional_center_id
      and association.specialty_id = requested.specialty_id
  );
  get diagnostics v_changed_count = row_count;
  v_activated_count := v_activated_count + v_changed_count;

  update public.professional_center_specialties as association
  set is_active = false
  where association.professional_center_id = p_professional_center_id
    and association.center_id = p_center_id
    and association.specialty_id = any(p_deactivate_specialty_ids)
    and association.is_active;
  get diagnostics v_deactivated_count = row_count;

  if v_activated_count > 0 or v_deactivated_count > 0 then
    update public.professional_centers as professional_center
    set updated_at = pg_catalog.clock_timestamp()
    where professional_center.id = p_professional_center_id
    returning professional_center.updated_at
    into v_current_professional_center_updated_at;
  end if;

  return query
  select
    p_professional_center_id,
    v_current_professional_center_updated_at,
    v_activated_count,
    v_deactivated_count;
end;
$function$;

create function public.admin_update_specialty(
  p_center_id uuid,
  p_specialty_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_description text
)
returns table (
  specialty_id uuid,
  name text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text := pg_catalog.btrim(p_name);
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_current_name text;
  v_current_description text;
  v_current_is_active boolean;
  v_current_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_specialty_id is null or v_name is null or v_name = '' then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  select
    specialty.name,
    specialty.description,
    specialty.is_active,
    specialty.updated_at
  into
    v_current_name,
    v_current_description,
    v_current_is_active,
    v_current_updated_at
  from public.specialties as specialty
  where specialty.id = p_specialty_id
    and specialty.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_SPECIALTY_STATE';
  end if;

  if v_current_name = v_name and v_current_description is not distinct from v_description then
    return query
    select
      p_specialty_id,
      v_current_name,
      v_current_description,
      v_current_is_active,
      v_current_updated_at;
    return;
  end if;

  begin
    update public.specialties as specialty
    set name = v_name, description = v_description
    where specialty.id = p_specialty_id
    returning
      specialty.name,
      specialty.description,
      specialty.is_active,
      specialty.updated_at
    into
      v_current_name,
      v_current_description,
      v_current_is_active,
      v_current_updated_at;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'SPECIALTY_NAME_ALREADY_EXISTS';
  end;

  return query
  select
    p_specialty_id,
    v_current_name,
    v_current_description,
    v_current_is_active,
    v_current_updated_at;
end;
$function$;

create function public.admin_set_specialty_active(
  p_center_id uuid,
  p_specialty_id uuid,
  p_expected_updated_at timestamptz,
  p_is_active boolean
)
returns table (
  specialty_id uuid,
  name text,
  description text,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_description text;
  v_current_is_active boolean;
  v_current_updated_at timestamptz;
begin
  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  if p_specialty_id is null or p_is_active is null then
    raise exception using errcode = '22023', message = 'INVALID_SPECIALTY_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if auth.uid() is null or not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'CENTER_ADMINISTRATION_DENIED';
  end if;

  select specialty.name, specialty.description, specialty.is_active, specialty.updated_at
  into v_name, v_description, v_current_is_active, v_current_updated_at
  from public.specialties as specialty
  where specialty.id = p_specialty_id
    and specialty.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  if v_current_updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_SPECIALTY_STATE';
  end if;

  if v_current_is_active = p_is_active then
    return query
    select p_specialty_id, v_name, v_description, v_current_is_active, v_current_updated_at;
    return;
  end if;

  update public.specialties as specialty
  set is_active = p_is_active
  where specialty.id = p_specialty_id
  returning specialty.is_active, specialty.updated_at
  into v_current_is_active, v_current_updated_at;

  return query
  select p_specialty_id, v_name, v_description, v_current_is_active, v_current_updated_at;
end;
$function$;

revoke all on function public.admin_resolve_professional_by_document(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.admin_create_professional_with_center(
  uuid, text, text, text, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.admin_link_professional_to_center(
  uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.admin_update_professional_center(
  uuid, uuid, timestamptz, text, integer
) from public, anon, authenticated;
revoke all on function public.admin_set_professional_center_active(
  uuid, uuid, timestamptz, boolean
) from public, anon, authenticated;
revoke all on function public.admin_create_specialty(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.admin_update_specialty(uuid, uuid, timestamptz, text, text)
from public, anon, authenticated;
revoke all on function public.admin_set_specialty_active(uuid, uuid, timestamptz, boolean)
from public, anon, authenticated;
revoke all on function public.admin_update_professional_center_specialties(
  uuid, uuid, timestamptz, uuid[], uuid[]
) from public, anon, authenticated;

grant execute on function public.admin_resolve_professional_by_document(uuid, text, text)
to authenticated;
grant execute on function public.admin_create_professional_with_center(
  uuid, text, text, text, text, text, text, text, integer
) to authenticated;
grant execute on function public.admin_link_professional_to_center(
  uuid, uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.admin_update_professional_center(
  uuid, uuid, timestamptz, text, integer
) to authenticated;
grant execute on function public.admin_set_professional_center_active(
  uuid, uuid, timestamptz, boolean
) to authenticated;
grant execute on function public.admin_create_specialty(uuid, text, text)
to authenticated;
grant execute on function public.admin_update_specialty(uuid, uuid, timestamptz, text, text)
to authenticated;
grant execute on function public.admin_set_specialty_active(uuid, uuid, timestamptz, boolean)
to authenticated;
grant execute on function public.admin_update_professional_center_specialties(
  uuid, uuid, timestamptz, uuid[], uuid[]
) to authenticated;

commit;
