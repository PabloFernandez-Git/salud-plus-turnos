-- Run with pgbench inside the isolated TASK-021 PostgreSQL container.
-- Every RPC call is a separate READ COMMITTED statement.
select set_config('request.jwt.claim.sub', 'a2130000-0000-0000-0000-000000000011', false);
set role authenticated;
select 1 / case when
  r.pending_count + r.confirmed_count = 1
  and r.attended_count = 0 and r.no_show_count = 0 and r.cancelled_count = 0
  and jsonb_array_length(r.upcoming) = 1
  and r.upcoming->0->>'appointment_id' = 'a2130000-0000-0000-0000-000000000071'
  and r.upcoming->0->>'status' = case when r.pending_count = 1 then 'PENDING' else 'CONFIRMED' end
  and r.local_date = (r.as_of at time zone r.timezone)::date
  then 1 else 0 end as coherent_snapshot
from public.staff_get_daily_dashboard('a2130000-0000-0000-0000-000000000001') as r;
reset role;
