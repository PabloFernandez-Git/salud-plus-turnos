begin;

create or replace function public.bootstrap_platform_admin(
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
  v_bound_auth_user_id uuid;
  v_auth_email text;
  v_actual_fingerprint text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:provisioning:' || p_operation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:platform-bootstrap', 0)
  );

  -- SHARE is the weakest table lock that conflicts with the ROW EXCLUSIVE lock
  -- acquired by INSERT, UPDATE and DELETE. It keeps auth.users stable from the
  -- decisive revalidation through the transaction commit while allowing reads.
  lock table auth.users in share mode;

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

  v_bound_auth_user_id := v_operation.auth_user_id;

  select pg_catalog.lower(pg_catalog.btrim(auth_user.email))
  into v_auth_email
  from auth.users as auth_user
  where auth_user.id = v_bound_auth_user_id
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

  if exists (
    select 1
    from auth.users as auth_user
    where auth_user.id is distinct from v_bound_auth_user_id
  )
    or exists (select 1 from public.platform_admins)
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
    v_bound_auth_user_id,
    pg_catalog.btrim(p_first_name),
    pg_catalog.btrim(p_last_name),
    v_auth_email
  );

  insert into public.platform_admins (user_id) values (v_bound_auth_user_id);

  update private.provisioning_operations as operation
  set
    status = 'SUCCEEDED',
    result_user_id = v_bound_auth_user_id,
    completed_at = pg_catalog.now()
  where operation.id = p_operation_id;

  return query select v_bound_auth_user_id;
end;
$function$;

revoke all on function public.bootstrap_platform_admin(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bootstrap_platform_admin(uuid, uuid, text, text)
  to service_role;

commit;
