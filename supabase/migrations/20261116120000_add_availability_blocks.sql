begin;

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null,
  professional_center_id uuid not null,
  start_date date not null,
  end_date date not null,
  reason text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_blocks_professional_center_fk
    foreign key (professional_center_id, center_id)
    references public.professional_centers (id, center_id)
    on update restrict on delete restrict,
  constraint availability_blocks_dates_check check (
    isfinite(start_date) and isfinite(end_date) and start_date <= end_date
  ),
  constraint availability_blocks_reason_check
    check (reason in ('VACATION', 'ABSENCE', 'HOLIDAY', 'OTHER')),
  constraint availability_blocks_no_active_overlap
    exclude using gist (
      professional_center_id with =,
      daterange(start_date, end_date, '[]') with &&
    ) where (is_active)
);

create index availability_blocks_center_dates_idx
  on public.availability_blocks (center_id, start_date, end_date)
  where is_active;

create trigger availability_blocks_set_updated_at
before update on public.availability_blocks
for each row execute function private.set_task006_cas_updated_at();

alter table public.availability_blocks enable row level security;
create policy availability_blocks_select_active_tenant on public.availability_blocks
for select to authenticated using (
  is_active and private.can_view_active_availability(center_id, professional_center_id)
);
revoke all on public.availability_blocks from public, anon, authenticated, service_role;
grant select on public.availability_blocks to authenticated;

-- Acquired after the shared Center lock and before any booking row locks.
-- Shared booking locks allow parallel reservations; a block writer waits for all
-- reservations for this ProfessionalCenter before counting affected appointments.
create or replace function private.appointment_lock_booking_entities(
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
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended(
      'salud-plus:availability-block:' || p_professional_center_id::text, 0
    )
  );
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

