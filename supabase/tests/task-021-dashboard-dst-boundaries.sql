-- Deterministic civil-day predicate check for New York's 23/25-hour days.
-- The production RPC clock is deliberately not injectable; this tests its
-- exact date predicate and conservative UTC bounds with fixed instants.
begin;
do $test$
declare
  d date;
  z text := 'America/New_York';
  day_start timestamptz;
  next_day timestamptz;
  lower_utc timestamptz;
  upper_utc timestamptz;
  included_ids text[];
  active_total bigint;
  cancelled_total bigint;
begin
  foreach d in array array['2026-03-08'::date, '2026-11-01'::date] loop
    day_start := d::timestamp at time zone z;
    next_day := (d+1)::timestamp at time zone z;
    lower_utc := (d::timestamp at time zone 'UTC') - interval '15 hours';
    upper_utc := ((d+1)::timestamp at time zone 'UTC') + interval '15 hours';

    with events(id, starts_at, status) as (
      values
        ('before', day_start - interval '1 microsecond', 'PENDING'),
        ('first', day_start, 'PENDING'),
        ('middle', day_start + interval '3 hours', 'CONFIRMED'),
        ('attended', next_day - interval '2 microseconds', 'ATTENDED'),
        ('last', next_day - interval '1 microsecond', 'NO_SHOW'),
        ('cancelled', day_start + interval '1 hour', 'CANCELLED'),
        ('next', next_day, 'PENDING')
    ), scoped as (
      select * from events
      where starts_at >= lower_utc and starts_at < upper_utc
        and (starts_at at time zone z)::date = d
    )
    select array_agg(id order by starts_at, id),
      count(*) filter (where status <> 'CANCELLED'),
      count(*) filter (where status = 'CANCELLED')
    into included_ids, active_total, cancelled_total from scoped;

    if included_ids is distinct from array[
        'first','cancelled','middle','attended','last'
      ]::text[]
      or active_total <> 4 or cancelled_total <> 1
      or (d = '2026-03-08' and next_day - day_start <> interval '23 hours')
      or (d = '2026-11-01' and next_day - day_start <> interval '25 hours') then
      raise exception 'TASK-021 DST day mismatch: %, IDs %, active %, cancelled %',
        d, included_ids, active_total, cancelled_total;
    end if;
  end loop;

  -- Both 01:30 wall-clock occurrences belong to the fall day; the UTC
  -- instants remain distinct and ordered for the upcoming list.
  if ('2026-11-01 01:30-04'::timestamptz at time zone z)::date <> '2026-11-01'::date
    or ('2026-11-01 01:30-05'::timestamptz at time zone z)::date <> '2026-11-01'::date
    or '2026-11-01 01:30-04'::timestamptz
       >= '2026-11-01 01:30-05'::timestamptz then
    raise exception 'TASK-021 repeated hour ordering mismatch';
  end if;
end;
$test$;
rollback;
