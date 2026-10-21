-- TASK-009 Gate D: run only in the SQL Editor of DEV ehllxymqyzrofydrvtzo.
-- Returns counts and digests of UUID inventories; no person/contact fields.
-- Capture once before fixtures and once after exact-ID cleanup.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT current_database() AS database_name,
       current_user AS database_role,
       current_setting('transaction_read_only') AS read_only;

WITH inventory AS (
  SELECT 'auth.users' AS resource, count(*) AS row_count,
         md5(coalesce(string_agg(id::text, ',' ORDER BY id), '')) AS id_digest
  FROM auth.users
  UNION ALL
  SELECT 'public.users', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.users
  UNION ALL
  SELECT 'public.platform_admins', count(*), md5(coalesce(string_agg(user_id::text, ',' ORDER BY user_id), ''))
  FROM public.platform_admins
  UNION ALL
  SELECT 'public.centers', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.centers
  UNION ALL
  SELECT 'public.center_memberships', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.center_memberships
  UNION ALL
  SELECT 'public.professionals', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.professionals
  UNION ALL
  SELECT 'public.professional_centers', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.professional_centers
  UNION ALL
  SELECT 'public.specialties', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.specialties
  UNION ALL
  SELECT 'public.professional_center_specialties', count(*),
         md5(coalesce(string_agg(
           professional_center_id::text || '/' || specialty_id::text,
           ',' ORDER BY professional_center_id, specialty_id
         ), ''))
  FROM public.professional_center_specialties
  UNION ALL
  SELECT 'public.availabilities', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.availabilities
  UNION ALL
  SELECT 'public.persons', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.persons
  UNION ALL
  SELECT 'public.patient_centers', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.patient_centers
  UNION ALL
  SELECT 'public.appointments', count(*), md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM public.appointments
  UNION ALL
  SELECT 'private.provisioning_operations', count(*),
         md5(coalesce(string_agg(id::text, ',' ORDER BY id), ''))
  FROM private.provisioning_operations
)
SELECT resource, row_count, id_digest FROM inventory ORDER BY resource;

ROLLBACK;
