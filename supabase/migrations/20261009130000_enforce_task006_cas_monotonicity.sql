create function private.set_task006_cas_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := greatest(
    pg_catalog.clock_timestamp(),
    old.updated_at + interval '1 microsecond'
  );
  return new;
end;
$function$;

revoke all on function private.set_task006_cas_updated_at()
from public, anon, authenticated;

drop trigger specialties_set_updated_at on public.specialties;
create trigger specialties_set_updated_at
before update on public.specialties
for each row execute function private.set_task006_cas_updated_at();

drop trigger professional_centers_set_updated_at on public.professional_centers;
create trigger professional_centers_set_updated_at
before update on public.professional_centers
for each row execute function private.set_task006_cas_updated_at();
