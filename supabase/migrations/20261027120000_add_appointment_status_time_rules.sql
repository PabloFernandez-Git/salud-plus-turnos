begin;

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
  -- Read the authoritative clock once after the row lock. Never accept client time.
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

commit;
