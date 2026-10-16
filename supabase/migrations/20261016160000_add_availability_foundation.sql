begin;

-- Availability tokens must advance even for two writes in one transaction.
drop trigger availabilities_set_updated_at on public.availabilities;
create trigger availabilities_set_updated_at
before update on public.availabilities
for each row execute function private.set_task006_cas_updated_at();

create function private.can_view_active_availability(
  p_center_id uuid,
  p_professional_center_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.professional_centers as pc
    where pc.id = p_professional_center_id
      and pc.center_id = p_center_id
      and pc.is_active
      and (
        private.has_active_center_role(
          p_center_id,
          array['ADMIN', 'RECEPTION']::public.membership_role[]
        )
        or pc.id = private.active_professional_center_id(p_center_id)
      )
  );
$function$;

revoke all on function private.can_view_active_availability(uuid, uuid)
from public, anon, authenticated;
grant execute on function private.can_view_active_availability(uuid, uuid) to authenticated;

create policy availabilities_select_active_tenant on public.availabilities
for select to authenticated
using (
  is_active
  and private.can_view_active_availability(center_id, professional_center_id)
);
grant select on public.availabilities to authenticated;

create function public.staff_list_availability_professional_centers(p_center_id uuid)
returns table (
  professional_center_id uuid,
  first_name text,
  last_name text,
  usual_appointment_duration_minutes integer,
  professional_center_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.centers as center_record
    where center_record.id = p_center_id and center_record.is_active
  ) or not (
    private.has_active_center_role(
      p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
    ) or private.active_professional_center_id(p_center_id) is not null
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_ACCESS_DENIED';
  end if;

  return query
  select pc.id, professional.first_name, professional.last_name,
    pc.usual_appointment_duration_minutes, pc.updated_at
  from public.professional_centers as pc
  join public.professionals as professional on professional.id = pc.professional_id
  where pc.center_id = p_center_id
    and pc.is_active
    and (
      private.has_active_center_role(
        p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
      ) or pc.id = private.active_professional_center_id(p_center_id)
    )
  order by professional.last_name, professional.first_name, pc.id;
end;
$function$;

-- Read-only, private warning. It never returns appointment identities or details.
create function private.has_future_appointments_outside_availability(
  p_center_id uuid,
  p_professional_center_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.appointments as appointment
    join public.centers as center_record on center_record.id = appointment.center_id
    where appointment.center_id = p_center_id
      and appointment.professional_center_id = p_professional_center_id
      and appointment.starts_at >= pg_catalog.now()
      and appointment.status in (
        'PENDING'::public.appointment_status,
        'CONFIRMED'::public.appointment_status,
        'ATTENDED'::public.appointment_status,
        'NO_SHOW'::public.appointment_status
      )
      and not exists (
        select 1
        from public.availabilities as availability
        where availability.center_id = appointment.center_id
          and availability.professional_center_id = appointment.professional_center_id
          and availability.is_active
          and availability.weekday = extract(
            isodow from appointment.starts_at at time zone center_record.timezone
          )::smallint
          and (appointment.starts_at at time zone center_record.timezone)::date =
            (appointment.ends_at at time zone center_record.timezone)::date
          and availability.start_time <=
            (appointment.starts_at at time zone center_record.timezone)::time
          and (appointment.ends_at at time zone center_record.timezone)::time <=
            availability.end_time
      )
  );
$function$;

revoke all on function private.has_future_appointments_outside_availability(uuid, uuid)
from public, anon, authenticated;

create function public.staff_create_availability(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_weekday smallint,
  p_start_time time without time zone,
  p_end_time time without time zone
)
returns table (
  availability_id uuid,
  weekday smallint,
  start_time time without time zone,
  end_time time without time zone,
  is_active boolean,
  updated_at timestamptz,
  has_future_outside_availability boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pc_id uuid;
  v_row public.availabilities%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_weekday is null or p_weekday not between 1 and 7
    or p_start_time is null or p_end_time is null
    or p_start_time >= p_end_time or p_end_time >= time '24:00'
    or extract(second from p_start_time) <> 0
    or extract(second from p_end_time) <> 0
  then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_INTERVAL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  select pc.id into v_pc_id
  from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;

  insert into public.availabilities (
    center_id, professional_center_id, weekday, start_time, end_time, is_active
  ) values (p_center_id, v_pc_id, p_weekday, p_start_time, p_end_time, true)
  returning * into v_row;

  return query select v_row.id, v_row.weekday, v_row.start_time, v_row.end_time,
    v_row.is_active, v_row.updated_at,
    private.has_future_appointments_outside_availability(p_center_id, v_pc_id);
end;
$function$;

create function public.staff_update_availability(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_availability_id uuid,
  p_expected_updated_at timestamptz,
  p_start_time time without time zone,
  p_end_time time without time zone
)
returns table (
  availability_id uuid,
  weekday smallint,
  start_time time without time zone,
  end_time time without time zone,
  is_active boolean,
  updated_at timestamptz,
  has_future_outside_availability boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pc_id uuid;
  v_row public.availabilities%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_availability_id is null
    or p_expected_updated_at is null or p_start_time is null or p_end_time is null
    or p_start_time >= p_end_time or p_end_time >= time '24:00'
    or extract(second from p_start_time) <> 0
    or extract(second from p_end_time) <> 0
  then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_INTERVAL';
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  select pc.id into v_pc_id from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  select * into v_row from public.availabilities as availability
  where availability.id = p_availability_id
    and availability.center_id = p_center_id
    and availability.professional_center_id = v_pc_id
    and availability.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_AVAILABILITY_STATE';
  end if;
  if v_row.start_time is distinct from p_start_time or v_row.end_time is distinct from p_end_time then
    update public.availabilities as availability
    set start_time = p_start_time, end_time = p_end_time
    where availability.id = v_row.id
    returning * into v_row;
  end if;
  return query select v_row.id, v_row.weekday, v_row.start_time, v_row.end_time,
    v_row.is_active, v_row.updated_at,
    private.has_future_appointments_outside_availability(p_center_id, v_pc_id);
end;
$function$;

create function public.staff_deactivate_availability(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_availability_id uuid,
  p_expected_updated_at timestamptz
)
returns table (
  availability_id uuid,
  weekday smallint,
  start_time time without time zone,
  end_time time without time zone,
  is_active boolean,
  updated_at timestamptz,
  has_future_outside_availability boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pc_id uuid;
  v_row public.availabilities%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_availability_id is null
    or p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'INVALID_AVAILABILITY_INPUT';
  end if;

  perform pg_catalog.pg_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  select pc.id into v_pc_id from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  select * into v_row from public.availabilities as availability
  where availability.id = p_availability_id
    and availability.center_id = p_center_id
    and availability.professional_center_id = v_pc_id
    and availability.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_AVAILABILITY_STATE';
  end if;
  update public.availabilities as availability set is_active = false
  where availability.id = v_row.id returning * into v_row;
  return query select v_row.id, v_row.weekday, v_row.start_time, v_row.end_time,
    v_row.is_active, v_row.updated_at,
    private.has_future_appointments_outside_availability(p_center_id, v_pc_id);
end;
$function$;

create function public.staff_update_usual_appointment_duration(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_updated_at timestamptz,
  p_minutes integer
)
returns table (
  professional_center_id uuid,
  usual_appointment_duration_minutes integer,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pc public.professional_centers%rowtype;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  if p_professional_center_id is null or p_expected_updated_at is null
    or p_minutes is null or p_minutes < 5 or p_minutes > 480 or p_minutes % 5 <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_APPOINTMENT_DURATION';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN', 'RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'AVAILABILITY_MUTATION_DENIED';
  end if;
  select * into v_pc from public.professional_centers as pc
  where pc.id = p_professional_center_id and pc.center_id = p_center_id and pc.is_active
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'RESOURCE_NOT_FOUND';
  end if;
  if v_pc.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_PROFESSIONAL_CENTER_STATE';
  end if;
  if v_pc.usual_appointment_duration_minutes is distinct from p_minutes then
    update public.professional_centers as pc
    set usual_appointment_duration_minutes = p_minutes
    where pc.id = v_pc.id returning * into v_pc;
  end if;
  return query select v_pc.id, v_pc.usual_appointment_duration_minutes, v_pc.updated_at;
end;
$function$;

revoke all on function public.staff_list_availability_professional_centers(uuid)
from public, anon, authenticated;
revoke all on function public.staff_create_availability(uuid, uuid, smallint, time, time)
from public, anon, authenticated;
revoke all on function public.staff_update_availability(uuid, uuid, uuid, timestamptz, time, time)
from public, anon, authenticated;
revoke all on function public.staff_deactivate_availability(uuid, uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.staff_update_usual_appointment_duration(uuid, uuid, timestamptz, integer)
from public, anon, authenticated;

grant execute on function public.staff_list_availability_professional_centers(uuid) to authenticated;
grant execute on function public.staff_create_availability(uuid, uuid, smallint, time, time)
to authenticated;
grant execute on function public.staff_update_availability(uuid, uuid, uuid, timestamptz, time, time)
to authenticated;
grant execute on function public.staff_deactivate_availability(uuid, uuid, uuid, timestamptz)
to authenticated;
grant execute on function public.staff_update_usual_appointment_duration(uuid, uuid, timestamptz, integer)
to authenticated;

commit;
