-- Apply only to the independent portfolio DEMO project, after the 27 base migrations.
-- All authenticated accounts in this project are read-only at the database boundary.
-- The existing SELECT grants and tenant RLS policies remain in force.
revoke insert, update, delete, truncate, references, trigger
on all tables in schema public from public, anon, authenticated;

-- SECURITY DEFINER RPCs can bypass table grants and RLS. Remove every public
-- entry point, then grant only the audited read functions needed for the demo.
revoke all on all functions in schema public from public, anon, authenticated;

do $portfolio_demo$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
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
  loop
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$portfolio_demo$;

-- In particular, staff_resolve_patient_identity and
-- admin_resolve_professional_by_document cannot be called directly. Do not
-- re-grant them while this project serves the public portfolio demo.
