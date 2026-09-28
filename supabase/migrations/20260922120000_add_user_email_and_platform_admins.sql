begin;

alter table public.users
add column email text;

do $migration$
begin
  if exists (
    select 1
    from public.users as app_user
    left join auth.users as auth_user on auth_user.id = app_user.id
    where auth_user.id is null
      or auth_user.email is null
      or btrim(auth_user.email) = ''
  ) then
    raise exception using
      errcode = '23514',
      message = 'Cannot backfill public.users.email: an application user has no usable Auth email.';
  end if;

  if exists (
    select lower(btrim(auth_user.email))
    from public.users as app_user
    join auth.users as auth_user on auth_user.id = app_user.id
    group by lower(btrim(auth_user.email))
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'Cannot backfill public.users.email: normalized Auth emails are not unique.';
  end if;
end;
$migration$;

update public.users as app_user
set email = lower(btrim(auth_user.email))
from auth.users as auth_user
where auth_user.id = app_user.id;

alter table public.users
  alter column email set not null,
  add constraint users_email_normalized_check check (
    email <> '' and email = lower(btrim(email))
  ),
  add constraint users_email_key unique (email);

create table public.platform_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now(),
  constraint platform_admins_user_fk
    foreign key (user_id) references public.users (id) on update restrict on delete restrict
);

alter table public.platform_admins enable row level security;

revoke all on table public.platform_admins from anon, authenticated;

commit;
