begin;

create table private.provisioning_operations (
  id uuid primary key,
  operation_type text not null,
  payload_hash text not null,
  actor_user_id uuid,
  scope_center_id uuid,
  auth_user_id uuid,
  auth_user_was_created boolean,
  status text not null default 'PENDING',
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint provisioning_operations_type_check check (
    operation_type in (
      'PLATFORM_CREATE_CENTER',
      'TENANT_PROVISION_USER',
      'BOOTSTRAP_PLATFORM_ADMIN'
    )
  ),
  constraint provisioning_operations_payload_hash_check check (
    payload_hash collate "C" ~ '^[0-9a-f]{64}$'
  ),
  constraint provisioning_operations_status_check check (
    status in (
      'PENDING',
      'AUTH_READY',
      'SUCCEEDED',
      'COMPENSATION_REQUIRED',
      'COMPENSATED'
    )
  ),
  constraint provisioning_operations_auth_binding_check check (
    (auth_user_id is null and auth_user_was_created is null)
    or (auth_user_id is not null and auth_user_was_created is not null)
  ),
  constraint provisioning_operations_scope_check check (
    (
      operation_type = 'BOOTSTRAP_PLATFORM_ADMIN'
      and actor_user_id is null
      and scope_center_id is null
    )
    or (
      operation_type = 'PLATFORM_CREATE_CENTER'
      and actor_user_id is not null
      and scope_center_id is null
    )
    or (
      operation_type = 'TENANT_PROVISION_USER'
      and actor_user_id is not null
      and scope_center_id is not null
    )
  ),
  constraint provisioning_operations_success_result_check check (
    status <> 'SUCCEEDED'
    or (
      result_user_id is not null
      and (
        (
          operation_type = 'PLATFORM_CREATE_CENTER'
          and result_center_id is not null
          and result_membership_id is not null
          and result_application_user_created is not null
        )
        or (
          operation_type = 'TENANT_PROVISION_USER'
          and result_center_id is null
          and result_membership_id is not null
          and result_application_user_created is not null
        )
        or (
          operation_type = 'BOOTSTRAP_PLATFORM_ADMIN'
          and result_center_id is null
          and result_membership_id is null
          and result_application_user_created is null
        )
      )
    )
  )
);

alter table private.provisioning_operations enable row level security;

create trigger provisioning_operations_set_updated_at
before update on private.provisioning_operations
for each row execute function private.set_updated_at();

revoke all on table private.provisioning_operations
  from public, anon, authenticated, service_role;

