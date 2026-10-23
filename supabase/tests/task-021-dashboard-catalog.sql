begin read only;
select current_setting('server_version') as postgres_version,
  current_database() as database_name, current_user as inspector;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type,
  pg_get_userbyid(p.proowner) as owner,
  p.provolatile, p.prosecdef, p.proconfig,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_proc as p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('staff_get_daily_dashboard', 'professional_get_own_daily_dashboard')
order by p.proname;

select c.relname, c.relrowsecurity,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select
from pg_class as c where c.oid = 'public.appointments'::regclass;

select indexname from pg_indexes where schemaname = 'public'
  and tablename = 'appointments' order by indexname;

select 'task021_centers' as resource, count(*) from public.centers
where id::text like 'a21%'
union all
select 'task021_appointments', count(*) from public.appointments
where id::text like 'a21%'
union all
select 'task021_auth_users', count(*) from auth.users
where id::text like 'a21%';
rollback;
