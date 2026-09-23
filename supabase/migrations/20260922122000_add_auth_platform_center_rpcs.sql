begin;

create function public.platform_list_centers()
returns table (
  center_id uuid,
  name text,
  is_active boolean,
  address text,
  phone text,
  email text,
  created_at timestamptz,
  active_membership_count bigint,
  active_professional_center_count bigint,
  active_specialty_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform access denied.';
  end if;

  return query
  select
    center.id,
    center.name,
    center.is_active,
    center.address,
    center.phone,
    center.email,
    center.created_at,
    (
      select count(*)
      from public.center_memberships as membership
      where membership.center_id = center.id and membership.is_active
    ),
    (
      select count(*)
      from public.professional_centers as professional_center
      where professional_center.center_id = center.id and professional_center.is_active
    ),
    (
      select count(*)
      from public.specialties as specialty
      where specialty.center_id = center.id and specialty.is_active
    )
  from public.centers as center
  order by center.created_at, center.id;
end;
$function$;

create function public.platform_resolve_user_by_email(p_email text)
returns table (
  identity_exists boolean,
  user_id uuid,
  first_name text,
  last_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(p_email));
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform access denied.';
  end if;

  if v_email is null or v_email = '' then
    raise exception using errcode = '22023', message = 'A normalized email is required.';
  end if;

  return query
  select true, app_user.id, app_user.first_name, app_user.last_name, app_user.email
  from public.users as app_user
  where app_user.email = v_email;

  if not found then
    return query select false, null::uuid, null::text, null::text, null::text;
  end if;
end;
$function$;

create function public.admin_resolve_user_by_email(p_center_id uuid, p_email text)
returns table (
  identity_exists boolean,
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  center_membership_exists boolean,
  center_membership_is_active boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_email text := lower(btrim(p_email));
begin
  if not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  if v_email is null or v_email = '' then
    raise exception using errcode = '22023', message = 'A normalized email is required.';
  end if;

  return query
  select
    true,
    app_user.id,
    app_user.first_name,
    app_user.last_name,
    app_user.email,
    membership.id is not null,
    membership.is_active
  from public.users as app_user
  left join public.center_memberships as membership
    on membership.user_id = app_user.id
   and membership.center_id = p_center_id
  where app_user.email = v_email;

  if not found then
    return query
    select false, null::uuid, null::text, null::text, null::text, false, null::boolean;
  end if;
end;
$function$;

create function public.platform_create_center_with_admin(
  p_center_name text,
  p_center_phone text,
  p_center_email text,
  p_center_address text,
  p_center_timezone text,
  p_admin_auth_user_id uuid,
  p_admin_first_name text,
  p_admin_last_name text
)
returns table (
  center_id uuid,
  membership_id uuid,
  application_user_created boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_email text;
  v_center_id uuid := pg_catalog.gen_random_uuid();
  v_membership_id uuid := pg_catalog.gen_random_uuid();
  v_application_user_created boolean := false;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform access denied.';
  end if;

  select lower(btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = p_admin_auth_user_id
    and auth_user.email is not null
    and btrim(auth_user.email) <> '';

  if v_auth_email is null then
    raise exception using errcode = '23503', message = 'The Auth identity does not exist.';
  end if;

  if exists (
    select 1
    from public.users as app_user
    where app_user.email = v_auth_email and app_user.id <> p_admin_auth_user_id
  ) then
    raise exception using errcode = '23505', message = 'The Auth email conflicts with another user.';
  end if;

  if exists (select 1 from public.users as app_user where app_user.id = p_admin_auth_user_id) then
    if exists (
      select 1
      from public.users as app_user
      where app_user.id = p_admin_auth_user_id and app_user.email <> v_auth_email
    ) then
      raise exception using errcode = '23514', message = 'The Auth email and user projection differ.';
    end if;
  else
    if p_admin_first_name is null or btrim(p_admin_first_name) = ''
      or p_admin_last_name is null or btrim(p_admin_last_name) = '' then
      raise exception using errcode = '22023', message = 'Names are required for a new user.';
    end if;

    insert into public.users (id, first_name, last_name, email)
    values (
      p_admin_auth_user_id,
      btrim(p_admin_first_name),
      btrim(p_admin_last_name),
      v_auth_email
    );
    v_application_user_created := true;
  end if;

  if p_center_timezone is null
    or not exists (
      select 1
      from pg_catalog.pg_timezone_names() as timezone_name
      where timezone_name.name = p_center_timezone
    ) then
    raise exception using errcode = '22023', message = 'A valid IANA timezone is required.';
  end if;

  insert into public.centers (id, name, phone, email, address, timezone, is_active)
  values (
    v_center_id,
    btrim(p_center_name),
    nullif(btrim(p_center_phone), ''),
    nullif(btrim(p_center_email), ''),
    nullif(btrim(p_center_address), ''),
    p_center_timezone,
    true
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || v_center_id::text, 0)
  );

  insert into public.center_memberships (
    id,
    center_id,
    user_id,
    role,
    professional_center_id,
    is_active
  ) values (
    v_membership_id,
    v_center_id,
    p_admin_auth_user_id,
    'ADMIN'::public.membership_role,
    null,
    true
  );

  if (
    select count(*)
    from public.center_memberships as membership
    where membership.center_id = v_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) <> 1 then
    raise exception using errcode = '23514', message = 'A new center requires exactly one active ADMIN.';
  end if;

  return query select v_center_id, v_membership_id, v_application_user_created;
end;
$function$;

create function public.platform_set_center_active(p_center_id uuid, p_is_active boolean)
returns table (center_id uuid, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current_is_active boolean;
begin
  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform access denied.';
  end if;

  if p_is_active is null then
    raise exception using errcode = '22023', message = 'Center status is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  select center.is_active
  into v_current_is_active
  from public.centers as center
  where center.id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Center not found.';
  end if;

  if p_is_active and not exists (
    select 1
    from public.center_memberships as membership
    where membership.center_id = p_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) then
    raise exception using errcode = '23514', message = 'An active ADMIN is required to activate a center.';
  end if;

  if v_current_is_active is distinct from p_is_active then
    update public.centers as center
    set is_active = p_is_active
    where center.id = p_center_id;
  end if;

  return query select p_center_id, p_is_active;
end;
$function$;

create function public.admin_provision_center_user(
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
  v_auth_email text;
  v_membership_id uuid := pg_catalog.gen_random_uuid();
  v_application_user_created boolean := false;
  v_existing_membership_active boolean;
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

  select lower(btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = p_auth_user_id
    and auth_user.email is not null
    and btrim(auth_user.email) <> '';

  if v_auth_email is null then
    raise exception using errcode = '23503', message = 'The Auth identity does not exist.';
  end if;

  if exists (
    select 1
    from public.users as app_user
    where app_user.email = v_auth_email and app_user.id <> p_auth_user_id
  ) then
    raise exception using errcode = '23505', message = 'The Auth email conflicts with another user.';
  end if;

  if exists (select 1 from public.users as app_user where app_user.id = p_auth_user_id) then
    if exists (
      select 1
      from public.users as app_user
      where app_user.id = p_auth_user_id and app_user.email <> v_auth_email
    ) then
      raise exception using errcode = '23514', message = 'The Auth email and user projection differ.';
    end if;
  else
    if p_first_name is null or btrim(p_first_name) = ''
      or p_last_name is null or btrim(p_last_name) = '' then
      raise exception using errcode = '22023', message = 'Names are required for a new user.';
    end if;

    insert into public.users (id, first_name, last_name, email)
    values (p_auth_user_id, btrim(p_first_name), btrim(p_last_name), v_auth_email);
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
      select 1
      from public.professional_centers as professional_center
      where professional_center.id = p_professional_center_id
        and professional_center.center_id = p_center_id
        and professional_center.is_active
    ) then
      raise exception using errcode = '23514', message = 'An active ProfessionalCenter in this center is required.';
    end if;
  elsif p_professional_center_id is not null then
    raise exception using errcode = '23514', message = 'Only PROFESSIONAL memberships may link a ProfessionalCenter.';
  end if;

  insert into public.center_memberships (
    id,
    center_id,
    user_id,
    role,
    professional_center_id,
    is_active
  ) values (
    v_membership_id,
    p_center_id,
    p_auth_user_id,
    p_role,
    p_professional_center_id,
    true
  );

  if not exists (
    select 1
    from public.center_memberships as membership
    where membership.center_id = p_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) then
    raise exception using errcode = '23514', message = 'The center must retain an active ADMIN.';
  end if;

  return query select p_auth_user_id, v_membership_id, v_application_user_created;
end;
$function$;

create function public.admin_set_center_membership(
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
  v_target_user_id uuid;
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

  select membership.user_id
  into v_target_user_id
  from public.center_memberships as membership
  where membership.id = p_membership_id and membership.center_id = p_center_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Center membership not found.';
  end if;

  if p_role = 'PROFESSIONAL'::public.membership_role then
    if p_professional_center_id is null or not exists (
      select 1
      from public.professional_centers as professional_center
      where professional_center.id = p_professional_center_id
        and professional_center.center_id = p_center_id
        and professional_center.is_active
    ) then
      raise exception using errcode = '23514', message = 'An active ProfessionalCenter in this center is required.';
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

create function public.bootstrap_platform_admin(
  p_auth_user_id uuid,
  p_first_name text,
  p_last_name text
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:platform-bootstrap', 0)
  );

  if exists (select 1 from public.platform_admins)
    or exists (select 1 from public.users)
    or exists (select 1 from public.centers)
    or exists (select 1 from public.center_memberships) then
    raise exception using errcode = '23514', message = 'The platform is already initialized.';
  end if;

  select lower(btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = p_auth_user_id
    and auth_user.email is not null
    and btrim(auth_user.email) <> '';

  if v_auth_email is null then
    raise exception using errcode = '23503', message = 'The Auth identity does not exist.';
  end if;

  if p_first_name is null or btrim(p_first_name) = ''
    or p_last_name is null or btrim(p_last_name) = '' then
    raise exception using errcode = '22023', message = 'Names are required for the platform administrator.';
  end if;

  insert into public.users (id, first_name, last_name, email)
  values (p_auth_user_id, btrim(p_first_name), btrim(p_last_name), v_auth_email);

  insert into public.platform_admins (user_id)
  values (p_auth_user_id);

  return query select p_auth_user_id;
end;
$function$;

revoke all on function public.platform_list_centers() from public, anon, authenticated;
revoke all on function public.platform_resolve_user_by_email(text) from public, anon, authenticated;
revoke all on function public.admin_resolve_user_by_email(uuid, text) from public, anon, authenticated;
revoke all on function public.platform_create_center_with_admin(
  text, text, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.platform_set_center_active(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_provision_center_user(
  uuid, uuid, text, text, public.membership_role, uuid
) from public, anon, authenticated;
revoke all on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean
) from public, anon, authenticated;
revoke all on function public.bootstrap_platform_admin(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.platform_list_centers() to authenticated;
grant execute on function public.platform_resolve_user_by_email(text) to authenticated;
grant execute on function public.admin_resolve_user_by_email(uuid, text) to authenticated;
grant execute on function public.platform_create_center_with_admin(
  text, text, text, text, text, uuid, text, text
) to authenticated;
grant execute on function public.platform_set_center_active(uuid, boolean) to authenticated;
grant execute on function public.admin_provision_center_user(
  uuid, uuid, text, text, public.membership_role, uuid
) to authenticated;
grant execute on function public.admin_set_center_membership(
  uuid, uuid, public.membership_role, uuid, boolean
) to authenticated;
grant execute on function public.bootstrap_platform_admin(uuid, text, text) to service_role;

commit;
