-- Run only in an isolated disposable local database after all migrations.
begin;

do $test$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc as function_record
    where function_record.oid =
      'public.admin_update_center_settings(uuid,text,text,text,text,timestamptz)'::regprocedure
      and function_record.prosecdef
      and function_record.proconfig @> array['search_path=""']::text[]
      and pg_catalog.pg_get_userbyid(function_record.proowner) = 'postgres'
  ) then raise exception 'RPC owner or SECURITY DEFINER configuration differs'; end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.centers', 'UPDATE')
    or pg_catalog.has_table_privilege('anon', 'public.centers', 'UPDATE') then
    raise exception 'Direct center UPDATE privilege exists';
  end if;
  if not pg_catalog.has_function_privilege(
    'authenticated',
    'public.admin_update_center_settings(uuid,text,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'anon',
    'public.admin_update_center_settings(uuid,text,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'public',
    'public.admin_update_center_settings(uuid,text,text,text,text,timestamptz)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'RPC grants differ from the intended contract';
  end if;
end;
$test$;

insert into auth.users (id, email) values
  ('35000000-0000-4000-8000-000000000001', 'task035-admin-a@example.test'),
  ('35000000-0000-4000-8000-000000000002', 'task035-admin-b@example.test'),
  ('35000000-0000-4000-8000-000000000003', 'task035-reception@example.test'),
  ('35000000-0000-4000-8000-000000000004', 'task035-professional@example.test'),
  ('35000000-0000-4000-8000-000000000005', 'task035-platform@example.test');
insert into public.users (id, first_name, last_name, email)
select id, 'Task', '035', email from auth.users
where id::text like '35000000-0000-4000-8000-00000000000%';
insert into public.platform_admins (user_id)
values ('35000000-0000-4000-8000-000000000005');
insert into public.centers (id, name, timezone, logo_path, updated_at) values
  ('35100000-0000-4000-8000-000000000001', 'Centro A', 'UTC', 'fixed-logo', pg_catalog.now() - interval '1 second'),
  ('35100000-0000-4000-8000-000000000002', 'Centro B', 'UTC', 'fixed-logo', pg_catalog.now() - interval '1 second');
insert into public.professionals (id, first_name, last_name, nationality_code, document_number, email)
values ('35200000-0000-4000-8000-000000000001', 'Profesional', 'Task', 'AR', 'TASK035001', 'task035-prof@example.test');
insert into public.professional_centers (id, professional_id, center_id)
values ('35300000-0000-4000-8000-000000000001',
  '35200000-0000-4000-8000-000000000001', '35100000-0000-4000-8000-000000000001');
insert into public.center_memberships (center_id, user_id, role, professional_center_id) values
  ('35100000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000001', 'ADMIN', null),
  ('35100000-0000-4000-8000-000000000002', '35000000-0000-4000-8000-000000000002', 'ADMIN', null),
  ('35100000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000003', 'RECEPTION', null),
  ('35100000-0000-4000-8000-000000000001', '35000000-0000-4000-8000-000000000004', 'PROFESSIONAL',
    '35300000-0000-4000-8000-000000000001');

set local role authenticated;

do $test$
declare
  v_center_id constant uuid := '35100000-0000-4000-8000-000000000001';
  v_original timestamptz;
  v_saved record;
  v_actor uuid;
  v_denied boolean;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', '35000000-0000-4000-8000-000000000001', true);
  select updated_at into v_original from public.centers where id = v_center_id;

  select * into v_saved from public.admin_update_center_settings(
    v_center_id, '  Centro actualizado  ', '  555  ', '  centro@example.test  ', '  Calle 1  ', v_original
  );
  if v_saved.name <> 'Centro actualizado' or v_saved.phone <> '555'
    or v_saved.email <> 'centro@example.test' or v_saved.address <> 'Calle 1' then
    raise exception 'The successful update did not return normalized persisted values';
  end if;

  if (select updated_at from public.admin_update_center_settings(
    v_center_id, 'Centro actualizado', '555', 'centro@example.test', 'Calle 1', v_saved.updated_at
  )) is distinct from v_saved.updated_at then
    raise exception 'An unchanged submission advanced updated_at';
  end if;

  begin
    perform public.admin_update_center_settings(v_center_id, 'Sobrescrito', null, null, null, v_original);
    raise exception 'Stale update unexpectedly succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'STALE_CENTER_SETTINGS' then raise; end if;
  end;

  begin
    perform public.admin_update_center_settings(v_center_id, '  ', null, null, null, v_saved.updated_at);
    raise exception 'Blank name unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.admin_update_center_settings(v_center_id, 'Centro', null, 'bad-email', null, v_saved.updated_at);
    raise exception 'Invalid email unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.admin_update_center_settings(v_center_id, 'Centro', null, 'bad..dots@example.test', null, v_saved.updated_at);
    raise exception 'Malformed email unexpectedly succeeded';
  exception when sqlstate '22023' then null;
  end;

  foreach v_actor in array array[
    '35000000-0000-4000-8000-000000000002'::uuid,
    '35000000-0000-4000-8000-000000000003'::uuid,
    '35000000-0000-4000-8000-000000000004'::uuid,
    '35000000-0000-4000-8000-000000000005'::uuid
  ] loop
    perform pg_catalog.set_config('request.jwt.claim.sub', v_actor::text, true);
    v_denied := false;
    begin
      perform public.admin_update_center_settings(v_center_id, 'Intruso', null, null, null, v_saved.updated_at);
    exception when sqlstate '42501' then v_denied := true;
    end;
    if not v_denied then raise exception 'Actor % changed another center or lacked role', v_actor; end if;
  end loop;

  perform pg_catalog.set_config('request.jwt.claim.sub', '', true);
  v_denied := false;
  begin
    perform public.admin_update_center_settings(v_center_id, 'Sin sesión', null, null, null, v_saved.updated_at);
  exception when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then raise exception 'Unauthenticated update succeeded'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', '35000000-0000-4000-8000-000000000001', true);
  v_denied := false;
  begin
    execute 'update public.centers set timezone = ''America/New_York'' where id = $1' using v_center_id;
  exception when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then raise exception 'Direct protected-column update succeeded'; end if;
end;
$test$;

reset role;

do $test$
begin
  if not exists (
    select 1 from public.centers
    where id = '35100000-0000-4000-8000-000000000001'
      and name = 'Centro actualizado' and timezone = 'UTC'
      and logo_path = 'fixed-logo' and is_active
  ) then raise exception 'Protected fields changed or stale/denied update had an effect'; end if;
end;
$test$;

update public.centers set is_active = false where id = '35100000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '35000000-0000-4000-8000-000000000001', true);
do $test$
declare v_denied boolean := false;
begin
  begin
    perform public.admin_update_center_settings(
      '35100000-0000-4000-8000-000000000001', 'Inactivo', null, null, null, pg_catalog.now()
    );
  exception when sqlstate '42501' then v_denied := true;
  end;
  if not v_denied then raise exception 'Inactive center update succeeded'; end if;
end;
$test$;

reset role;
rollback;
