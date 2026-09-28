begin;

create function public.bootstrap_platform_preflight()
returns table (
  platform_is_empty boolean,
  auth_users_empty boolean,
  public_users_empty boolean,
  platform_admins_empty boolean,
  centers_empty boolean,
  center_memberships_empty boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    not exists (select 1 from auth.users)
      and not exists (select 1 from public.users)
      and not exists (select 1 from public.platform_admins)
      and not exists (select 1 from public.centers)
      and not exists (select 1 from public.center_memberships),
    not exists (select 1 from auth.users),
    not exists (select 1 from public.users),
    not exists (select 1 from public.platform_admins),
    not exists (select 1 from public.centers),
    not exists (select 1 from public.center_memberships);
$function$;

revoke all on function public.bootstrap_platform_preflight() from public;
revoke all on function public.bootstrap_platform_preflight() from anon;
revoke all on function public.bootstrap_platform_preflight() from authenticated;
revoke all on function public.bootstrap_platform_preflight() from service_role;
grant execute on function public.bootstrap_platform_preflight() to service_role;

commit;
