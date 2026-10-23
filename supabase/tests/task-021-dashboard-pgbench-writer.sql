-- Run concurrently with task-021-dashboard-pgbench-reader.sql.
update public.appointments
set status = (case when status = 'PENDING' then 'CONFIRMED' else 'PENDING' end)::public.appointment_status
where id = 'a2130000-0000-0000-0000-000000000071';
select pg_sleep(0.001);
