begin;

do $test$
declare
  expected_policies constant text[] := array[
    'availabilities_select_active_tenant',
    'center_memberships_select_self_or_center_admin',
    'centers_select_active_members',
    'patient_centers_select_tenant_staff',
    'persons_select_linked_tenant_staff',
    'platform_admins_select_self',
    'professional_center_specialties_select_center_admin',
    'professional_centers_select_admin_or_linked_professional',
    'professionals_select_admin_or_linked_professional',
    'specialties_select_center_admin',
    'users_select_self_or_center_admin'
  ];
  expected_select_tables constant text[] := array[
    'availabilities',
    'center_memberships',
    'centers',
    'patient_centers',
    'persons',
    'platform_admins',
    'professional_center_specialties',
    'professional_centers',
    'professionals',
    'specialties',
    'users'
  ];
  task_functions constant regprocedure[] := array[
    'public.admin_resolve_professional_by_document(uuid,text,text)'::regprocedure,
    'public.admin_create_professional_with_center(uuid,text,text,text,text,text,text,text,integer)'::regprocedure,
    'public.admin_link_professional_to_center(uuid,uuid,text,text,timestamptz)'::regprocedure,
    'public.admin_update_professional_center(uuid,uuid,timestamptz,text,integer)'::regprocedure,
    'public.admin_set_professional_center_active(uuid,uuid,timestamptz,boolean)'::regprocedure,
    'public.admin_create_specialty(uuid,text,text)'::regprocedure,
    'public.admin_update_specialty(uuid,uuid,timestamptz,text,text)'::regprocedure,
    'public.admin_set_specialty_active(uuid,uuid,timestamptz,boolean)'::regprocedure,
    'public.admin_update_professional_center_specialties(uuid,uuid,timestamptz,uuid[],uuid[])'::regprocedure
  ];
  task_function regprocedure;
  function_definition text;
