begin;

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.platform_admins as platform_admin
    where platform_admin.user_id = (select auth.uid())
  );
$function$;

create function private.has_active_center_membership(p_center_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.center_memberships as membership
    join public.centers as center on center.id = membership.center_id
    where membership.center_id = p_center_id
      and membership.user_id = (select auth.uid())
      and membership.is_active
      and center.is_active
  );
$function$;

create function private.has_active_center_role(
  p_center_id uuid,
  p_roles public.membership_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.center_memberships as membership
    join public.centers as center on center.id = membership.center_id
    where membership.center_id = p_center_id
      and membership.user_id = (select auth.uid())
      and membership.is_active
      and membership.role = any(p_roles)
      and center.is_active
  );
$function$;

create function private.active_professional_center_id(p_center_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select membership.professional_center_id
  from public.center_memberships as membership
  join public.centers as center on center.id = membership.center_id
  join public.professional_centers as professional_center
    on professional_center.id = membership.professional_center_id
   and professional_center.center_id = membership.center_id
  where membership.center_id = p_center_id
    and membership.user_id = (select auth.uid())
    and membership.role = 'PROFESSIONAL'::public.membership_role
    and membership.is_active
    and center.is_active
    and professional_center.is_active;
$function$;

create function private.can_administer_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.center_memberships as target_membership
    join public.center_memberships as actor_membership
      on actor_membership.center_id = target_membership.center_id
    join public.centers as center on center.id = actor_membership.center_id
    where target_membership.user_id = p_user_id
      and actor_membership.user_id = (select auth.uid())
      and actor_membership.role = 'ADMIN'::public.membership_role
      and actor_membership.is_active
      and center.is_active
  );
$function$;

create function private.can_view_professional(p_professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.professional_centers as professional_center
    where professional_center.professional_id = p_professional_id
      and private.has_active_center_role(
        professional_center.center_id,
        array['ADMIN']::public.membership_role[]
      )
  ) or exists (
    select 1
    from public.center_memberships as membership
    join public.centers as center on center.id = membership.center_id
    join public.professional_centers as professional_center
      on professional_center.id = membership.professional_center_id
     and professional_center.center_id = membership.center_id
    where membership.user_id = (select auth.uid())
      and membership.role = 'PROFESSIONAL'::public.membership_role
      and membership.is_active
      and center.is_active
      and professional_center.is_active
      and professional_center.professional_id = p_professional_id
  );
$function$;

revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.has_active_center_membership(uuid) from public, anon;
revoke all on function private.has_active_center_role(uuid, public.membership_role[]) from public, anon;
revoke all on function private.active_professional_center_id(uuid) from public, anon;
revoke all on function private.can_administer_user(uuid) from public, anon;
revoke all on function private.can_view_professional(uuid) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.has_active_center_membership(uuid) to authenticated;
grant execute on function private.has_active_center_role(uuid, public.membership_role[])
  to authenticated;
grant execute on function private.active_professional_center_id(uuid) to authenticated;
grant execute on function private.can_administer_user(uuid) to authenticated;
grant execute on function private.can_view_professional(uuid) to authenticated;

create policy platform_admins_select_self
on public.platform_admins
for select
to authenticated
using (user_id = (select auth.uid()));

create policy centers_select_active_members
on public.centers
for select
to authenticated
using (private.has_active_center_membership(id));

create policy users_select_self_or_center_admin
on public.users
for select
to authenticated
using (
  id = (select auth.uid())
  or private.can_administer_user(id)
);

create policy center_memberships_select_self_or_center_admin
on public.center_memberships
for select
to authenticated
using (
  (
    user_id = (select auth.uid())
    and is_active
    and private.has_active_center_membership(center_id)
  )
  or private.has_active_center_role(
    center_id,
    array['ADMIN']::public.membership_role[]
  )
);

create policy professional_centers_select_admin_or_linked_professional
on public.professional_centers
for select
to authenticated
using (
  private.has_active_center_role(
    center_id,
    array['ADMIN']::public.membership_role[]
  )
  or id = private.active_professional_center_id(center_id)
);

create policy professionals_select_admin_or_linked_professional
on public.professionals
for select
to authenticated
using (private.can_view_professional(id));

revoke all on table
  public.platform_admins,
  public.centers,
  public.users,
  public.center_memberships,
  public.professional_centers,
  public.professionals
from anon, authenticated;

grant select on table
  public.platform_admins,
  public.centers,
  public.users,
  public.center_memberships,
  public.professional_centers,
  public.professionals
to authenticated;

commit;