-- This gate is shared by slot search and booking validation. Booking reaches it
-- while holding the ProfessionalCenter advisory lock acquired above.
create or replace function private.appointment_slot_grid(
  p_center_id uuid, p_professional_center_id uuid, p_specialty_id uuid,
  p_local_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security invoker set search_path = ''
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
  if exists (
    select 1 from public.availability_blocks as block
    where block.center_id = p_center_id
      and block.professional_center_id = p_professional_center_id
      and block.is_active
      and p_local_date between block.start_date and block.end_date
  ) then
    return;
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

alter function private.appointment_slot_candidates(uuid,uuid,uuid,date) volatile;
alter function public.staff_search_appointment_slots(uuid,uuid,uuid,date) volatile;

create function private.count_affected_block_appointments(
  p_center_id uuid, p_professional_center_id uuid,
  p_start_date date, p_end_date date
)
returns integer language sql volatile security definer set search_path = ''
as $function$
  select count(*)::integer
  from public.appointments as appointment
  join public.centers as center_record on center_record.id = appointment.center_id
  where appointment.center_id = p_center_id
    and appointment.professional_center_id = p_professional_center_id
    and appointment.status <> 'CANCELLED'
    and (appointment.starts_at at time zone center_record.timezone)::date
      between p_start_date and p_end_date;
$function$;

create function public.staff_list_availability_blocks(
  p_center_id uuid, p_professional_center_id uuid default null,
  p_from_date date default null, p_to_date date default null
)
returns table (
  block_id uuid, professional_center_id uuid, start_date date, end_date date,
  reason text, updated_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_own_id uuid;
  v_staff boolean;
begin
  v_staff := private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  );
  v_own_id := private.active_professional_center_id(p_center_id);
  if (select auth.uid()) is null or not exists (
    select 1 from public.centers as center_record
    where center_record.id = p_center_id and center_record.is_active
  ) or not (v_staff or v_own_id is not null) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_ACCESS_DENIED';
  end if;
  if (p_from_date is null) <> (p_to_date is null)
    or (p_from_date is not null and (
      not isfinite(p_from_date) or not isfinite(p_to_date) or p_from_date > p_to_date
    )) then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_BLOCK';
  end if;
  return query
  select block.id, block.professional_center_id, block.start_date,
    block.end_date, block.reason, block.updated_at
  from public.availability_blocks as block
  join public.professional_centers as pc
    on pc.id = block.professional_center_id and pc.center_id = block.center_id
  where block.center_id = p_center_id and block.is_active and pc.is_active
    and (v_staff or block.professional_center_id = v_own_id)
    and (p_professional_center_id is null
      or block.professional_center_id = p_professional_center_id)
    and (p_from_date is null
      or (block.start_date <= p_to_date and block.end_date >= p_from_date))
  order by block.start_date, block.id;
end;
$function$;

create function public.staff_preview_availability_block(
  p_center_id uuid, p_professional_center_id uuid,
  p_start_date date, p_end_date date
)
returns integer language plpgsql stable security definer set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_start_date is null or p_end_date is null
    or not isfinite(p_start_date) or not isfinite(p_end_date)
    or p_start_date > p_end_date
    or p_professional_center_id is null then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_BLOCK';
  end if;
  if not exists (
    select 1 from public.professional_centers as pc
    where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  return private.count_affected_block_appointments(
    p_center_id, p_professional_center_id, p_start_date, p_end_date
  );
end;
$function$;

create function public.staff_create_availability_block(
  p_center_id uuid, p_professional_center_id uuid,
  p_start_date date, p_end_date date, p_reason text,
  p_expected_affected_count integer, p_confirm_affected boolean
)
returns table (block_id uuid, affected_count integer, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_count integer;
  v_row public.availability_blocks%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_start_date is null or p_end_date is null
    or not isfinite(p_start_date) or not isfinite(p_end_date)
    or p_start_date > p_end_date
    or p_reason is null or p_reason not in ('VACATION','ABSENCE','HOLIDAY','OTHER')
    or p_expected_affected_count is null or p_expected_affected_count < 0
    or p_confirm_affected is null then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_BLOCK';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'salud-plus:availability-block:' || p_professional_center_id::text, 0
    )
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  perform pc.id from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  v_count := private.count_affected_block_appointments(
    p_center_id, p_professional_center_id, p_start_date, p_end_date
  );
  if v_count <> p_expected_affected_count or (v_count > 0 and not p_confirm_affected) then
    raise exception using errcode = 'P0001', message = 'STALE_BLOCK_PREVIEW';
  end if;
  insert into public.availability_blocks (
    center_id, professional_center_id, start_date, end_date, reason
  ) values (
    p_center_id, p_professional_center_id, p_start_date, p_end_date, p_reason
  ) returning * into v_row;
  return query select v_row.id, v_count, v_row.updated_at;
end;
$function$;

-- CANCELLED changes the non-cancelled count used by block creation. Take the
-- Center lock exclusively before reading the appointment's ProfessionalCenter:
-- reschedule uses the shared Center lock, so the assignment cannot move while
-- the cancellation acquires the same ProfessionalCenter lock as the counter.
-- Both advisory locks precede the appointment row lock.
create or replace function public.staff_transition_appointment_status(
  p_center_id uuid, p_appointment_id uuid, p_expected_updated_at timestamptz,
  p_requested_status text
)
returns table (appointment_id uuid, status public.appointment_status, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_staff boolean;
  v_own_professional_center_id uuid;
  v_target_professional_center_id uuid;
  v_row public.appointments%rowtype;
  v_now timestamptz;
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
  if p_requested_status = 'CANCELLED' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
    );
  else
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
    );
  end if;
  v_staff := private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  );
  v_own_professional_center_id := private.active_professional_center_id(p_center_id);
  if not v_staff and v_own_professional_center_id is null then
    raise exception using errcode = '42501', message = 'ACCESS_DENIED';
  end if;
  if p_requested_status = 'CANCELLED' then
    select appointment.professional_center_id into v_target_professional_center_id
    from public.appointments as appointment
    where appointment.id = p_appointment_id and appointment.center_id = p_center_id
      and (v_staff or appointment.professional_center_id = v_own_professional_center_id);
    if not found then
      if v_staff then
        raise exception using errcode = 'P0002', message = 'APPOINTMENT_NOT_FOUND';
      end if;
      raise exception using errcode = '42501', message = 'ACCESS_DENIED';
    end if;
    perform pg_catalog.pg_advisory_xact_lock_shared(
      pg_catalog.hashtextextended(
        'salud-plus:availability-block:' || v_target_professional_center_id::text, 0
      )
    );
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
  v_now := pg_catalog.clock_timestamp();
  if (p_requested_status = 'CONFIRMED' and v_now >= v_row.starts_at)
    or (p_requested_status = 'ATTENDED' and v_now < v_row.starts_at)
    or (p_requested_status = 'NO_SHOW' and v_now < v_row.ends_at)
  then
    raise exception using errcode = 'P0001', message = 'APPOINTMENT_TIME_RESTRICTION';
  end if;
  update public.appointments as appointment
  set status = p_requested_status::public.appointment_status
  where appointment.id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.status, v_row.updated_at;
end;
$function$;

create function public.staff_deactivate_availability_block(
  p_center_id uuid, p_professional_center_id uuid,
  p_block_id uuid, p_expected_updated_at timestamptz
)
returns table (block_id uuid, updated_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_row public.availability_blocks%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_block_id is null or p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_BLOCK';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'salud-plus:availability-block:' || p_professional_center_id::text, 0
    )
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  select * into v_row from public.availability_blocks as block
  where block.id = p_block_id and block.center_id = p_center_id
    and block.professional_center_id = p_professional_center_id and block.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_AVAILABILITY_BLOCK';
  end if;
  update public.availability_blocks as block set is_active = false
  where block.id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.updated_at;
end;
$function$;

revoke all on function private.count_affected_block_appointments(uuid,uuid,date,date)
  from public, anon, authenticated, service_role;
revoke all on function public.staff_list_availability_blocks(uuid,uuid,date,date),
  public.staff_preview_availability_block(uuid,uuid,date,date),
  public.staff_create_availability_block(uuid,uuid,date,date,text,integer,boolean),
  public.staff_deactivate_availability_block(uuid,uuid,uuid,timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_list_availability_blocks(uuid,uuid,date,date),
  public.staff_preview_availability_block(uuid,uuid,date,date),
  public.staff_create_availability_block(uuid,uuid,date,date,text,integer,boolean),
  public.staff_deactivate_availability_block(uuid,uuid,uuid,timestamptz)
  to authenticated;

commit;
