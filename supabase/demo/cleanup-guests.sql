-- DEMO ONLY. Preview the exact batch first. This file ends in ROLLBACK on purpose.
-- Change only the final ROLLBACK to COMMIT after checking the selected UUIDs.
begin;

do $guard$
begin
  if (select count(*) from public.centers) <> 1
    or not exists (select 1 from public.centers
      where id = 'd0000000-0000-4000-8000-000000000001'::uuid)
  then
    raise exception 'Cleanup is restricted to the single-center portfolio DEMO';
  end if;
end;
$guard$;

create temporary table portfolio_guest_cleanup_ids on commit drop as
select auth_user.id, auth_user.created_at
from auth.users as auth_user
join public.users as profile
  on profile.id = auth_user.id
 and profile.email = 'guest+' || auth_user.id::text || '@guest.salud-plus.invalid'
where auth_user.is_anonymous is true
  and auth_user.created_at < now() - interval '30 days'
  and exists (
    select 1 from public.center_memberships as membership
    where membership.user_id = auth_user.id
      and membership.center_id = 'd0000000-0000-4000-8000-000000000001'::uuid
      and membership.role = 'ADMIN'
  )
  and not exists (
    select 1 from public.center_memberships as membership
    where membership.user_id = auth_user.id
      and membership.center_id <> 'd0000000-0000-4000-8000-000000000001'::uuid
  )
  and not exists (
    select 1 from public.platform_admins as platform_admin
    where platform_admin.user_id = auth_user.id
  )
order by auth_user.created_at, auth_user.id
limit 100;

select id, created_at from portfolio_guest_cleanup_ids order by created_at, id;

-- FK order: center_memberships -> public.users -> auth.users.
delete from public.center_memberships as membership
using portfolio_guest_cleanup_ids as selected
where membership.user_id = selected.id
  and membership.center_id = 'd0000000-0000-4000-8000-000000000001'::uuid;

delete from public.users as profile
using portfolio_guest_cleanup_ids as selected
where profile.id = selected.id;

delete from auth.users as auth_user
using portfolio_guest_cleanup_ids as selected
where auth_user.id = selected.id and auth_user.is_anonymous is true;

-- Verify the three DELETE row counts equal the preview count before COMMIT.
rollback;
