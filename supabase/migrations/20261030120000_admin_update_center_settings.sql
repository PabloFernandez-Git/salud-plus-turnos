begin;

create function public.admin_update_center_settings(
  p_center_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_expected_updated_at timestamptz
)
returns table (
  center_id uuid,
  name text,
  phone text,
  email text,
  address text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center public.centers%rowtype;
  v_name text;
  v_phone text;
  v_email text;
  v_address text;
begin
  if auth.uid() is null or p_center_id is null then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('salud-plus:center:' || p_center_id::text, 0)
  );

  if not private.has_active_center_role(
    p_center_id,
    array['ADMIN']::public.membership_role[]
  ) then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  select center.* into v_center
  from public.centers as center
  where center.id = p_center_id and center.is_active
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'Center administration denied.';
  end if;

  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'Expected center version is required.';
  end if;

  if v_center.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'P0001', message = 'STALE_CENTER_SETTINGS';
  end if;

  v_name := pg_catalog.btrim(p_name);
  v_phone := nullif(pg_catalog.btrim(p_phone), '');
  v_email := nullif(pg_catalog.btrim(p_email), '');
  v_address := nullif(pg_catalog.btrim(p_address), '');

  if v_name is null or v_name = '' then
    raise exception using errcode = '22023', message = 'Center name is required.';
  end if;

  if v_email is not null and (
    v_email !~* '^[^[:space:]@]+@[[:alnum:]]+([[:alnum:]-]*[[:alnum:]])?(\.[[:alnum:]]+([[:alnum:]-]*[[:alnum:]])?)+$'
    or pg_catalog.split_part(v_email, '@', 1) like '.%'
    or pg_catalog.split_part(v_email, '@', 1) like '%.'
    or pg_catalog.split_part(v_email, '@', 1) like '%..%'
  ) then
    raise exception using errcode = '22023', message = 'Center email is invalid.';
  end if;

  if v_center.name is distinct from v_name
    or v_center.phone is distinct from v_phone
    or v_center.email is distinct from v_email
    or v_center.address is distinct from v_address
  then
    update public.centers as center
    set name = v_name, phone = v_phone, email = v_email, address = v_address
    where center.id = p_center_id
    returning center.* into v_center;
  end if;

  return query select
    v_center.id, v_center.name, v_center.phone, v_center.email,
    v_center.address, v_center.updated_at;
end;
$function$;

revoke all on function public.admin_update_center_settings(
  uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.admin_update_center_settings(
  uuid, text, text, text, text, timestamptz
) to authenticated;

commit;
