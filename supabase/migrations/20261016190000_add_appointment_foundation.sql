begin;

-- A single monotonic CAS token covers every future Appointment mutation.
drop trigger appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_task006_cas_updated_at();

alter table public.appointments enable row level security;
revoke all on public.appointments from public, anon, authenticated;

-- Return only a Center-local, currently bookable context. Historical reads do not use it.
create function private.appointment_booking_context(
  p_center_id uuid, p_professional_center_id uuid, p_specialty_id uuid
)
returns table (timezone text, duration_minutes integer)
language plpgsql stable security invoker set search_path = ''
as $function$
begin
  return query
  select center_record.timezone, pc.usual_appointment_duration_minutes
  from public.centers as center_record
  join public.professional_centers as pc
    on pc.center_id = center_record.id and pc.id = p_professional_center_id
  join public.professional_center_specialties as assignment
    on assignment.center_id = center_record.id
    and assignment.professional_center_id = pc.id
    and assignment.specialty_id = p_specialty_id
  join public.specialties as specialty
    on specialty.id = assignment.specialty_id and specialty.center_id = center_record.id
  where center_record.id = p_center_id and center_record.is_active
    and pc.is_active and assignment.is_active and specialty.is_active;
end;
$function$;

-- 54 UTC hours at one-minute resolution, including the final endpoint: 3241 probes.
-- The returned offset set is materialized once by appointment_slot_candidates.
create function private.appointment_utc_offsets(p_timezone text, p_local_date date)
returns table (offset_seconds integer)
language plpgsql stable security invoker set search_path = ''
as $function$
declare
  v_offsets integer[];
  v_max_abs integer;
begin
  if p_timezone is null or p_local_date is null or not exists (
    select 1 from pg_catalog.pg_timezone_names as zone_record
    where zone_record.name = p_timezone
  ) then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;

  select pg_catalog.array_agg(discovered.offset_seconds order by discovered.offset_seconds)
  into v_offsets
  from (
    select distinct extract(epoch from (
      (sample.sample_at at time zone p_timezone)
      - (sample.sample_at at time zone 'UTC')
    ))::integer as offset_seconds
    from pg_catalog.generate_series(0, 3240) as probe(n)
    cross join lateral (
      select ((p_local_date::timestamp at time zone 'UTC') - interval '15 hours'
        + probe.n * interval '1 minute') as sample_at
    ) as sample
  ) as discovered;
  select pg_catalog.max(pg_catalog.abs(value)) into v_max_abs
  from pg_catalog.unnest(v_offsets) as value;
  if v_offsets is null or pg_catalog.cardinality(v_offsets) > 8
    or v_max_abs >= 54000 then
    raise exception using errcode = '22023', message = 'INVALID_TIMEZONE';
  end if;

  return query select value from pg_catalog.unnest(v_offsets) as value;
end;
$function$;

-- The same classifier is usable by future create/reschedule. A lone AT TIME ZONE
-- conversion would silently choose one side of an overlap and cannot be used here.
create function private.classify_appointment_local_time(
  p_local_time timestamp, p_timezone text, p_offsets integer[]
)
returns table (classification text, instant timestamptz)
language sql stable security invoker set search_path = ''
as $function$
  with possible as (
    select distinct (
      (p_local_time - pg_catalog.make_interval(secs => utc_offset)) at time zone 'UTC'
    ) as candidate
    from pg_catalog.unnest(p_offsets) as utc_offset
  ), valid as (
    select candidate from possible
    where candidate at time zone p_timezone = p_local_time
  )
  select case pg_catalog.count(*)
    when 0 then 'NONEXISTENT'::text
    when 1 then 'UNIQUE'::text
    else 'AMBIGUOUS'::text
  end,
  case when pg_catalog.count(*) = 1 then pg_catalog.min(candidate) else null end
  from valid;
$function$;

