begin;

alter table public.appointments
drop constraint appointments_no_blocking_overlap;

alter table public.appointments
add constraint appointments_no_blocking_overlap
exclude using gist (
  professional_center_id with =,
  tstzrange(starts_at, ends_at, '[)') with &&
)
where (
  status in (
    'PENDING'::public.appointment_status,
    'CONFIRMED'::public.appointment_status,
    'ATTENDED'::public.appointment_status,
    'NO_SHOW'::public.appointment_status
  )
);

commit;