create function public.prepare_auth_provisioning_operation(
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
  result_application_user_created boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
begin
  if p_operation_id is null
    or p_payload_hash is null
    or p_payload_hash collate "C" !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'A valid operation id and payload hash are required.';
  end if;

  if p_operation_type not in (
    'PLATFORM_CREATE_CENTER',
    'TENANT_PROVISION_USER',
    'BOOTSTRAP_PLATFORM_ADMIN'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported provisioning operation type.';
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
    v_operation.result_application_user_created;
end;
$function$;

create function public.bind_auth_provisioning_operation(
  p_operation_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_auth_user_was_created boolean
)
returns table (
  operation_status text,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
begin
  if p_operation_id is null or p_auth_user_id is null or p_auth_user_was_created is null then
    raise exception using errcode = '22023', message = 'A complete Auth operation binding is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Provisioning operation not found.';
  end if;

  if v_operation.payload_hash <> p_payload_hash then
    raise exception using errcode = '23514', message = 'The operation payload does not match.';
  end if;

  if v_operation.status = 'PENDING' then
    update private.provisioning_operations as operation
    set
      auth_user_id = p_auth_user_id,
      auth_user_was_created = p_auth_user_was_created,
      status = 'AUTH_READY'
    where operation.id = p_operation_id
    returning operation.* into v_operation;
  elsif v_operation.auth_user_id is distinct from p_auth_user_id
    or v_operation.auth_user_was_created is distinct from p_auth_user_was_created then
    raise exception using errcode = '23514', message = 'The operation is bound to another Auth identity.';
  elsif v_operation.status not in ('AUTH_READY', 'COMPENSATION_REQUIRED', 'SUCCEEDED') then
    raise exception using errcode = '55000', message = 'The operation is not ready for Auth binding.';
  end if;

  return query select
    v_operation.status,
    v_operation.auth_user_id,
    v_operation.auth_user_was_created,
    v_operation.result_user_id,
    v_operation.result_center_id,
    v_operation.result_membership_id,
    v_operation.result_application_user_created;
end;
$function$;

create function public.reconcile_auth_provisioning_operation(
  p_operation_id uuid,
  p_payload_hash text
)
returns table (
  operation_status text,
  operation_type text,
  actor_user_id uuid,
  scope_center_id uuid,
  auth_user_id uuid,
  auth_user_was_created boolean,
  result_user_id uuid,
  result_center_id uuid,
  result_membership_id uuid,
  result_application_user_created boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Provisioning operation not found.';
  end if;

  if v_operation.payload_hash <> p_payload_hash then
    raise exception using errcode = '23514', message = 'The operation payload does not match.';
  end if;

  return query select
    v_operation.status,
    v_operation.operation_type,
    v_operation.actor_user_id,
    v_operation.scope_center_id,
    v_operation.auth_user_id,
    v_operation.auth_user_was_created,
    v_operation.result_user_id,
    v_operation.result_center_id,
    v_operation.result_membership_id,
    v_operation.result_application_user_created;
end;
$function$;

create function public.mark_auth_provisioning_compensation(
  p_operation_id uuid,
  p_payload_hash text,
  p_auth_user_id uuid,
  p_compensated boolean
)
returns table (operation_status text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation private.provisioning_operations%rowtype;
begin
  if p_auth_user_id is null or p_compensated is null then
    raise exception using errcode = '22023', message = 'Compensation state is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );

  select operation.*
  into v_operation
  from private.provisioning_operations as operation
  where operation.id = p_operation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Provisioning operation not found.';
  end if;

  if v_operation.payload_hash <> p_payload_hash then
    raise exception using errcode = '23514', message = 'The operation payload does not match.';
  end if;

  if v_operation.status = 'SUCCEEDED' then
    raise exception using errcode = '55000', message = 'A succeeded operation cannot be compensated.';
  end if;

  if v_operation.auth_user_id is not null
    and (
      v_operation.auth_user_id <> p_auth_user_id
      or v_operation.auth_user_was_created is distinct from true
    ) then
    raise exception using errcode = '23514', message = 'Only the Auth identity created by this operation may be compensated.';
  end if;

  update private.provisioning_operations as operation
  set
    auth_user_id = p_auth_user_id,
    auth_user_was_created = true,
    status = case when p_compensated then 'COMPENSATED' else 'COMPENSATION_REQUIRED' end,
    completed_at = case when p_compensated then pg_catalog.now() else null end
  where operation.id = p_operation_id
  returning operation.* into v_operation;

  return query select v_operation.status;
end;
$function$;

drop function public.platform_create_center_with_admin(
  text, text, text, text, text, uuid, text, text
);

create function public.platform_create_center_with_admin(
  p_operation_id uuid,
  p_payload_hash text,
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
    or v_operation.payload_hash <> p_payload_hash
    or v_operation.auth_user_id is distinct from p_admin_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this center creation.';
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

  if p_center_timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names() as timezone_name
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
  uuid, uuid, text, text, public.membership_role, uuid
);

create function public.admin_provision_center_user(
  p_operation_id uuid,
  p_payload_hash text,
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
    or v_operation.payload_hash <> p_payload_hash
    or v_operation.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this tenant provisioning.';
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

drop function public.bootstrap_platform_admin(uuid, text, text);

create function public.bootstrap_platform_admin(
  p_operation_id uuid,
  p_payload_hash text,
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
    or v_operation.payload_hash <> p_payload_hash
    or v_operation.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode = '23514', message = 'The provisioning operation does not match this bootstrap.';
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

revoke all on function public.prepare_auth_provisioning_operation(uuid, text, text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.bind_auth_provisioning_operation(uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.reconcile_auth_provisioning_operation(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_auth_provisioning_compensation(uuid, text, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.platform_create_center_with_admin(
  uuid, text, text, text, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.admin_provision_center_user(
  uuid, text, uuid, uuid, text, text, public.membership_role, uuid
) from public, anon, authenticated;
revoke all on function public.bootstrap_platform_admin(uuid, text, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.prepare_auth_provisioning_operation(uuid, text, text, uuid, uuid)
  to service_role;
grant execute on function public.bind_auth_provisioning_operation(uuid, text, uuid, boolean)
  to service_role;
grant execute on function public.reconcile_auth_provisioning_operation(uuid, text)
  to service_role;
grant execute on function public.mark_auth_provisioning_compensation(uuid, text, uuid, boolean)
  to service_role;
grant execute on function public.platform_create_center_with_admin(
  uuid, text, text, text, text, text, text, uuid, text, text
) to authenticated;
grant execute on function public.admin_provision_center_user(
  uuid, text, uuid, uuid, text, text, public.membership_role, uuid
) to authenticated;
grant execute on function public.bootstrap_platform_admin(uuid, text, uuid, text, text)
  to service_role;

commit;
