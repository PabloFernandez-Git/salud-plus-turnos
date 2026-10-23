begin;

-- STABLE pins every internal read to the calling statement's MVCC snapshot.
-- Neither RPC accepts a caller-supplied clock, date, role or professional ID.
create function public.staff_get_daily_dashboard(p_center_id uuid)
returns table (
  as_of timestamptz, local_date date, timezone text,
  pending_count bigint, confirmed_count bigint, attended_count bigint,
  no_show_count bigint, cancelled_count bigint,
  professional_centers_with_appointments_count bigint, upcoming jsonb
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_as_of timestamptz := pg_catalog.statement_timestamp();
  v_timezone text;
  v_local_date date;
  v_lower_utc timestamptz;
  v_upper_utc timestamptz;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'DASHBOARD_ACCESS_DENIED';
  end if;

  select center_record.timezone into strict v_timezone
  from public.centers as center_record
  where center_record.id = p_center_id and center_record.is_active;
  v_local_date := (v_as_of at time zone v_timezone)::date;
  -- IANA UTC offsets are within 15 hours. The wide index bounds are followed
  -- by the exact civil-date predicate, including 23/25-hour and midnight days.
  v_lower_utc := (v_local_date::timestamp at time zone 'UTC') - interval '15 hours';
  v_upper_utc := ((v_local_date + 1)::timestamp at time zone 'UTC') + interval '15 hours';

  return query
  with day_appointments as materialized (
    select a.id, a.starts_at, a.ends_at, a.status,
      a.patient_center_id, a.professional_center_id, a.specialty_id
    from public.appointments as a
    where a.center_id = p_center_id
      and a.starts_at >= v_lower_utc and a.starts_at < v_upper_utc
      and (a.starts_at at time zone v_timezone)::date = v_local_date
  ), counts as (
    select
      count(*) filter (where d.status = 'PENDING') as pending_count,
      count(*) filter (where d.status = 'CONFIRMED') as confirmed_count,
      count(*) filter (where d.status = 'ATTENDED') as attended_count,
      count(*) filter (where d.status = 'NO_SHOW') as no_show_count,
      count(*) filter (where d.status = 'CANCELLED') as cancelled_count,
      count(distinct d.professional_center_id) filter (
        where d.status <> 'CANCELLED'
      ) as professional_centers_with_appointments_count
    from day_appointments as d
  ), next_five as (
    select d.* from day_appointments as d
    where d.status in ('PENDING', 'CONFIRMED') and d.starts_at >= v_as_of
    order by d.starts_at, d.id limit 5
  ), next_json as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'appointment_id', n.id, 'starts_at', n.starts_at,
      'ends_at', n.ends_at, 'status', n.status,
      'patient_first_name', person.first_name,
      'patient_last_name', person.last_name,
      'specialty_name', specialty.name,
      'professional_center_id', n.professional_center_id,
      'professional_first_name', professional.first_name,
      'professional_last_name', professional.last_name
    ) order by n.starts_at, n.id), '[]'::jsonb) as upcoming
    from next_five as n
    join public.patient_centers as patient_center
      on patient_center.id = n.patient_center_id and patient_center.center_id = p_center_id
    join public.persons as person on person.id = patient_center.person_id
    join public.professional_centers as pc
      on pc.id = n.professional_center_id and pc.center_id = p_center_id
    join public.professionals as professional on professional.id = pc.professional_id
    join public.professional_center_specialties as assignment
      on assignment.professional_center_id = n.professional_center_id
      and assignment.specialty_id = n.specialty_id and assignment.center_id = p_center_id
    join public.specialties as specialty
      on specialty.id = assignment.specialty_id and specialty.center_id = p_center_id
  )
  select v_as_of, v_local_date, v_timezone,
    c.pending_count, c.confirmed_count, c.attended_count,
    c.no_show_count, c.cancelled_count,
    c.professional_centers_with_appointments_count, j.upcoming
  from counts as c cross join next_json as j;
end;
$function$;

create function public.professional_get_own_daily_dashboard(p_center_id uuid)
returns table (
  as_of timestamptz, local_date date, timezone text,
  pending_count bigint, confirmed_count bigint, attended_count bigint,
  no_show_count bigint, cancelled_count bigint, upcoming jsonb
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_as_of timestamptz := pg_catalog.statement_timestamp();
  v_timezone text;
  v_local_date date;
  v_professional_center_id uuid;
  v_lower_utc timestamptz;
  v_upper_utc timestamptz;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['PROFESSIONAL']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'DASHBOARD_ACCESS_DENIED';
  end if;
  v_professional_center_id := private.active_professional_center_id(p_center_id);
  if v_professional_center_id is null then
    raise exception using errcode = '42501', message = 'DASHBOARD_ACCESS_DENIED';
  end if;

  select center_record.timezone into strict v_timezone
  from public.centers as center_record
  where center_record.id = p_center_id and center_record.is_active;
  v_local_date := (v_as_of at time zone v_timezone)::date;
  v_lower_utc := (v_local_date::timestamp at time zone 'UTC') - interval '15 hours';
  v_upper_utc := ((v_local_date + 1)::timestamp at time zone 'UTC') + interval '15 hours';

  return query
  with day_appointments as materialized (
    select a.id, a.starts_at, a.ends_at, a.status,
      a.patient_center_id, a.specialty_id
    from public.appointments as a
    where a.center_id = p_center_id
      and a.professional_center_id = v_professional_center_id
      and a.starts_at >= v_lower_utc and a.starts_at < v_upper_utc
      and (a.starts_at at time zone v_timezone)::date = v_local_date
  ), counts as (
    select
      count(*) filter (where d.status = 'PENDING') as pending_count,
      count(*) filter (where d.status = 'CONFIRMED') as confirmed_count,
      count(*) filter (where d.status = 'ATTENDED') as attended_count,
      count(*) filter (where d.status = 'NO_SHOW') as no_show_count,
      count(*) filter (where d.status = 'CANCELLED') as cancelled_count
    from day_appointments as d
  ), next_five as (
    select d.* from day_appointments as d
    where d.status in ('PENDING', 'CONFIRMED') and d.starts_at >= v_as_of
    order by d.starts_at, d.id limit 5
  ), next_json as (
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'appointment_id', n.id, 'starts_at', n.starts_at,
      'ends_at', n.ends_at, 'status', n.status,
      'patient_first_name', person.first_name,
      'patient_last_name', person.last_name,
      'specialty_name', specialty.name
    ) order by n.starts_at, n.id), '[]'::jsonb) as upcoming
    from next_five as n
    join public.patient_centers as patient_center
      on patient_center.id = n.patient_center_id and patient_center.center_id = p_center_id
    join public.persons as person on person.id = patient_center.person_id
    join public.professional_center_specialties as assignment
      on assignment.professional_center_id = v_professional_center_id
      and assignment.specialty_id = n.specialty_id and assignment.center_id = p_center_id
    join public.specialties as specialty
      on specialty.id = assignment.specialty_id and specialty.center_id = p_center_id
  )
  select v_as_of, v_local_date, v_timezone,
    c.pending_count, c.confirmed_count, c.attended_count,
    c.no_show_count, c.cancelled_count, j.upcoming
  from counts as c cross join next_json as j;
end;
$function$;

revoke all on function public.staff_get_daily_dashboard(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.professional_get_own_daily_dashboard(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_get_daily_dashboard(uuid) to authenticated;
grant execute on function public.professional_get_own_daily_dashboard(uuid) to authenticated;

commit;
