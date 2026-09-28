begin;

create extension if not exists pgcrypto with schema extensions;

create function private.provisioning_sha256(p_intent jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_intent::text, 'UTF8'), 'sha256'),
    'hex'
  );
$function$;

create function private.platform_center_provisioning_fingerprint(
  p_actor_user_id uuid,
  p_admin_email text,
  p_admin_first_name text,
  p_admin_last_name text,
  p_center_name text,
  p_center_phone text,
  p_center_email text,
  p_center_address text,
  p_center_timezone text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select private.provisioning_sha256(
    pg_catalog.jsonb_build_object(
      'operation_type', 'PLATFORM_CREATE_CENTER',
      'actor_user_id', p_actor_user_id::text,
      'scope_center_id', null,
      'admin_email', pg_catalog.lower(pg_catalog.btrim(p_admin_email)),
      'admin_first_name', pg_catalog.btrim(p_admin_first_name),
      'admin_last_name', pg_catalog.btrim(p_admin_last_name),
      'center_name', pg_catalog.btrim(p_center_name),
      'center_phone', nullif(pg_catalog.btrim(p_center_phone), ''),
      'center_email', nullif(pg_catalog.btrim(p_center_email), ''),
      'center_address', nullif(pg_catalog.btrim(p_center_address), ''),
      'center_timezone', p_center_timezone
    )
  );
$function$;

create function private.tenant_user_provisioning_fingerprint(
  p_actor_user_id uuid,
  p_center_id uuid,
  p_user_email text,
  p_first_name text,
  p_last_name text,
  p_role public.membership_role,
  p_professional_center_id uuid
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select private.provisioning_sha256(
    pg_catalog.jsonb_build_object(
      'operation_type', 'TENANT_PROVISION_USER',
      'actor_user_id', p_actor_user_id::text,
      'scope_center_id', p_center_id::text,
      'user_email', pg_catalog.lower(pg_catalog.btrim(p_user_email)),
      'first_name', pg_catalog.btrim(p_first_name),
      'last_name', pg_catalog.btrim(p_last_name),
      'role', p_role::text,
      'professional_center_id', p_professional_center_id::text
    )
  );
$function$;

create function private.platform_admin_bootstrap_fingerprint(
  p_email text,
  p_first_name text,
  p_last_name text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $function$
  select private.provisioning_sha256(
    pg_catalog.jsonb_build_object(
      'operation_type', 'BOOTSTRAP_PLATFORM_ADMIN',
      'actor_user_id', null,
      'scope_center_id', null,
      'email', pg_catalog.lower(pg_catalog.btrim(p_email)),
      'first_name', pg_catalog.btrim(p_first_name),
      'last_name', pg_catalog.btrim(p_last_name)
    )
  );
$function$;

create function private.register_provisioning_intent(
  p_operation_id uuid,
  p_operation_type text,
  p_payload_hash text,
  p_actor_user_id uuid,
  p_scope_center_id uuid
)
returns table (
  operation_status text,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean,
  payload_hash text
)
language plpgsql
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
begin
  if p_operation_id is null
    or p_payload_hash is null
    or p_payload_hash collate "C" !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'A valid operation id and DB fingerprint are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );

  insert into private.provisioning_operations (
    id,
    operation_type,
    payload_hash,
    actor_user_id,
    scope_center_id
  ) values (
    p_operation_id,
    p_operation_type,
    p_payload_hash,
    p_actor_user_id,
    p_scope_center_id
  )
  on conflict (id) do nothing;

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if v_operation.operation_type <> p_operation_type
    or v_operation.payload_hash <> p_payload_hash
    or v_operation.actor_user_id is distinct from p_actor_user_id
    or v_operation.scope_center_id is distinct from p_scope_center_id then
    raise exception using errcode = '23514', message = 'The operation id is already bound to another intent.';
  end if;

  if v_operation.status = 'COMPENSATED' then
    update private.provisioning_operations as operation
    set
      status = 'PENDING',
      auth_user_id = null,
      auth_user_was_created = null,
      result_user_id = null,
      result_center_id = null,
      result_membership_id = null,
      result_application_user_created = null,
      completed_at = null
    where operation.id = p_operation_id
    returning operation.* into v_operation;
  end if;

  return query select
    v_operation.status,
    v_operation.auth_user_id,
    v_operation.auth_user_was_created,
    v_operation.result_user_id,
    v_operation.result_center_id,
    v_operation.result_membership_id,
    v_operation.result_application_user_created,
    v_operation.payload_hash;
end;
$function$;

create function public.prepare_platform_center_provisioning_operation(
  p_operation_id uuid,
  p_actor_user_id uuid,
  p_center_name text,
  p_center_phone text,
  p_center_email text,
  p_center_address text,
  p_center_timezone text,
  p_admin_email text,
  p_admin_first_name text,
  p_admin_last_name text
)
returns table (
  operation_status text,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean,
  payload_hash text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload_hash text;
begin
  v_payload_hash := private.platform_center_provisioning_fingerprint(
    p_actor_user_id,
    p_admin_email,
    p_admin_first_name,
    p_admin_last_name,
    p_center_name,
    p_center_phone,
    p_center_email,
    p_center_address,
    p_center_timezone
  );

  return query
  select prepared.*
  from private.register_provisioning_intent(
    p_operation_id,
    'PLATFORM_CREATE_CENTER',
    v_payload_hash,
    p_actor_user_id,
    null
  ) as prepared;
end;
$function$;

create function public.prepare_tenant_user_provisioning_operation(
  p_operation_id uuid,
  p_actor_user_id uuid,
  p_center_id uuid,
  p_user_email text,
  p_first_name text,
  p_last_name text,
  p_role public.membership_role,
  p_professional_center_id uuid
)
returns table (
  operation_status text,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean,
  payload_hash text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload_hash text;
begin
  v_payload_hash := private.tenant_user_provisioning_fingerprint(
    p_actor_user_id,
    p_center_id,
    p_user_email,
    p_first_name,
    p_last_name,
    p_role,
    p_professional_center_id
  );

  return query
  select prepared.*
  from private.register_provisioning_intent(
    p_operation_id,
    'TENANT_PROVISION_USER',
    v_payload_hash,
    p_actor_user_id,
    p_center_id
  ) as prepared;
end;
$function$;

create function public.prepare_platform_admin_bootstrap_operation(
  p_operation_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text
)
returns table (
  operation_status text,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean,
  payload_hash text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_payload_hash text;
begin
  v_payload_hash := private.platform_admin_bootstrap_fingerprint(
    p_email,
    p_first_name,
    p_last_name
  );

  return query
  select prepared.*
  from private.register_provisioning_intent(
    p_operation_id,
    'BOOTSTRAP_PLATFORM_ADMIN',
    v_payload_hash,
    null,
    null
  ) as prepared;
end;
$function$;

drop function public.prepare_auth_provisioning_operation(uuid, text, text, uuid, uuid);

drop function public.platform_create_center_with_admin(
  uuid, text, text, text, text, text, text, uuid, text, text
);

create function public.platform_create_center_with_admin(
  p_operation_id uuid,
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
  v_operation private.provisioning_operations%rowtype;
  v_auth_email text;
  v_actual_fingerprint text;
  v_center_id uuid := pg_catalog.gen_random_uuid();
  v_membership_id uuid := pg_catalog.gen_random_uuid();
  v_application_user_created boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );

  if not private.is_platform_admin() then
    raise exception using errcode = '42501', message = 'Platform access denied.';
  end if;

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if not found
    or v_operation.operation_type <> 'PLATFORM_CREATE_CENTER'
    or v_operation.actor_user_id is distinct from auth.uid()
    or v_operation.scope_center_id is not null
    or v_operation.auth_user_id is distinct from p_admin_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this center creation.';
  end if;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = p_admin_auth_user_id
    and auth_user.email is not null
    and pg_catalog.btrim(auth_user.email) <> '';

  if v_auth_email is null then
    raise exception using errcode = '23503', message = 'The Auth identity does not exist.';
  end if;

  v_actual_fingerprint := private.platform_center_provisioning_fingerprint(
    auth.uid(),
    v_auth_email,
    p_admin_first_name,
    p_admin_last_name,
    p_center_name,
    p_center_phone,
    p_center_email,
    p_center_address,
    p_center_timezone
  );

  if v_operation.payload_hash <> v_actual_fingerprint then
    raise exception using errcode = '23514', message = 'The center creation arguments differ from the registered intent.';
  end if;

  if v_operation.status = 'SUCCEEDED' then
    return query select
      v_operation.result_center_id,
      v_operation.result_membership_id,
      v_operation.result_application_user_created;
    return;
  end if;

  if v_operation.status not in ('AUTH_READY', 'COMPENSATION_REQUIRED') then
    raise exception using errcode = '55000', message = 'The provisioning operation is not ready.';
  end if;

  if exists (
    select 1 from public.users as app_user
    where app_user.email = v_auth_email and app_user.id <> p_admin_auth_user_id
  ) then
    raise exception using errcode = '23505', message = 'The Auth email conflicts with another user.';
  end if;

  if exists (select 1 from public.users as app_user where app_user.id = p_admin_auth_user_id) then
    if exists (
      select 1 from public.users as app_user
      where app_user.id = p_admin_auth_user_id and app_user.email <> v_auth_email
    ) then
      raise exception using errcode = '23514', message = 'The Auth email and user projection differ.';
    end if;
  else
    if p_admin_first_name is null or pg_catalog.btrim(p_admin_first_name) = ''
      or p_admin_last_name is null or pg_catalog.btrim(p_admin_last_name) = '' then
      raise exception using errcode = '22023', message = 'Names are required for a new user.';
    end if;
    insert into public.users (id, first_name, last_name, email)
    values (
      p_admin_auth_user_id,
      pg_catalog.btrim(p_admin_first_name),
      pg_catalog.btrim(p_admin_last_name),
      v_auth_email
    );
    v_application_user_created := true;
  end if;

  if p_center_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names() as timezone_name
    where timezone_name.name = p_center_timezone
  ) then
    raise exception using errcode = '22023', message = 'A valid IANA timezone is required.';
  end if;

  insert into public.centers (id, name, phone, email, address, timezone, is_active)
  values (
    v_center_id,
    pg_catalog.btrim(p_center_name),
    nullif(pg_catalog.btrim(p_center_phone), ''),
    nullif(pg_catalog.btrim(p_center_email), ''),
    nullif(pg_catalog.btrim(p_center_address), ''),
    p_center_timezone,
    true
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || v_center_id::text, 0)
  );

  insert into public.center_memberships (
    id, center_id, user_id, role, professional_center_id, is_active
  ) values (
    v_membership_id,
    v_center_id,
    p_admin_auth_user_id,
    'ADMIN'::public.membership_role,
    null,
    true
  );

  if (
    select count(*) from public.center_memberships as membership
    where membership.center_id = v_center_id
      and membership.role = 'ADMIN'::public.membership_role
      and membership.is_active
  ) <> 1 then
    raise exception using errcode = '23514', message = 'A new center requires exactly one active ADMIN.';
  end if;

  update private.provisioning_operations as operation
  set
    status = 'SUCCEEDED',
    result_user_id = p_admin_auth_user_id,
    result_center_id = v_center_id,
    result_membership_id = v_membership_id,
    result_application_user_created = v_application_user_created,
    completed_at = pg_catalog.now()
  where operation.id = p_operation_id;

  return query select v_center_id, v_membership_id, v_application_user_created;
end;
$function$;

drop function public.admin_provision_center_user(
  uuid, text, uuid, uuid, text, text, public.membership_role, uuid
);

create function public.admin_provision_center_user(
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

drop function public.bootstrap_platform_admin(uuid, text, uuid, text, text);

create function public.bootstrap_platform_admin(
  p_operation_id uuid,
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
  v_operation private.provisioning_operations%rowtype;
  v_auth_email text;
  v_actual_fingerprint text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:platform-bootstrap', 0)
  );

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if not found
    or v_operation.operation_type <> 'BOOTSTRAP_PLATFORM_ADMIN'
    or v_operation.actor_user_id is not null
    or v_operation.scope_center_id is not null
    or v_operation.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this bootstrap.';
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

  v_actual_fingerprint := private.platform_admin_bootstrap_fingerprint(
    v_auth_email,
    p_first_name,
    p_last_name
  );

  if v_operation.payload_hash <> v_actual_fingerprint then
    raise exception using errcode = '23514', message = 'The bootstrap arguments differ from the registered intent.';
  end if;

  if v_operation.status = 'SUCCEEDED' then
    return query select v_operation.result_user_id;
    return;
  end if;

  if v_operation.status not in ('AUTH_READY', 'COMPENSATION_REQUIRED') then
    raise exception using errcode = '55000', message = 'The bootstrap operation is not ready.';
  end if;

  if exists (select 1 from public.platform_admins)
    or exists (select 1 from public.users)
    or exists (select 1 from public.centers)
    or exists (select 1 from public.center_memberships) then
    raise exception using errcode = '23514', message = 'The platform is already initialized.';
  end if;

  if p_first_name is null or pg_catalog.btrim(p_first_name) = ''
    or p_last_name is null or pg_catalog.btrim(p_last_name) = '' then
    raise exception using errcode = '22023', message = 'Names are required for the platform administrator.';
  end if;

  insert into public.users (id, first_name, last_name, email)
  values (
    p_auth_user_id,
    pg_catalog.btrim(p_first_name),
    pg_catalog.btrim(p_last_name),
    v_auth_email
  );

  insert into public.platform_admins (user_id) values (p_auth_user_id);

  update private.provisioning_operations as operation
  set
    status = 'SUCCEEDED',
    result_user_id = p_auth_user_id,
    completed_at = pg_catalog.now()
  where operation.id = p_operation_id;

  return query select p_auth_user_id;
end;
$function$;

revoke all on function private.provisioning_sha256(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.platform_center_provisioning_fingerprint(
  uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.tenant_user_provisioning_fingerprint(
  uuid, uuid, text, text, text, public.membership_role, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.platform_admin_bootstrap_fingerprint(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.register_provisioning_intent(uuid, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.prepare_platform_center_provisioning_operation(
  uuid, uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.prepare_tenant_user_provisioning_operation(
  uuid, uuid, uuid, text, text, text, public.membership_role, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.prepare_platform_admin_bootstrap_operation(uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_create_center_with_admin(
  uuid, text, text, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.admin_provision_center_user(
  uuid, uuid, uuid, text, text, public.membership_role, uuid
) from public, anon, authenticated;
revoke all on function public.bootstrap_platform_admin(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.prepare_platform_center_provisioning_operation(
  uuid, uuid, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.prepare_tenant_user_provisioning_operation(
  uuid, uuid, uuid, text, text, text, public.membership_role, uuid
) to service_role;
grant execute on function public.prepare_platform_admin_bootstrap_operation(uuid, text, text, text)
  to service_role;
grant execute on function public.platform_create_center_with_admin(
  uuid, text, text, text, text, text, uuid, text, text
) to authenticated;
grant execute on function public.admin_provision_center_user(
  uuid, uuid, uuid, text, text, public.membership_role, uuid
) to authenticated;
grant execute on function public.bootstrap_platform_admin(uuid, uuid, text, text)
  to service_role;

commit;
