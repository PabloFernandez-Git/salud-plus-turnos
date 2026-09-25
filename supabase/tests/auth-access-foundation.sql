begin;

do $test$
declare
  expected_policies constant text[] := array[
    'center_memberships_select_self_or_center_admin',
    'centers_select_active_members',
    'platform_admins_select_self',
    'professional_centers_select_admin_or_linked_professional',
    'professionals_select_admin_or_linked_professional',
    'users_select_self_or_center_admin'
  ];
  expected_select_tables constant text[] := array[
    'center_memberships',
    'centers',
    'platform_admins',
    'professional_centers',
    'professionals',
    'users'
  ];
  secured_function regprocedure;
  service_only_function regprocedure;
  service_only_functions constant regprocedure[] := array[
    'public.bootstrap_platform_preflight()'::regprocedure,
    'public.prepare_platform_center_provisioning_operation(uuid,uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.prepare_tenant_user_provisioning_operation(uuid,uuid,uuid,text,text,text,public.membership_role,uuid)'::regprocedure,
    'public.prepare_platform_admin_bootstrap_operation(uuid,text,text,text)'::regprocedure,
    'public.bind_auth_provisioning_operation(uuid,text,uuid,boolean)'::regprocedure,
    'public.reconcile_auth_provisioning_operation(uuid,text)'::regprocedure,
    'public.mark_auth_provisioning_compensation(uuid,text,uuid,boolean)'::regprocedure,
    'public.bootstrap_platform_admin(uuid,uuid,text,text)'::regprocedure
  ];
  secured_functions constant regprocedure[] := array[
    'private.is_platform_admin()'::regprocedure,
    'private.has_active_center_membership(uuid)'::regprocedure,
    'private.has_active_center_role(uuid,public.membership_role[])'::regprocedure,
    'private.active_professional_center_id(uuid)'::regprocedure,
    'private.can_administer_user(uuid)'::regprocedure,
    'private.can_view_professional(uuid)'::regprocedure,
    'public.bootstrap_platform_preflight()'::regprocedure,
    'public.platform_list_centers()'::regprocedure,
    'public.platform_resolve_user_by_email(text)'::regprocedure,
    'public.admin_resolve_user_by_email(uuid,text)'::regprocedure,
    'public.prepare_platform_center_provisioning_operation(uuid,uuid,text,text,text,text,text,text,text,text)'::regprocedure,
    'public.prepare_tenant_user_provisioning_operation(uuid,uuid,uuid,text,text,text,public.membership_role,uuid)'::regprocedure,
    'public.prepare_platform_admin_bootstrap_operation(uuid,text,text,text)'::regprocedure,
    'public.bind_auth_provisioning_operation(uuid,text,uuid,boolean)'::regprocedure,
    'public.reconcile_auth_provisioning_operation(uuid,text)'::regprocedure,
    'public.mark_auth_provisioning_compensation(uuid,text,uuid,boolean)'::regprocedure,
    'public.platform_create_center_with_admin(uuid,text,text,text,text,text,uuid,text,text)'::regprocedure,
    'public.platform_set_center_active(uuid,boolean)'::regprocedure,
    'public.admin_provision_center_user(uuid,uuid,uuid,text,text,public.membership_role,uuid)'::regprocedure,
    'public.admin_set_center_membership(uuid,uuid,public.membership_role,uuid,boolean)'::regprocedure,
    'public.bootstrap_platform_admin(uuid,uuid,text,text)'::regprocedure
  ];
