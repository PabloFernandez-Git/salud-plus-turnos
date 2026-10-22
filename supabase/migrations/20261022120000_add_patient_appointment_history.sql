begin;

-- Keep the existing index until the new access path is verified against DEV plans.
-- Both directions of (starts_at, id) support deterministic keyset pagination.
create index appointments_patient_center_starts_at_id_idx
  on public.appointments (patient_center_id, starts_at, id);

-- A PatientCenter-specific read is intentionally separate from the bounded
-- calendar list. The table itself remains inaccessible to authenticated users.
create function public.staff_list_patient_appointments(
  p_center_id uuid, p_patient_center_id uuid, p_section text,
  p_as_of timestamptz,
  p_cursor_starts_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  appointment_id uuid, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status,
  professional_first_name text, professional_last_name text,
  specialty_name text, has_more boolean
)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  -- SECURITY DEFINER bypasses table RLS as the function owner. This check must
  -- precede input-specific reads so unauthorized callers cannot probe patients.
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;

  if p_patient_center_id is null or p_section is null
    or p_section not in ('UPCOMING', 'HISTORY')
    or p_as_of is null or not pg_catalog.isfinite(p_as_of)
    or p_limit is null or p_limit < 1 or p_limit > 50
    or ((p_cursor_starts_at is null) <> (p_cursor_id is null))
    or (p_cursor_starts_at is not null
      and not pg_catalog.isfinite(p_cursor_starts_at)) then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  -- Nonexistent and foreign PatientCenter IDs have the same empty result.
  -- Inactive patients remain readable so historical turns are not lost.
  if not exists (
    select 1 from public.patient_centers as patient_center
    where patient_center.id = p_patient_center_id
      and patient_center.center_id = p_center_id
  ) then
    return;
  end if;

  if p_section = 'UPCOMING' then
    return query
    with page as materialized (
      select appointment.id, appointment.starts_at, appointment.ends_at,
        appointment.status, appointment.professional_center_id,
        appointment.specialty_id, appointment.center_id
      from public.appointments as appointment
      where appointment.center_id = p_center_id
        and appointment.patient_center_id = p_patient_center_id
        and appointment.starts_at >= p_as_of
        and appointment.status in ('PENDING', 'CONFIRMED')
        and (p_cursor_starts_at is null
          or (appointment.starts_at, appointment.id)
            > (p_cursor_starts_at, p_cursor_id))
      order by appointment.starts_at, appointment.id
      limit p_limit + 1
    ), joined as (
      select page.id, page.starts_at, page.ends_at, page.status,
        professional.first_name as professional_first_name,
        professional.last_name as professional_last_name,
        specialty.name as specialty_name
      from page
      join public.professional_centers as pc
        on pc.id = page.professional_center_id and pc.center_id = page.center_id
      join public.professionals as professional on professional.id = pc.professional_id
      join public.professional_center_specialties as assignment
        on assignment.professional_center_id = pc.id
        and assignment.specialty_id = page.specialty_id
        and assignment.center_id = page.center_id
      join public.specialties as specialty
        on specialty.id = assignment.specialty_id
        and specialty.center_id = page.center_id
    ), numbered as (
      select joined.*,
        pg_catalog.row_number() over (order by joined.starts_at, joined.id) as n,
        pg_catalog.count(*) over () as total
      from joined
    )
    select numbered.id, numbered.starts_at, numbered.ends_at,
      numbered.status, numbered.professional_first_name,
      numbered.professional_last_name, numbered.specialty_name,
      numbered.total > p_limit
    from numbered where numbered.n <= p_limit
    order by numbered.n;
  else
    return query
    with page as materialized (
      select appointment.id, appointment.starts_at, appointment.ends_at,
        appointment.status, appointment.professional_center_id,
        appointment.specialty_id, appointment.center_id
      from public.appointments as appointment
      where appointment.center_id = p_center_id
        and appointment.patient_center_id = p_patient_center_id
        and (appointment.starts_at < p_as_of
          or appointment.status not in ('PENDING', 'CONFIRMED'))
        and (p_cursor_starts_at is null
          or (appointment.starts_at, appointment.id)
            < (p_cursor_starts_at, p_cursor_id))
      order by appointment.starts_at desc, appointment.id desc
      limit p_limit + 1
    ), joined as (
      select page.id, page.starts_at, page.ends_at, page.status,
        professional.first_name as professional_first_name,
        professional.last_name as professional_last_name,
        specialty.name as specialty_name
      from page
      join public.professional_centers as pc
        on pc.id = page.professional_center_id and pc.center_id = page.center_id
      join public.professionals as professional on professional.id = pc.professional_id
      join public.professional_center_specialties as assignment
        on assignment.professional_center_id = pc.id
        and assignment.specialty_id = page.specialty_id
        and assignment.center_id = page.center_id
      join public.specialties as specialty
        on specialty.id = assignment.specialty_id
        and specialty.center_id = page.center_id
    ), numbered as (
      select joined.*,
        pg_catalog.row_number() over (order by joined.starts_at desc, joined.id desc) as n,
        pg_catalog.count(*) over () as total
      from joined
    )
    select numbered.id, numbered.starts_at, numbered.ends_at,
      numbered.status, numbered.professional_first_name,
      numbered.professional_last_name, numbered.specialty_name,
      numbered.total > p_limit
    from numbered where numbered.n <= p_limit
    order by numbered.n;
  end if;
end;
$function$;

revoke all on function public.staff_list_patient_appointments(
  uuid,uuid,text,timestamptz,timestamptz,uuid,integer
) from public, anon, authenticated, service_role;
grant execute on function public.staff_list_patient_appointments(
  uuid,uuid,text,timestamptz,timestamptz,uuid,integer
) to authenticated;

commit;
