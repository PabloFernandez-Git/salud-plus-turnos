begin;

drop function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean
);

create function public.admin_set_center_membership(
  p_center_id uuid,
  p_membership_id uuid,
  p_role public.membership_role,
  p_professional_center_id uuid,
  p_is_active boolean,
  p_expected_role public.membership_role,
  p_expected_professional_center_id uuid,
  p_expected_is_active boolean
)
returns table (
  membership_id uuid,
  role public.membership_role,
  professional_center_id uuid,
  is_active boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_role public.membership_role;
  v_current_professional_center_id uuid;
  v_current_is_active boolean;
  v_is_pure_professional_deactivation boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  select
    membership.role,
    membership.professional_center_id,
    membership.is_active
  into
    v_current_role,
    v_current_professional_center_id,
    v_current_is_active
  from public.center_memberships as membership
  where membership.id = p_membership_id and membership.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Center membership not found.';
  end if;

  if v_current_role is distinct from p_expected_role
    or v_current_professional_center_id is distinct from p_expected_professional_center_id
    or v_current_is_active is distinct from p_expected_is_active
  then
    raise exception using errcode = 'P0001', message = 'STALE_MEMBERSHIP_STATE';
  end if;

  v_is_pure_professional_deactivation :=
    v_current_role = 'PROFESSIONAL'::public.membership_role
    and p_role = v_current_role
    and p_professional_center_id is not distinct from v_current_professional_center_id
    and not p_is_active;

  if p_role = 'PROFESSIONAL'::public.membership_role then
    if p_professional_center_id is null or not exists (
      select 1
      from public.professional_centers as professional_center
      where professional_center.id = p_professional_center_id
        and professional_center.center_id = p_center_id
        and (professional_center.is_active or v_is_pure_professional_deactivation)
    ) then
      raise exception using errcode = '23514', message = 'An active ProfessionalCenter in this center is required.';
    end if;

    if not v_is_pure_professional_deactivation and exists (
      select 1
      from public.center_memberships as membership
      where membership.professional_center_id = p_professional_center_id
        and membership.role = 'PROFESSIONAL'::public.membership_role
        and membership.is_active
        and membership.id <> p_membership_id
    ) then
      raise exception using errcode = '23505', message = 'The ProfessionalCenter already has an active PROFESSIONAL membership.';
    end if;
  elsif p_professional_center_id is not null then
    raise exception using errcode = '23514', message = 'Only PROFESSIONAL memberships may link a ProfessionalCenter.';
  end if;

  update public.center_memberships as membership
  set
    role = p_role,
    professional_center_id = p_professional_center_id,
    is_active = p_is_active
  where membership.id = p_membership_id;

  if not exists (
    select 1
    from public.center_memberships as membership
    where membership.center_id = p_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) then
    raise exception using errcode = '23514', message = 'The center must retain an active ADMIN.';
  end if;

  return query select p_membership_id, p_role, p_professional_center_id, p_is_active;
end;
$function$;

revoke all on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean,
  public.membership_role, uuid, boolean
) from public, anon, authenticated;

grant execute on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean,
  public.membership_role, uuid, boolean
) to authenticated;

commit;
