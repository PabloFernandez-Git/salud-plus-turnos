# TASK-021 — Procedimiento del gate PostgreSQL local pendiente

**Estado histórico:** procedimiento preparado antes de la autorización y ejecución. El gate se ejecutó el 2026-10-22 mediante contenedores PostgreSQL 17.6 exclusivos, con migrations aplicadas manualmente y pruebas por `docker exec`; no se usó `supabase start` ni `db reset`. El resultado real PASS, las diferencias del método, la evidencia y la limpieza están en [local-postgres-gate.md](local-postgres-gate.md). Los pasos inferiores quedan sólo como referencia previa, no como registro de lo ejecutado.

## Entorno aislado

Usar este worktree y una instancia Supabase **local nueva y desechable**, sin link remoto ni `.env.local` de DEV. La configuración local del gate usa `project_id = "task021-dashboard-sql-20261022"`, puerto PostgreSQL `55322` y puertos de servicios `55321`/`55323`/`55324`/`55327`; comprobar que están libres y no tocar el servidor Next.js. Confirmar con `git branch --show-current` que la rama es `codex/task-021-dashboard-sql` y con `git rev-parse origin/main` la base `6562fc708851d59d3324e79eca4124608b826994`.

En PowerShell, desde el worktree:

```powershell
pnpm install --frozen-lockfile
pnpm exec supabase init
pnpm exec supabase start
pnpm exec supabase status
pnpm exec supabase db reset --local
```

`supabase init` sólo se necesita si no existe `supabase/config.toml`; si se crea de nuevo, fijar el `project_id` y los puertos exclusivos anteriores **antes** de `start`. Verificar que `supabase/.temp/project-ref` no identifique un proyecto remoto antes de `db reset`. `db reset --local` reconstruye **únicamente la instancia local** a partir de las migrations del worktree. Si el CLI o Docker no están disponibles, detener el gate; no sustituir con `db push` ni con un proyecto remoto. La migration nueva es `20261022130000_add_daily_dashboard_rpcs.sql` y debe ser la última aplicada. No se necesita `pnpm bootstrap`: ese script exige `.env.local` y link DEV, deliberadamente ausentes aquí.

## Pruebas funcionales SQL

Ejecutar como `postgres` contra la URL **local** que muestra `supabase status`; comprobar host `127.0.0.1`, puerto `55322` y base `postgres` antes de escribir la contraseña.

```powershell
$env:PGPASSWORD = 'postgres'
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55322 -U postgres -d postgres -f supabase/tests/task-021-daily-dashboard.sql
Remove-Item Env:PGPASSWORD
```

La suite hace `BEGIN`/`ROLLBACK`. `ON_ERROR_STOP=1` es obligatorio: sin él, un error intermedio podría quedar oculto por el `ROLLBACK` final. Registrar código de salida, primera falla y ausencia de fixtures después del rollback. Ejecutar también la verificación de grants/RLS de las suites base si el gate local la exige. Ningún PASS PostgreSQL está registrado aún.

## EXPLAIN con volumen

Ejecutar en la misma instancia local aislada, como `postgres` y con `ON_ERROR_STOP=1`:

```powershell
$env:PGPASSWORD = 'postgres'
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55322 -U postgres -d postgres -f supabase/tests/task-021-dashboard-explain.sql
Remove-Item Env:PGPASSWORD
```

El script crea 100 ProfessionalCenters y 10.000 turnos en un día, hace `ANALYZE`, inspecciona el tiempo completo de la RPC y explica el núcleo de filtro/agregado con `BUFFERS`; después hace `ROLLBACK`. Guardar el plan y revisar filas filtradas, elección de índices, buffers, spills/sorts y latencia. `EXPLAIN` sobre la RPC sola muestra un `Function Scan`; el segundo `EXPLAIN` expone el plan del conjunto materializado. Repetir con cardinalidades reales esperadas si difieren sustancialmente de 10.000 turnos diarios. Proponer índices sólo tras esta medición.

## Concurrencia y límites de la evidencia