begin
  if (
    select pg_catalog.array_agg(policyname::text order by policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
  ) is distinct from expected_policies then
    raise exception 'TASK-006B public RLS policy catalog differs';
  end if;

  if (
    select pg_catalog.array_agg(table_name order by table_name)
    from (
      select table_record.relname::text as table_name
      from pg_catalog.pg_class as table_record
      join pg_catalog.pg_namespace as namespace_record
        on namespace_record.oid = table_record.relnamespace
      where namespace_record.nspname = 'public'
        and table_record.relkind = 'r'
        and pg_catalog.has_table_privilege('authenticated', table_record.oid, 'SELECT')
    ) as granted_tables
  ) is distinct from expected_select_tables then
    raise exception 'TASK-006B authenticated SELECT catalog differs';
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
    raise exception 'TASK-006B introduced an unapproved table privilege';
  end if;

  if pg_catalog.has_table_privilege(
    'service_role',
    'public.specialties',
    'SELECT,INSERT,UPDATE,DELETE'
  ) or pg_catalog.has_table_privilege(
    'service_role',
    'public.professional_center_specialties',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'TASK-006B granted service_role direct catalog access';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'specialties'
      and policyname = 'specialties_select_center_admin'
      and roles = array['authenticated']::name[]
      and cmd = 'SELECT'
      and qual like '%has_active_center_role%ADMIN%'
  ) then
    raise exception 'Specialty ADMIN SELECT policy differs';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'professional_center_specialties'
      and policyname = 'professional_center_specialties_select_center_admin'
      and roles = array['authenticated']::name[]
      and cmd = 'SELECT'
      and qual like '%has_active_center_role%ADMIN%'
  ) then
    raise exception 'ProfessionalCenterSpecialty ADMIN SELECT policy differs';
  end if;

  foreach task_function in array task_functions loop
    select pg_catalog.pg_get_functiondef(function_record.oid)
    into function_definition
    from pg_catalog.pg_proc as function_record
    where function_record.oid = task_function
      and function_record.prosecdef
      and function_record.proconfig @> array['search_path=""']::text[];

    if function_definition is null then
      raise exception 'Function % is not SECURITY DEFINER with empty search_path', task_function;
    end if;

    if function_definition not like '%auth.uid()%'
      or function_definition not like '%private.has_active_center_role%'
    then
      raise exception 'Function % does not revalidate the authenticated ADMIN', task_function;
    end if;

    if pg_catalog.has_function_privilege('public', task_function, 'EXECUTE')
      or pg_catalog.has_function_privilege('anon', task_function, 'EXECUTE')
      or not pg_catalog.has_function_privilege('authenticated', task_function, 'EXECUTE')
    then
      raise exception 'Function % has an unexpected EXECUTE grant', task_function;
    end if;
  end loop;

  if (
    select function_record.provolatile
    from pg_catalog.pg_proc as function_record
    where function_record.oid =
      'public.admin_resolve_professional_by_document(uuid,text,text)'::regprocedure
  ) <> 's' then
    raise exception 'Exact Professional resolution must be STABLE';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.admin_create_professional_with_center(uuid,text,text,text,text,text,text,text,integer)'::regprocedure
  ) into function_definition;
  if function_definition not like '%salud-plus:professional-identity:%'
    or function_definition not like '%salud-plus:center:%'
    or function_definition not like '%PROFESSIONAL_IDENTITY_ALREADY_EXISTS%'
    or function_definition not like '%private.is_valid_professional_email(v_email)%'
  then
    raise exception 'Professional creation lock, conflict or email contract differs';
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.is_valid_professional_email(text)'::regprocedure
  ) into function_definition;
  if function_definition not like '%IMMUTABLE%'
    or function_definition not like '%char_length(v_email) > 320%'
    or function_definition not like '%array_length(v_domain_labels, 1) < 2%'
    or function_definition not like '%right(v_local, 1) =%'
    or not (
      select function_record.proconfig @> array['search_path=""']::text[]
      from pg_catalog.pg_proc as function_record
      where function_record.oid = 'private.is_valid_professional_email(text)'::regprocedure
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'private.is_valid_professional_email(text)'::regprocedure,
      'EXECUTE'
    )
  then
    raise exception 'Private Professional email validator contract differs';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.professionals'::regclass
      and constraint_record.conname = 'professionals_email_contract_check'
      and constraint_record.contype = 'c'
      and constraint_record.convalidated
  ) then
    raise exception 'Professional email database constraint differs';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger as trigger_record
    join pg_catalog.pg_proc as function_record
      on function_record.oid = trigger_record.tgfoid
    where not trigger_record.tgisinternal
      and trigger_record.tgrelid in (
        'public.professional_centers'::regclass,
        'public.specialties'::regclass
      )
      and trigger_record.tgname in (
        'professional_centers_set_updated_at',
        'specialties_set_updated_at'
      )
      and function_record.oid = 'private.set_task006_cas_updated_at()'::regprocedure
  ) <> 2 then
    raise exception 'TASK-006 CAS aggregates do not use the monotonic trigger';
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.set_task006_cas_updated_at()'::regprocedure
  ) into function_definition;
  if function_definition not like '%clock_timestamp()%'
    or function_definition not like '%old.updated_at + interval ''1 microsecond''%'
    or pg_catalog.has_function_privilege(
      'authenticated',
      'private.set_task006_cas_updated_at()'::regprocedure,
      'EXECUTE'
    )
  then
    raise exception 'TASK-006 monotonic CAS trigger contract differs';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.admin_set_professional_center_active(uuid,uuid,timestamptz,boolean)'::regprocedure
  ) into function_definition;
  if function_definition not like '%PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP%'
    or function_definition not like '%salud-plus:center:%'
  then
    raise exception 'ProfessionalCenter deactivation invariant differs';
  end if;

  select pg_catalog.pg_get_functiondef(
    'public.admin_update_professional_center_specialties(uuid,uuid,timestamptz,uuid[],uuid[])'::regprocedure
  ) into function_definition;
  if function_definition not like '%STALE_PROFESSIONAL_CENTER_STATE%'
    or function_definition not like '%NO_SPECIALTY_CHANGES%'
    or function_definition not like '%order by specialty.id%for update%'
    or function_definition not like '%set updated_at = pg_catalog.clock_timestamp()%'
  then
    raise exception 'ProfessionalCenter Specialty batch contract differs';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as list_function
    join pg_catalog.pg_namespace as function_namespace
      on function_namespace.oid = list_function.pronamespace
    where function_namespace.nspname = 'public'
      and list_function.proname like '%list%professional%'
      and list_function.oid <>
        'public.staff_list_availability_professional_centers(uuid)'::regprocedure
  ) then
    raise exception 'TASK-006B exposed an unapproved global Professional listing routine';
  end if;
end;
$test$;

rollback;
