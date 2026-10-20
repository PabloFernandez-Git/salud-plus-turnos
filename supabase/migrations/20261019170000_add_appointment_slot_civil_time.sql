-- Gate C C-R4: return PostgreSQL's civil booking coordinates with each slot.
-- Keep the input signature and authorization; changing RETURNS TABLE requires
-- dropping the prior function inside this migration transaction.
begin;

drop function public.staff_search_appointment_slots(uuid,uuid,uuid,date);

create function public.staff_search_appointment_slots(
  p_center_id uuid, p_professional_center_id uuid,
  p_specialty_id uuid, p_local_date date
)
returns table (
  starts_at timestamptz, ends_at timestamptz,
  local_date date, local_start_time text,
  local_end_date date, local_end_time text
)
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_timezone text;
begin
  if (select auth.uid()) is null or not private.has_active_center_role(
    p_center_id, array['ADMIN','RECEPTION']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'APPOINTMENT_ACCESS_DENIED';
  end if;
  if p_professional_center_id is null or p_specialty_id is null or p_local_date is null then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select center_record.timezone into v_timezone
  from public.centers as center_record where center_record.id = p_center_id;
  return query
  select candidate.starts_at, candidate.ends_at,
    (candidate.starts_at at time zone v_timezone)::date,
    pg_catalog.to_char(candidate.starts_at at time zone v_timezone, 'HH24:MI'),
    (candidate.ends_at at time zone v_timezone)::date,
    pg_catalog.to_char(candidate.ends_at at time zone v_timezone, 'HH24:MI')
  from private.appointment_slot_candidates(
    p_center_id, p_professional_center_id, p_specialty_id, p_local_date
  ) as candidate
  where (candidate.starts_at at time zone v_timezone)::date = p_local_date;
end;
$function$;

revoke all on function public.staff_search_appointment_slots(uuid,uuid,uuid,date)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_search_appointment_slots(uuid,uuid,uuid,date)
  to authenticated;

commit;