Preparar dos sesiones interactivas `psql -X -v ON_ERROR_STOP=1` contra la **misma** base local. Primero ejecutar `supabase/tests/task-021-dashboard-concurrency-setup.sql` como `postgres`; el archivo hace `COMMIT` de un fixture conocido. En sesión A:

```sql
begin isolation level repeatable read;
select set_config('request.jwt.claim.sub','a2130000-0000-0000-0000-000000000011',true);
set local role authenticated;
select pending_count, confirmed_count, upcoming
from public.staff_get_daily_dashboard('a2130000-0000-0000-0000-000000000001');
-- Pausar aquí: esperar commit de sesión B. Debe ser (1,0).
```

En sesión B:

```sql
begin;
update public.appointments set status = 'CONFIRMED'
where id = 'a2130000-0000-0000-0000-000000000071';
commit;
```

Volver a sesión A, aún en la misma transacción:

```sql
select pending_count, confirmed_count, upcoming
from public.staff_get_daily_dashboard('a2130000-0000-0000-0000-000000000001');
-- Debe seguir (1,0) y conservar la proyección PENDING.
commit;
select set_config('request.jwt.claim.sub','a2130000-0000-0000-0000-000000000011',false);
set role authenticated;
select pending_count, confirmed_count, upcoming
from public.staff_get_daily_dashboard('a2130000-0000-0000-0000-000000000001');
-- Debe ser (0,1), proyección CONFIRMED.
reset role;
```

Después, en B desactivar la membership exacta y confirmar la transacción. Una llamada nueva en A con el mismo JWT y `authenticated` debe devolver SQLSTATE `42501`; ejecutar esa llamada con `ON_ERROR_STOP` desactivado sólo para capturar el error esperado y volver a activarlo antes de continuar. Registrar ambas respuestas completas, `as_of` y SQLSTATE. Esta prueba `REPEATABLE READ` muestra snapshots entre transacciones, pero **no demuestra** la consistencia interna de una RPC bajo `READ COMMITTED`.

Para el escenario adversarial `READ COMMITTED`, volver a ejecutar el setup en una base local recién reseteada y correr `scripts/task021-dashboard-race.mjs` inmediatamente mientras el turno sigue en el futuro. Cotejar primero `supabase status` en este worktree y `docker ps` para confirmar que el puerto `55322` pertenece a la instancia Supabase desechable y no a un túnel. El script fija `127.0.0.1:55322/postgres`, llama 1.000 veces a la RPC como `authenticated` mientras otra sesión alterna `PENDING`/`CONFIRMED`, y exige que conteo y objeto `upcoming` correspondan al mismo estado en cada respuesta:

```powershell
$env:TASK021_LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
node scripts/task021-dashboard-race.mjs
Remove-Item Env:TASK021_LOCAL_DATABASE_URL
```

El resultado de estrés es evidencia adversarial, no una barrera determinista entre instrucciones internas. La garantía principal proviene de la semántica de snapshot de PostgreSQL para funciones `STABLE`, que también debe revisarse al ejecutar el gate. Al terminar, en esta base **desechable**, `pnpm exec supabase db reset --local` elimina el fixture comprometido. No ejecutar este procedimiento sobre un proyecto remoto.

La suite determinista cubre geometría DST de 23/25 horas y horas repetidas, pero el reloj de `statement_timestamp()` no es inyectable por contrato; una llamada RPC en un día DST real no queda reproducida mediante esa suite. La igualdad exacta `starts_at = as_of` se comprueba como predicado SQL determinista, mientras que el caso RPC de un turno previo y otro del día siguiente sí se prueba. El gate debe registrar esta limitación y, si se exige evidencia RPC en esos instantes, usar un PostgreSQL local con reloj del proceso controlado y documentar el método antes de atribuir PASS a esos casos.

## Cierre del gate

Guardar salidas de pruebas, planes, configuración local, versión PostgreSQL/Supabase y review. Sólo declarar PASS PostgreSQL si la migration aplica, las pruebas SQL y las carreras ejecutadas pasan, grants/RLS coinciden y los planes son aceptables. Detener la instancia Supabase local al terminar con `pnpm exec supabase stop` desde el mismo worktree.
