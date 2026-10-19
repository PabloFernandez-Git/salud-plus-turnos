begin;

-- One civil-time grid serves search and both booking mutations. The installed
-- four-argument candidate helper keeps its public search contract below.
create function private.appointment_slot_grid(
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
  order by start_class.instant;
end;
$function$;

create or replace function private.appointment_slot_candidates(
  p_center_id uuid, p_professional_center_id uuid, p_specialty_id uuid,
  p_local_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $function$
begin
  return query
  select grid.starts_at, grid.ends_at
  from private.appointment_slot_grid(
    p_center_id, p_professional_center_id, p_specialty_id, p_local_date
  ) as grid
  where grid.starts_at >= pg_catalog.statement_timestamp()
    and not exists (
      select 1 from public.appointments as appointment
      where appointment.center_id = p_center_id
        and appointment.professional_center_id = p_professional_center_id
        and appointment.status in ('PENDING', 'CONFIRMED', 'ATTENDED', 'NO_SHOW')
        and pg_catalog.tstzrange(appointment.starts_at, appointment.ends_at, '[)')
          && pg_catalog.tstzrange(grid.starts_at, grid.ends_at, '[)')
    )
  order by grid.starts_at;
end;
$function$;

-- Call only after the shared Center advisory lock and renewed tenant check.
-- The order matches existing patient/PC/specialty/availability mutations.
create function private.appointment_lock_booking_entities(
  p_center_id uuid, p_patient_center_id uuid, p_professional_center_id uuid,
  p_specialty_id uuid, p_local_date date
)
returns table (timezone text, duration_minutes integer)
language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  v_timezone text;
  v_duration integer;
begin
  perform patient_center.id from public.patient_centers as patient_center
  where patient_center.id = p_patient_center_id
    and patient_center.center_id = p_center_id and patient_center.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'PATIENT_NOT_AVAILABLE';
  end if;

  select pc.usual_appointment_duration_minutes into v_duration
  from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'PROFESSIONAL_NOT_AVAILABLE';
  end if;

  perform specialty.id from public.specialties as specialty
  where specialty.id = p_specialty_id and specialty.center_id = p_center_id
    and specialty.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'SPECIALTY_NOT_AVAILABLE';
  end if;

  perform assignment.specialty_id
  from public.professional_center_specialties as assignment
  where assignment.center_id = p_center_id
    and assignment.professional_center_id = p_professional_center_id
    and assignment.specialty_id = p_specialty_id and assignment.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'SPECIALTY_NOT_ASSIGNED';
  end if;

  perform availability.id from public.availabilities as availability
  where availability.center_id = p_center_id
    and availability.professional_center_id = p_professional_center_id
    and availability.weekday = extract(isodow from p_local_date)::smallint
    and availability.is_active
  order by availability.id for share;

  select center_record.timezone into v_timezone
  from public.centers as center_record
  where center_record.id = p_center_id and center_record.is_active;
  return query select v_timezone, v_duration;
end;
$function$;

-- The DB limit also protects future privileged writers of this column.
alter table public.appointments add constraint appointments_administrative_note_length_check
  check (administrative_note is null or pg_catalog.char_length(administrative_note) <= 2000);

create function private.appointment_resolve_requested_slot(
  p_center_id uuid, p_professional_center_id uuid, p_specialty_id uuid,
  p_local_date date, p_local_start_time time, p_timezone text,
  p_exclude_appointment_id uuid
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security invoker set search_path = ''
as $function$
declare
  v_offsets integer[];
  v_classification text;
  v_start timestamptz;
  v_end timestamptz;
begin
  select pg_catalog.array_agg(offset_record.offset_seconds order by offset_record.offset_seconds)
  into v_offsets
  from private.appointment_utc_offsets(p_timezone, p_local_date) as offset_record;
  select classified.classification, classified.instant
  into v_classification, v_start
  from private.classify_appointment_local_time(
    p_local_date::timestamp + (p_local_start_time - time '00:00'),
    p_timezone, v_offsets
  ) as classified;
  if v_classification = 'NONEXISTENT' then
    raise exception using errcode = '22023', message = 'INVALID_LOCAL_TIME';
  elsif v_classification = 'AMBIGUOUS' then
    raise exception using errcode = '22023', message = 'AMBIGUOUS_LOCAL_TIME';
  end if;
  if v_start < pg_catalog.clock_timestamp() then
    raise exception using errcode = '22023', message = 'APPOINTMENT_IN_PAST';
  end if;

  select grid.ends_at into v_end
  from private.appointment_slot_grid(
    p_center_id, p_professional_center_id, p_specialty_id, p_local_date
  ) as grid
  where grid.starts_at = v_start;
  if not found then
    raise exception using errcode = '22023', message = 'OUTSIDE_AVAILABILITY';
  end if;
  if exists (
    select 1 from public.appointments as appointment
    where appointment.center_id = p_center_id
      and appointment.professional_center_id = p_professional_center_id
      and appointment.id is distinct from p_exclude_appointment_id
      and appointment.status in ('PENDING', 'CONFIRMED', 'ATTENDED', 'NO_SHOW')
      and pg_catalog.tstzrange(appointment.starts_at, appointment.ends_at, '[)')
        && pg_catalog.tstzrange(v_start, v_end, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'SLOT_ALREADY_TAKEN';
  end if;
  return query select v_start, v_end;
end;
$function$;

create function public.staff_create_appointment(
  p_center_id uuid, p_patient_center_id uuid, p_professional_center_id uuid,
  p_specialty_id uuid, p_local_date date, p_local_start_time time,
  p_administrative_note text default null
)
returns table (appointment_id uuid, status public.appointment_status, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_timezone text;
  v_duration integer;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.appointments%rowtype;
  v_constraint text;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if p_patient_center_id is null or p_professional_center_id is null
    or p_specialty_id is null or p_local_date is null or p_local_start_time is null
    or p_local_start_time >= time '24:00'
    or extract(second from p_local_start_time) <> 0
    or (p_administrative_note is not null
      and pg_catalog.char_length(p_administrative_note) > 2000)
  then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  select context_record.timezone, context_record.duration_minutes
  into v_timezone, v_duration
  from private.appointment_lock_booking_entities(
    p_center_id, p_patient_center_id, p_professional_center_id,
    p_specialty_id, p_local_date
  ) as context_record;
  if v_duration is null or v_duration < 5 or v_duration > 480
    or v_duration % 5 <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select slot.starts_at, slot.ends_at into v_start, v_end
  from private.appointment_resolve_requested_slot(
    p_center_id, p_professional_center_id, p_specialty_id,
    p_local_date, p_local_start_time, v_timezone, null
  ) as slot;
  begin
    insert into public.appointments (
      center_id, patient_center_id, professional_center_id, specialty_id,
      starts_at, ends_at, status, administrative_note
    ) values (
      p_center_id, p_patient_center_id, p_professional_center_id, p_specialty_id,
      v_start, v_end, 'PENDING', p_administrative_note
    ) returning * into v_row;
  exception when exclusion_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'appointments_no_blocking_overlap' then
      raise exception using errcode = '23P01', message = 'SLOT_ALREADY_TAKEN';
    end if;
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end;
  return query select v_row.id, v_row.status, v_row.updated_at;
end;
$function$;

create function public.staff_reschedule_appointment(
  p_center_id uuid, p_appointment_id uuid, p_expected_updated_at timestamptz,
  p_professional_center_id uuid, p_specialty_id uuid,
  p_local_date date, p_local_start_time time
)
returns table (
  appointment_id uuid, professional_center_id uuid, specialty_id uuid,
  starts_at timestamptz, ends_at timestamptz,
  status public.appointment_status, updated_at timestamptz
)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_patient_center_id uuid;
  v_timezone text;
  v_duration integer;
  v_start timestamptz;
  v_end timestamptz;
  v_row public.appointments%rowtype;
  v_constraint text;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null
    or p_professional_center_id is null or p_specialty_id is null
    or p_local_date is null or p_local_start_time is null
    or p_local_start_time >= time '24:00'
    or extract(second from p_local_start_time) <> 0
  then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  select appointment.patient_center_id into v_patient_center_id
  from public.appointments as appointment
  where appointment.id = p_appointment_id and appointment.center_id = p_center_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPOINTMENT_NOT_FOUND';
  end if;
  select context_record.timezone, context_record.duration_minutes
  into v_timezone, v_duration
  from private.appointment_lock_booking_entities(
    p_center_id, v_patient_center_id, p_professional_center_id,
    p_specialty_id, p_local_date
  ) as context_record;
  if v_duration is null or v_duration < 5 or v_duration > 480
    or v_duration % 5 <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select * into v_row from public.appointments as appointment
  where appointment.id = p_appointment_id and appointment.center_id = p_center_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPOINTMENT_NOT_FOUND';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_APPOINTMENT_STATE';
  end if;
  if v_row.status not in ('PENDING', 'CONFIRMED') then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  select slot.starts_at, slot.ends_at into v_start, v_end
  from private.appointment_resolve_requested_slot(
    p_center_id, p_professional_center_id, p_specialty_id,
    p_local_date, p_local_start_time, v_timezone, p_appointment_id
  ) as slot;
  if v_row.professional_center_id is distinct from p_professional_center_id
    or v_row.specialty_id is distinct from p_specialty_id
    or v_row.starts_at is distinct from v_start
    or v_row.ends_at is distinct from v_end
  then
    begin
      update public.appointments as appointment
      set professional_center_id = p_professional_center_id,
        specialty_id = p_specialty_id, starts_at = v_start, ends_at = v_end
      where appointment.id = v_row.id returning * into v_row;
    exception when exclusion_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'appointments_no_blocking_overlap' then
        raise exception using errcode = '23P01', message = 'SLOT_ALREADY_TAKEN';
      end if;
      raise exception using errcode = '22023', message = 'INVALID_INPUT';
    end;
  end if;
  return query select v_row.id, v_row.professional_center_id, v_row.specialty_id,
    v_row.starts_at, v_row.ends_at, v_row.status, v_row.updated_at;
end;
$function$;

create function public.staff_transition_appointment_status(
  p_center_id uuid, p_appointment_id uuid, p_expected_updated_at timestamptz,
  p_requested_status text
)
returns table (appointment_id uuid, status public.appointment_status, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_staff boolean;
  v_own_professional_center_id uuid;
  v_row public.appointments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  v_staff := private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  );
  v_own_professional_center_id := private.active_professional_center_id(p_center_id);
  if not v_staff and v_own_professional_center_id is null then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null
    or p_requested_status is null then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  v_staff := private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  );
  v_own_professional_center_id := private.active_professional_center_id(p_center_id);
  if not v_staff and v_own_professional_center_id is null then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  select * into v_row from public.appointments as appointment
  where appointment.id = p_appointment_id and appointment.center_id = p_center_id
    and (v_staff or appointment.professional_center_id = v_own_professional_center_id)
  for update;
  if not found then
    if v_staff then
      raise exception using errcode = 'P0002', message = 'APPOINTMENT_NOT_FOUND';
    end if;
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_APPOINTMENT_STATE';
  end if;
  if v_row.status not in ('PENDING','CONFIRMED')
    or (p_requested_status = 'CONFIRMED' and v_row.status <> 'PENDING')
    or p_requested_status not in ('CONFIRMED','ATTENDED','NO_SHOW','CANCELLED')
    or (not v_staff and p_requested_status not in ('ATTENDED','NO_SHOW'))
  then
    raise exception using errcode = 'P0001', message = 'INVALID_STATUS_TRANSITION';
  end if;
  update public.appointments as appointment
  set status = p_requested_status::public.appointment_status
  where appointment.id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.status, v_row.updated_at;
end;
$function$;

create function public.staff_update_appointment_note(
  p_center_id uuid, p_appointment_id uuid, p_expected_updated_at timestamptz,
  p_administrative_note text
)
returns table (appointment_id uuid, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_row public.appointments%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if p_appointment_id is null or p_expected_updated_at is null
    or (p_administrative_note is not null
      and pg_catalog.char_length(p_administrative_note) > 2000)
  then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  select * into v_row from public.appointments as appointment
  where appointment.id = p_appointment_id and appointment.center_id = p_center_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'APPOINTMENT_NOT_FOUND';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_APPOINTMENT_STATE';
  end if;
  if v_row.administrative_note is distinct from p_administrative_note then
    update public.appointments as appointment
    set administrative_note = p_administrative_note
    where appointment.id = v_row.id returning * into v_row;
  end if;
  return query select v_row.id, v_row.updated_at;
end;
$function$;

revoke all on function private.appointment_slot_grid(uuid,uuid,uuid,date),
  private.appointment_lock_booking_entities(uuid,uuid,uuid,uuid,date),
  private.appointment_resolve_requested_slot(uuid,uuid,uuid,date,time,text,uuid)
from public, anon, authenticated, service_role;

revoke all on function public.staff_create_appointment(uuid,uuid,uuid,uuid,date,time,text),
  public.staff_reschedule_appointment(uuid,uuid,timestamptz,uuid,uuid,date,time),
  public.staff_transition_appointment_status(uuid,uuid,timestamptz,text),
  public.staff_update_appointment_note(uuid,uuid,timestamptz,text)
from public, anon, authenticated, service_role;

grant execute on function public.staff_create_appointment(uuid,uuid,uuid,uuid,date,time,text),
  public.staff_reschedule_appointment(uuid,uuid,timestamptz,uuid,uuid,date,time),
  public.staff_transition_appointment_status(uuid,uuid,timestamptz,text),
  public.staff_update_appointment_note(uuid,uuid,timestamptz,text)
to authenticated;

commit;
