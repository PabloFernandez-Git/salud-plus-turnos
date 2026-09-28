begin;

do $migration$
begin
  if exists (
    select 1
    from public.center_memberships as membership
    where membership.role = 'PROFESSIONAL'::public.membership_role
      and membership.is_active
    group by membership.professional_center_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23514',
      message = 'Cannot enforce active ProfessionalCenter membership uniqueness: duplicate active PROFESSIONAL memberships exist.';
  end if;
end;
$migration$;

create unique index center_memberships_active_professional_center_key
  on public.center_memberships (professional_center_id)
  where role = 'PROFESSIONAL'::public.membership_role and is_active;

create or replace function public.admin_provision_center_user(
  p_operation_id uuid,
  p_center_id uuid,
  p_auth_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_role public.membership_role,
  p_professional_center_id uuid
)
returns table (
  user_id uuid,
  membership_id uuid,
  application_user_created boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
  v_auth_email text;
  v_actual_fingerprint text;
  v_membership_id uuid := pg_catalog.gen_random_uuid();
  v_application_user_created boolean := false;
  v_existing_membership_active boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if not found
    or v_operation.operation_type <> 'TENANT_PROVISION_USER'
    or v_operation.actor_user_id is distinct from auth.uid()
    or v_operation.scope_center_id is distinct from p_center_id
    or v_operation.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this tenant provisioning.';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = p_auth_user_id
    and auth_user.email is not null
    and pg_catalog.btrim(auth_user.email) <> '';

  if v_auth_email is null then
    raise exception using errcode = '23503', message = 'The Auth identity does not exist.';
  end if;

  v_actual_fingerprint := private.tenant_user_provisioning_fingerprint(
    auth.uid(),
    p_center_id,
    v_auth_email,
    p_first_name,
    p_last_name,
    p_role,
    p_professional_center_id
  );

  if v_operation.payload_hash <> v_actual_fingerprint then
    raise exception using errcode = '23514', message = 'The tenant provisioning arguments differ from the registered intent.';
  end if;

  if v_operation.status = 'SUCCEEDED' then
    return query select
      v_operation.result_user_id,
      v_operation.result_membership_id,
      v_operation.result_application_user_created;
    return;
  end if;

  if v_operation.status not in ('AUTH_READY', 'COMPENSATION_REQUIRED') then
    raise exception using errcode = '55000', message = 'The provisioning operation is not ready.';
  end if;

  if exists (
    select 1 from public.users as app_user
    where app_user.email = v_auth_email and app_user.id <> p_auth_user_id
  ) then
    raise exception using errcode = '23505', message = 'The Auth email conflicts with another user.';
  end if;

  if exists (select 1 from public.users as app_user where app_user.id = p_auth_user_id) then
    if exists (
      select 1 from public.users as app_user
      where app_user.id = p_auth_user_id and app_user.email <> v_auth_email
    ) then
      raise exception using errcode = '23514', message = 'The Auth email and user projection differ.';
    end if;
  else
    if p_first_name is null or pg_catalog.btrim(p_first_name) = ''
      or p_last_name is null or pg_catalog.btrim(p_last_name) = '' then
      raise exception using errcode = '22023', message = 'Names are required for a new user.';
    end if;
    insert into public.users (id, first_name, last_name, email)
    values (
      p_auth_user_id,
      pg_catalog.btrim(p_first_name),
      pg_catalog.btrim(p_last_name),
      v_auth_email
    );
    v_application_user_created := true;
  end if;

  select membership.is_active
  into v_existing_membership_active
  from public.center_memberships as membership
  where membership.center_id = p_center_id and membership.user_id = p_auth_user_id;

  if found then
    if v_existing_membership_active then
      raise exception using errcode = '23505', message = 'The user already has active center access.';
    end if;
    raise exception using errcode = '23505', message = 'The user has an inactive center membership.';
  end if;

  if p_role = 'PROFESSIONAL'::public.membership_role then
    if p_professional_center_id is null or not exists (
      select 1 from public.professional_centers as professional_center
      where professional_center.id = p_professional_center_id
        and professional_center.center_id = p_center_id
        and professional_center.is_active
    ) then
      raise exception using errcode = '23514', message = 'An active ProfessionalCenter in this center is required.';
    end if;

    if exists (
      select 1
      from public.center_memberships as membership
      where membership.professional_center_id = p_professional_center_id
        and membership.role = 'PROFESSIONAL'::public.membership_role
        and membership.is_active
    ) then
      raise exception using errcode = '23505', message = 'The ProfessionalCenter already has an active PROFESSIONAL membership.';
    end if;
  elsif p_professional_center_id is not null then
    raise exception using errcode = '23514', message = 'Only PROFESSIONAL memberships may link a ProfessionalCenter.';
  end if;

  insert into public.center_memberships (
    id, center_id, user_id, role, professional_center_id, is_active
  ) values (
    v_membership_id,
    p_center_id,
    p_auth_user_id,
    p_role,
    p_professional_center_id,
    true
  );

  if not exists (
    select 1 from public.center_memberships as membership
    where membership.center_id = p_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) then
    raise exception using errcode = '23514', message = 'The center must retain an active ADMIN.';
  end if;

  update private.provisioning_operations as operation
  set
    status = 'SUCCEEDED',
    result_user_id = p_auth_user_id,
    result_membership_id = v_membership_id,
    result_application_user_created = v_application_user_created,
    completed_at = pg_catalog.now()
  where operation.id = p_operation_id;

  return query select p_auth_user_id, v_membership_id, v_application_user_created;
end;
$function$;

create or replace function public.admin_set_center_membership(
  p_center_id uuid,
  p_membership_id uuid,
  p_role public.membership_role,
  p_professional_center_id uuid,
  p_is_active boolean
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
    membership.professional_center_id
  into
    v_current_role,
    v_current_professional_center_id
  from public.center_memberships as membership
  where membership.id = p_membership_id and membership.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Center membership not found.';
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

revoke all on function public.admin_provision_center_user(
  uuid, uuid, uuid, text, text, public.membership_role, uuid
) from public, anon, authenticated;
revoke all on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean
) from public, anon, authenticated;

grant execute on function public.admin_provision_center_user(
  uuid, uuid, uuid, text, text, public.membership_role, uuid
) to authenticated;
grant execute on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean
) to authenticated;

commit;