begin
  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.users'::regclass
      and attribute.attname = 'email'
      and attribute.attnotnull
      and not attribute.attisdropped
  ) then
    raise exception 'public.users.email is not NOT NULL';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.users'::regclass
      and constraint_record.conname = 'users_email_key'
      and constraint_record.contype = 'u'
  ) then
    raise exception 'public.users.email does not have the approved UNIQUE constraint';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_record
    where table_record.oid = 'public.platform_admins'::regclass
      and table_record.relrowsecurity
  ) then
    raise exception 'platform_admins does not have RLS enabled';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'private'
      and table_record.relname = 'provisioning_operations'
      and table_record.relrowsecurity
  ) then
    raise exception 'private.provisioning_operations does not have RLS enabled';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'private.provisioning_operations',
    'SELECT,INSERT,UPDATE,DELETE'
  ) or pg_catalog.has_table_privilege(
    'anon',
    'private.provisioning_operations',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'Provisioning operations are directly accessible';
  end if;

  if (
    select array_agg(policyname::text order by policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
  ) is distinct from expected_policies then
    raise exception 'The public RLS policy set differs from the approved six policies';
  end if;

  if (
    select array_agg(table_name order by table_name)
    from (
      select table_record.relname::text as table_name
      from pg_catalog.pg_class as table_record
      join pg_catalog.pg_namespace as namespace_record
        on namespace_record.oid = table_record.relnamespace
      where namespace_record.nspname = 'public'
        and table_record.relkind = 'r'
        and pg_catalog.has_table_privilege(
          'authenticated',
          table_record.oid,
          'SELECT'
        )
    ) as granted_tables
  ) is distinct from expected_select_tables then
    raise exception 'authenticated SELECT grants differ from the approved six tables';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as table_record
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = table_record.relnamespace
    where namespace_record.nspname = 'public'
      and table_record.relkind = 'r'
      and (
        pg_catalog.has_table_privilege('anon', table_record.oid, 'SELECT,INSERT,UPDATE,DELETE')
        or pg_catalog.has_table_privilege(
          'authenticated',
          table_record.oid,
          'INSERT,UPDATE,DELETE'
        )
      )
  ) then
    raise exception 'anon or authenticated has an unapproved domain table privilege';
  end if;

  if pg_catalog.has_table_privilege(
    'service_role',
    'public.platform_admins',
    'SELECT'
  ) or pg_catalog.has_table_privilege(
    'service_role',
    'public.users',
    'SELECT'
  ) or pg_catalog.has_table_privilege(
    'service_role',
    'public.centers',
    'SELECT'
  ) or pg_catalog.has_table_privilege(
    'service_role',
    'public.center_memberships',
    'SELECT'
  ) then
    raise exception 'service_role received an unapproved domain table SELECT grant';
  end if;

  foreach secured_function in array secured_functions loop
    if not exists (
      select 1
      from pg_catalog.pg_proc as function_record
      where function_record.oid = secured_function
        and function_record.prosecdef
        and function_record.proconfig @> array['search_path=""']::text[]
    ) then
      raise exception 'Function % is not SECURITY DEFINER with empty search_path', secured_function;
    end if;

    if pg_catalog.has_function_privilege('public', secured_function, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', secured_function, 'EXECUTE') then
      raise exception 'Function % is executable by PUBLIC or anon', secured_function;
    end if;
  end loop;

  foreach service_only_function in array service_only_functions loop
    if not pg_catalog.has_function_privilege(
      'service_role',
      service_only_function,
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated',
      service_only_function,
      'EXECUTE'
    ) then
      raise exception 'Function % does not have the required service-only grant', service_only_function;
    end if;
  end loop;

  if pg_catalog.has_function_privilege(
    'authenticated',
    'public.bootstrap_platform_admin(uuid,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'authenticated can execute bootstrap_platform_admin';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.bootstrap_platform_admin(uuid,uuid,text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute bootstrap_platform_admin';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.reconcile_auth_provisioning_operation(uuid,text)'::regprocedure,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.reconcile_auth_provisioning_operation(uuid,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'Provisioning reconciliation grants are not service-only';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_enum as enum_value
    join pg_catalog.pg_type as enum_type on enum_type.oid = enum_value.enumtypid
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = enum_type.typnamespace
    where namespace_record.nspname = 'public'
      and enum_type.typname = 'membership_role'
      and enum_value.enumlabel = 'PLATFORM_ADMIN'
  ) then
    raise exception 'PLATFORM_ADMIN was added to membership_role';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger_record
    join pg_catalog.pg_proc as function_record on function_record.oid = trigger_record.tgfoid
    join pg_catalog.pg_namespace as namespace_record
      on namespace_record.oid = function_record.pronamespace
    where trigger_record.tgrelid = 'auth.users'::regclass
      and not trigger_record.tgisinternal
      and namespace_record.nspname in ('public', 'private')
  ) then
    raise exception 'TASK-005 installed an application trigger on auth.users';
  end if;
end;
$test$;

rollback;