-- Grids start independently at each Availability interval. The offset array is
-- materialized once per Center timezone/local date and reused for both endpoints.
create function private.appointment_slot_candidates(
  p_center_id uuid, p_professional_center_id uuid, p_specialty_id uuid,
  p_local_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $function$
declare
  v_timezone text;
  v_minutes integer;
  v_candidate_count integer;
begin
  select context_record.timezone, context_record.duration_minutes
  into v_timezone, v_minutes
  from private.appointment_booking_context(
    p_center_id, p_professional_center_id, p_specialty_id
  ) as context_record;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPOINTMENT_CHOICE_NOT_AVAILABLE';
  end if;
  if p_local_date is null then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  if p_local_date < (pg_catalog.statement_timestamp() at time zone v_timezone)::date then
    raise exception using errcode = '22023', message = 'APPOINTMENT_IN_PAST';
  end if;

  select coalesce(pg_catalog.sum(
    pg_catalog.floor(
      extract(epoch from (availability.end_time - availability.start_time))
      / (v_minutes * 60)
    )::integer
  ), 0)
  into v_candidate_count
  from public.availabilities as availability
  where availability.center_id = p_center_id
    and availability.professional_center_id = p_professional_center_id
    and availability.is_active
    and availability.weekday = extract(isodow from p_local_date)::smallint;
  if v_candidate_count > 288 then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY';
  end if;

  return query
  with offsets as materialized (
    select pg_catalog.array_agg(offset_record.offset_seconds order by offset_record.offset_seconds) as values
    from private.appointment_utc_offsets(v_timezone, p_local_date) as offset_record
  ), civil as materialized (
    select p_local_date::timestamp
      + (availability.start_time - time '00:00')
      + slot_number.n * v_minutes * interval '1 minute' as local_start,
      p_local_date::timestamp
      + (availability.start_time - time '00:00')
      + (slot_number.n + 1) * v_minutes * interval '1 minute' as local_end
    from public.availabilities as availability
    cross join lateral pg_catalog.generate_series(
      0,
      pg_catalog.floor(
        extract(epoch from (availability.end_time - availability.start_time))
        / (v_minutes * 60)
      )::integer - 1
    ) as slot_number(n)
    where availability.center_id = p_center_id
      and availability.professional_center_id = p_professional_center_id
      and availability.is_active
      and availability.weekday = extract(isodow from p_local_date)::smallint
  )
  select start_class.instant, end_class.instant
  from civil
  cross join offsets
  cross join lateral private.classify_appointment_local_time(
    civil.local_start, v_timezone, offsets.values
  ) as start_class
  cross join lateral private.classify_appointment_local_time(
    civil.local_end, v_timezone, offsets.values
  ) as end_class
  where start_class.classification = 'UNIQUE'
    and end_class.classification = 'UNIQUE'
    and end_class.instant - start_class.instant = v_minutes * interval '1 minute'
    and start_class.instant >= pg_catalog.statement_timestamp()
    and not exists (
      select 1 from public.appointments as appointment
      where appointment.center_id = p_center_id
        and appointment.professional_center_id = p_professional_center_id
        and appointment.status in ('PENDING', 'CONFIRMED', 'ATTENDED', 'NO_SHOW')
        and pg_catalog.tstzrange(appointment.starts_at, appointment.ends_at, '[)')
          && pg_catalog.tstzrange(start_class.instant, end_class.instant, '[)')
    )
  order by start_class.instant;
end;
$function$;

create function public.staff_list_bookable_specialties(p_center_id uuid)
returns table (specialty_id uuid, specialty_name text)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  return query
  select distinct specialty.id, specialty.name
  from public.specialties as specialty
  join public.professional_center_specialties as assignment
    on assignment.specialty_id = specialty.id
    and assignment.center_id = specialty.center_id and assignment.is_active
  join public.professional_centers as pc
    on pc.id = assignment.professional_center_id
    and pc.center_id = specialty.center_id and pc.is_active
  where specialty.center_id = p_center_id and specialty.is_active
  order by specialty.name, specialty.id;
end;
$function$;

create function public.staff_bookable_professional_centers_for_specialty(
  p_center_id uuid, p_specialty_id uuid
)
returns table (
  professional_center_id uuid, professional_first_name text,
  professional_last_name text, usual_appointment_duration_minutes integer
)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  return query
  select pc.id, professional.first_name, professional.last_name,
    pc.usual_appointment_duration_minutes
  from public.professional_centers as pc
  join public.professional_center_specialties as assignment
    on assignment.professional_center_id = pc.id
    and assignment.center_id = pc.center_id and assignment.is_active
  join public.specialties as specialty
    on specialty.id = assignment.specialty_id
    and specialty.center_id = pc.center_id and specialty.is_active
  join public.professionals as professional on professional.id = pc.professional_id
  where pc.center_id = p_center_id and pc.is_active
    and specialty.id = p_specialty_id
  order by professional.last_name, professional.first_name, pc.id;
end;
$function$;

create function public.staff_search_appointment_slots(
  p_center_id uuid, p_professional_center_id uuid,
  p_specialty_id uuid, p_local_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  if p_professional_center_id is null or p_specialty_id is null or p_local_date is null then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  return query select candidate.starts_at, candidate.ends_at
  from private.appointment_slot_candidates(
    p_center_id, p_professional_center_id, p_specialty_id, p_local_date
  ) as candidate;
end;
$function$;

-- A 31-day inclusive local date range and hard SQL page cap bound each list call.
create function public.staff_list_appointments(
  p_center_id uuid, p_from_date date, p_to_date date,
  p_status public.appointment_status default null,
  p_professional_center_id uuid default null,
  p_cursor_starts_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns table (
  appointment_id uuid, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, updated_at timestamptz,
  patient_first_name text, patient_last_name text,
  professional_first_name text, professional_last_name text,
  professional_center_id uuid, specialty_name text, has_more boolean
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_lower_utc timestamptz;
  v_upper_utc timestamptz;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  if p_from_date is null or p_to_date is null
    or p_to_date < p_from_date or p_to_date - p_from_date > 30
    or p_limit is null or p_limit < 1 or p_limit > 50
    or ((p_cursor_starts_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select center_record.timezone into v_timezone
  from public.centers as center_record
  where center_record.id = p_center_id and center_record.is_active;
  -- All validated IANA offsets are strictly within 15 hours of UTC. These
  -- conservative instants bound the index scan; the local date remains exact.
  v_lower_utc := (p_from_date::timestamp at time zone 'UTC') - interval '15 hours';
  v_upper_utc := ((p_to_date::timestamp + interval '1 day') at time zone 'UTC')
    + interval '15 hours';
  return query
  with page as materialized (
    select appointment.id, appointment.starts_at, appointment.ends_at,
      appointment.status, appointment.updated_at,
      person.first_name as patient_first_name, person.last_name as patient_last_name,
      professional.first_name as professional_first_name,
      professional.last_name as professional_last_name,
      appointment.professional_center_id, specialty.name as specialty_name
    from public.appointments as appointment
    join public.patient_centers as patient_center
      on patient_center.id = appointment.patient_center_id
      and patient_center.center_id = appointment.center_id
    join public.persons as person on person.id = patient_center.person_id
    join public.professional_centers as pc
      on pc.id = appointment.professional_center_id
      and pc.center_id = appointment.center_id
    join public.professionals as professional on professional.id = pc.professional_id
    join public.professional_center_specialties as assignment
      on assignment.professional_center_id = pc.id
      and assignment.specialty_id = appointment.specialty_id
      and assignment.center_id = appointment.center_id
    join public.specialties as specialty
      on specialty.id = assignment.specialty_id
      and specialty.center_id = appointment.center_id
    where appointment.center_id = p_center_id
      and appointment.starts_at >= v_lower_utc
      and appointment.starts_at < v_upper_utc
      and (appointment.starts_at at time zone v_timezone)::date
        between p_from_date and p_to_date
      and (p_status is null or appointment.status = p_status)
      and (p_professional_center_id is null
        or appointment.professional_center_id = p_professional_center_id)
      and (p_cursor_starts_at is null
        or (appointment.starts_at, appointment.id) > (p_cursor_starts_at, p_cursor_id))
    order by appointment.starts_at, appointment.id
    limit p_limit + 1
  ), numbered as (
    select page.*, pg_catalog.row_number() over (order by page.starts_at, page.id) as n,
      pg_catalog.count(*) over () as total from page
  )
  select numbered.id, numbered.starts_at, numbered.ends_at,
    numbered.status, numbered.updated_at,
    numbered.patient_first_name, numbered.patient_last_name,
    numbered.professional_first_name, numbered.professional_last_name,
    numbered.professional_center_id, numbered.specialty_name,
    numbered.total > p_limit
  from numbered where numbered.n <= p_limit
  order by numbered.n;
end;
$function$;

create function public.staff_get_appointment(p_center_id uuid, p_appointment_id uuid)
returns table (
  appointment_id uuid, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, updated_at timestamptz,
  patient_first_name text, patient_last_name text,
  professional_first_name text, professional_last_name text,
  professional_center_id uuid, specialty_name text,
  patient_center_id uuid, specialty_id uuid, administrative_note text
)
language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  return query
  select appointment.id, appointment.starts_at, appointment.ends_at,
    appointment.status, appointment.updated_at,
    person.first_name, person.last_name,
    professional.first_name, professional.last_name,
    appointment.professional_center_id, specialty.name,
    appointment.patient_center_id, appointment.specialty_id,
    appointment.administrative_note
  from public.appointments as appointment
  join public.patient_centers as patient_center
    on patient_center.id = appointment.patient_center_id
    and patient_center.center_id = appointment.center_id
  join public.persons as person on person.id = patient_center.person_id
  join public.professional_centers as pc
    on pc.id = appointment.professional_center_id
    and pc.center_id = appointment.center_id
  join public.professionals as professional on professional.id = pc.professional_id
  join public.professional_center_specialties as assignment
    on assignment.professional_center_id = pc.id
    and assignment.specialty_id = appointment.specialty_id
    and assignment.center_id = appointment.center_id
  join public.specialties as specialty
    on specialty.id = assignment.specialty_id
    and specialty.center_id = appointment.center_id
  where appointment.center_id = p_center_id and appointment.id = p_appointment_id;
end;
$function$;

create function public.professional_list_own_appointments(
  p_center_id uuid, p_from_date date, p_to_date date,
  p_status public.appointment_status default null,
  p_cursor_starts_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 30
)
returns table (
  appointment_id uuid, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, updated_at timestamptz,
  specialty_name text, patient_first_name text, patient_last_name text,
  has_more boolean
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_professional_center_id uuid;
  v_lower_utc timestamptz;
  v_upper_utc timestamptz;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['PROFESSIONAL']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  v_professional_center_id := private.active_professional_center_id(p_center_id);
  if v_professional_center_id is null then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  if p_from_date is null or p_to_date is null
    or p_to_date < p_from_date or p_to_date - p_from_date > 30
    or p_limit is null or p_limit < 1 or p_limit > 50
    or ((p_cursor_starts_at is null) <> (p_cursor_id is null)) then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select center_record.timezone into v_timezone
  from public.centers as center_record where center_record.id = p_center_id;
  v_lower_utc := (p_from_date::timestamp at time zone 'UTC') - interval '15 hours';
  v_upper_utc := ((p_to_date::timestamp + interval '1 day') at time zone 'UTC')
    + interval '15 hours';
  return query
  with page as materialized (
    select appointment.id, appointment.starts_at, appointment.ends_at,
      appointment.status, appointment.updated_at,
      specialty.name as specialty_name, person.first_name as patient_first_name,
      person.last_name as patient_last_name
    from public.appointments as appointment
    join public.patient_centers as patient_center
      on patient_center.id = appointment.patient_center_id
      and patient_center.center_id = appointment.center_id
    join public.persons as person on person.id = patient_center.person_id
    join public.professional_center_specialties as assignment
      on assignment.professional_center_id = appointment.professional_center_id
      and assignment.specialty_id = appointment.specialty_id
      and assignment.center_id = appointment.center_id
    join public.specialties as specialty
      on specialty.id = assignment.specialty_id
      and specialty.center_id = appointment.center_id
    where appointment.center_id = p_center_id
      and appointment.professional_center_id = v_professional_center_id
      and appointment.starts_at >= v_lower_utc
      and appointment.starts_at < v_upper_utc
      and (appointment.starts_at at time zone v_timezone)::date
        between p_from_date and p_to_date
      and (p_status is null or appointment.status = p_status)
      and (p_cursor_starts_at is null
        or (appointment.starts_at, appointment.id) > (p_cursor_starts_at, p_cursor_id))
    order by appointment.starts_at, appointment.id
    limit p_limit + 1
  ), numbered as (
    select page.*, pg_catalog.row_number() over (order by page.starts_at, page.id) as n,
      pg_catalog.count(*) over () as total from page
  )
  select numbered.id, numbered.starts_at, numbered.ends_at,
    numbered.status, numbered.updated_at, numbered.specialty_name,
    numbered.patient_first_name, numbered.patient_last_name,
    numbered.total > p_limit
  from numbered where numbered.n <= p_limit
  order by numbered.n;
end;
$function$;

create function public.professional_get_own_appointment(
  p_center_id uuid, p_appointment_id uuid
)
returns table (
  appointment_id uuid, starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, updated_at timestamptz,
  specialty_name text, patient_first_name text, patient_last_name text
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_professional_center_id uuid;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['PROFESSIONAL']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  v_professional_center_id := private.active_professional_center_id(p_center_id);
  if v_professional_center_id is null then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  return query
  select appointment.id, appointment.starts_at, appointment.ends_at,
    appointment.status, appointment.updated_at,
    specialty.name, person.first_name, person.last_name
  from public.appointments as appointment
  join public.patient_centers as patient_center
    on patient_center.id = appointment.patient_center_id
    and patient_center.center_id = appointment.center_id
  join public.persons as person on person.id = patient_center.person_id
  join public.professional_center_specialties as assignment
    on assignment.professional_center_id = appointment.professional_center_id
    and assignment.specialty_id = appointment.specialty_id
    and assignment.center_id = appointment.center_id
  join public.specialties as specialty
    on specialty.id = assignment.specialty_id
    and specialty.center_id = appointment.center_id
  where appointment.center_id = p_center_id and appointment.id = p_appointment_id
    and appointment.professional_center_id = v_professional_center_id;
end;
$function$;

revoke all on function private.appointment_booking_context(uuid,uuid,uuid)
  from public, anon, authenticated;
revoke all on function private.appointment_utc_offsets(text,date)
  from public, anon, authenticated;
revoke all on function private.classify_appointment_local_time(timestamp,text,integer[])
  from public, anon, authenticated;
revoke all on function private.appointment_slot_candidates(uuid,uuid,uuid,date)
  from public, anon, authenticated;

revoke all on function public.staff_list_bookable_specialties(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.staff_bookable_professional_centers_for_specialty(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.staff_search_appointment_slots(uuid,uuid,uuid,date)
  from public, anon, authenticated, service_role;
revoke all on function public.staff_list_appointments(uuid,date,date,public.appointment_status,uuid,timestamptz,uuid,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.staff_get_appointment(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.professional_list_own_appointments(uuid,date,date,public.appointment_status,timestamptz,uuid,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.professional_get_own_appointment(uuid,uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.staff_list_bookable_specialties(uuid)
  to authenticated;
grant execute on function public.staff_bookable_professional_centers_for_specialty(uuid,uuid)
  to authenticated;
grant execute on function public.staff_search_appointment_slots(uuid,uuid,uuid,date)
  to authenticated;
grant execute on function public.staff_list_appointments(uuid,date,date,public.appointment_status,uuid,timestamptz,uuid,integer)
  to authenticated;
grant execute on function public.staff_get_appointment(uuid,uuid)
  to authenticated;
grant execute on function public.professional_list_own_appointments(uuid,date,date,public.appointment_status,timestamptz,uuid,integer)
  to authenticated;
grant execute on function public.professional_get_own_appointment(uuid,uuid)
  to authenticated;

commit;

