-- DEMO ONLY. Never apply to DEV, PROD, or the shared product schema rollout.
-- Install after 20261103120000_portfolio_demo_read_only.sql. Auth remains disabled
-- until the separate activation checklist has passed.
begin;

do $preflight$
declare
  unsafe_function regprocedure;
begin
  if (select count(*) from public.centers) <> 1
    or not exists (
      select 1 from public.centers
      where id = 'd0000000-0000-4000-8000-000000000001'::uuid and is_active
    ) then
    raise exception 'Portfolio guest migration requires the single active DEMO center';
  end if;

  if exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relkind in ('r', 'p')
      and (
        has_table_privilege('authenticated', relation.oid, 'INSERT')
        or has_table_privilege('authenticated', relation.oid, 'UPDATE')
        or has_table_privilege('authenticated', relation.oid, 'DELETE')
      )
  ) then
    raise exception 'Portfolio DEMO authenticated table writes must be revoked first';
  end if;

  select function.oid::regprocedure into unsafe_function
  from pg_proc as function
  join pg_namespace as namespace on namespace.oid = function.pronamespace
  where namespace.nspname = 'public'
    and function.proname <> all (array[
      'staff_search_patient_centers',
      'staff_list_patient_appointments',
      'staff_list_availability_professional_centers',
      'staff_list_bookable_specialties',
      'staff_bookable_professional_centers_for_specialty',
      'staff_search_appointment_slots',
      'staff_list_appointments',
      'staff_get_appointment',
      'staff_get_daily_dashboard'
    ])
    and has_function_privilege('authenticated', function.oid, 'EXECUTE')
  limit 1;
  if unsafe_function is not null then
    raise exception 'Unaudited DEMO RPC is executable: %', unsafe_function;
  end if;
end;
$preflight$;

-- Configure this as Authentication > Hooks > Before User Created in DEMO.
-- The hook rejects non-anonymous signup before Auth inserts a row. A separate
-- trigger below also rejects it if the hook was accidentally left disabled.
create function public.portfolio_allow_anonymous_signup(event jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select case
    when event->'user'->>'is_anonymous' = 'true'
      and nullif(event->'user'->>'email', '') is null
      and nullif(event->'user'->>'phone', '') is null
    then '{}'::jsonb
    else jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only anonymous DEMO signups are allowed.'
    ))
  end;
$function$;

revoke all on function public.portfolio_allow_anonymous_signup(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.portfolio_allow_anonymous_signup(jsonb)
to supabase_auth_admin;

create function private.portfolio_provision_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.is_anonymous is distinct from true then
    raise exception 'Non-anonymous signup is disabled in portfolio DEMO';
  end if;
  if new.email is not null or nullif(new.phone, '') is not null then
    raise exception 'Anonymous DEMO signup cannot include contact identity';
  end if;

  -- Serializes the project-wide hard cap, including concurrent Auth signups.
  perform pg_catalog.pg_advisory_xact_lock(20261103, 130000);
  if (select count(*) from auth.users where is_anonymous) > 500 then
    raise exception 'Portfolio DEMO guest capacity reached';
  end if;

  if not exists (
    select 1 from public.centers
    where id = 'd0000000-0000-4000-8000-000000000001'::uuid and is_active
  ) then
    raise exception 'Portfolio DEMO center is unavailable';
  end if;

  -- Auth anonymous users have NULL email. This synthetic, non-deliverable
  -- address satisfies DEMO's existing public.users constraint only.
  insert into public.users (id, email, first_name, last_name)
  values (new.id, 'guest+' || new.id::text || '@guest.salud-plus.invalid',
    'Visitante', 'Demo');
  insert into public.center_memberships (center_id, user_id, role)
  values ('d0000000-0000-4000-8000-000000000001'::uuid, new.id, 'ADMIN');
  return new;
end;
$function$;

revoke all on function private.portfolio_provision_guest()
from public, anon, authenticated, service_role;
create trigger portfolio_provision_guest_after_auth_insert
after insert on auth.users
for each row execute function private.portfolio_provision_guest();

-- The synthetic DEMO profile remains a guest marker even if Auth later links
-- an identity and changes the JWT's is_anonymous claim.
create function private.portfolio_is_guest()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.users as profile
    where profile.id = (select auth.uid())
      and profile.email = 'guest+' || profile.id::text || '@guest.salud-plus.invalid'
  );
$function$;
revoke all on function private.portfolio_is_guest()
from public, anon, authenticated, service_role;
grant execute on function private.portfolio_is_guest() to authenticated;

-- Existing ADMIN policies are permissive. These restrictive policies ensure
-- guest JWTs can read only their own identity/membership, while all other
-- DEMO read policies and the nine audited read RPCs stay intact.
create policy portfolio_guests_users_self_only
on public.users as restrictive for select to authenticated
using (
  (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
    or (select private.portfolio_is_guest())) is false
  or id = (select auth.uid())
);

create policy portfolio_guests_membership_self_only
on public.center_memberships as restrictive for select to authenticated
using (
  (coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false)
    or (select private.portfolio_is_guest())) is false
  or (user_id = (select auth.uid())
      and center_id = 'd0000000-0000-4000-8000-000000000001'::uuid)
);

commit;
