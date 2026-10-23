-- Local, disposable concurrency fixture only; run after read/write race.
begin;
update public.center_memberships set is_active = false
where center_id = 'a2130000-0000-0000-0000-000000000001'
  and user_id = 'a2130000-0000-0000-0000-000000000011';
commit;

select set_config('request.jwt.claim.sub', 'a2130000-0000-0000-0000-000000000011', false);
set role authenticated;
do $test$
begin
  begin
    perform * from public.staff_get_daily_dashboard('a2130000-0000-0000-0000-000000000001');
    raise exception 'Revoked membership retained dashboard access';
  exception when insufficient_privilege then
    raise notice 'Expected SQLSTATE 42501 after committed revocation';
  end;
end;
$test$;
reset role;
