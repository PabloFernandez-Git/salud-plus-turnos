# TASK-009 — Gate D — Supabase DEV read-only preflight

## Cierre de verificación estructural POST — 2026-10-20

**Veredicto: PASS estructural POST, según consultas manuales del usuario en el Dashboard de Supabase DEV** `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`). Codex no realizó consultas remotas ni ejecutó `verify.mjs` contra DEV. En la captura nueva el usuario informó `applied_migrations=23`, `rpc_signature_count=1`, las **23 versiones exactas en el orden aprobado** (última `20261019170000`), la única firma `staff_search_appointment_slots(uuid,uuid,uuid,date)` y el retorno de seis columnas `TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone, local_date date, local_start_time text, local_end_date date, local_end_time text)`. El inventario local contiene esas 23 migrations en ese orden y termina en el mismo archivo; la lista remota completa no fue pegada en este turno, por lo que la coincidencia individual se registra como resultado comunicado por el usuario, no como cotejo independiente de Codex.

La captura POST manual anterior ya había informado la migration civil una sola vez, owner `postgres`, `SECURITY DEFINER=true`, `search_path=""`, ACL `{postgres=X/postgres,authenticated=X/postgres}` sin `*` de GRANT OPTION, `authenticated` con EXECUTE y `anon`/`service_role` sin EXECUTE. Juntas, ambas capturas satisfacen **los dos huecos estructurales POST previamente identificados** y el contrato aprobado de la función. El PRE manual completo había acreditado el perfil ACL `dev-hosted`, default ACL, las rutas y RLS; la migration sólo recreó este RPC y sus grants. No hay evidencia positiva de drift material en lo comunicado. No se afirma que el CLI del push haya preservado o renovado `cli_login_postgres`: su fotografía POST no fue comunicada y la variación administrada de su vigencia no invalida por sí sola el contrato RPC.

Este PASS **no** cubre dry-run vacío, DB lint final, invocación funcional del RPC con Auth real, privacidad/RLS bajo sesiones normales, tzdata/DST, carreras, cliente/navegador ni inventario y cleanup de fixtures. Gate D y TASK-009 continúan abiertos. La propuesta de autorización para la siguiente etapa está en `gate-d-integration-authorization.md`; no se ejecutó ninguna escritura o prueba integrada aquí.

## Checkpoint POST anterior — 2026-10-20 (histórico)

**Estado entonces:** migration civil aplicada por el usuario a `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`); verificación POST aún **parcial** en ese checkpoint. Gate D continúa abierto. El paquete de autorización PRE que sigue es histórico: la autorización de esta migration ya fue otorgada y ejercida por el usuario; no volver a aplicarla.

**Procedencia y alcance:** el usuario informó que comprobó ref, SHA-256 aprobado y dry-run con una sola migration; ejecutó desde PowerShell Supabase CLI 2.117.0, que mostró `Applying migration 20261019170000_add_appointment_slot_civil_time.sql...` y `Finished supabase db push`. El SHA-256 del archivo local sigue siendo `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898` (recalculado en este checkpoint). Codex no ejecutó el push ni verificó de forma independiente el log o el mecanismo de credenciales de esa sesión CLI. No se infiere que el flujo CLI haya preservado o alterado `cli_login_postgres`.

El usuario también comunicó una consulta **manual** de catálogo en el SQL Editor de DEV, bajo transacción `READ ONLY`. Informó `applied_migrations=23`, `civil_migration_count=1`, owner `postgres`, `SECURITY DEFINER=true`, `search_path=""`, ACL textual `{postgres=X/postgres,authenticated=X/postgres}`, EXECUTE efectivo para `authenticated` y no para `anon`/`service_role`. El retorno comunicado es `TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone, local_date date, local_start_time text, local_end_date date, local_end_time text)`. Estos datos son evidencia POST aportada por el usuario; no equivalen a una corrida independiente de `verify.mjs --dev` ni a una llamada funcional RPC.

**Verificación POST mínima todavía necesaria:** una captura de metadatos de sólo lectura que entregue la **lista ordenada** de versiones aplicadas para cotejarla con los 23 archivos aprobados (el conteo 23 más una versión civil no excluye sustituciones), y todas las filas de `pg_proc` con nombre `public.staff_search_appointment_slots` para confirmar que existe **sólo** la firma aprobada, con el retorno de seis columnas. La ACL textual informada ya acredita el conjunto directo sin `*` de GRANT OPTION; owner, `SECURITY DEFINER`, `search_path` y EXECUTE efectivo ya fueron capturados. La migration sólo hace `DROP/CREATE/REVOKE/GRANT` sobre ese RPC, por lo que no se repite el inventario PRE completo de tablas/RLS/default ACL/roles sin indicio de drift. Como el mecanismo de credenciales del push no quedó acreditado, registrar en la misma captura `cli_login_postgres` y su arista a `postgres` permite clasificar una eventual renovación como variación administrada, sin asumir eliminación por vencimiento ni convertirla automáticamente en drift de seguridad.

**Procedimiento:** SQL Editor del proyecto/ref exacto, con `BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='5s';` y sólo SELECT de `supabase_migrations.schema_migrations`, `pg_proc`/`pg_namespace`/`pg_roles`/`pg_auth_members`; comprobar `current_database()='postgres'` y `current_setting('transaction_read_only')='on'`; terminar con `ROLLBACK`. Exportar la lista de versiones, el conjunto de firmas/retornos y la fila/arista CLI sin secretos ni datos de pacientes. Comparar localmente con `supabase/migrations/` y el perfil `dev-hosted`. No usar automáticamente la vía CLI sin contraseña para esta lectura. `db push --dry-run` vacío y `db lint` siguen exigidos para el cierre Gate D, pero se harán sólo mediante conexión acreditada que no aprovisione roles, o una vía manual equivalente documentada. La continuidad del cliente, Auth/RLS/RPC real, tzdata, carreras, navegador y cleanup requieren la fase de integración y autorización propia para fixtures.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT current_database() AS database_name, current_user AS db_user,
       current_setting('transaction_read_only') AS read_only;
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT p.oid::regprocedure::text AS signature,
       pg_get_function_result(p.oid) AS result_type
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'staff_search_appointment_slots'
ORDER BY signature;
SELECT r.rolname, r.rolcanlogin, r.rolvaliduntil,
       m.roleid::regrole::text AS granted_role,
       m.grantor::regrole::text AS grantor,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_roles AS r
LEFT JOIN pg_auth_members AS m ON m.member = r.oid
WHERE r.rolname = 'cli_login_postgres';
ROLLBACK;
```

**Siguiente frontera:** preparar inventario y plan de fixtures aislados; solicitar autorización humana separada antes de cualquier alta/cambio/borrado en DEV. No crear fixtures, ejecutar integración/Playwright ni declarar Gate D PASS en este checkpoint. Los reviews independientes de `review.md` conservan sus veredictos y alcances.

**Checkpoint PRE histórico (2026-10-19/20):** `PASS — DEV READ-ONLY METADATA PREFLIGHT`. La solicitud de autorización de la migration preparada abajo ya fue satisfecha; conservarla sólo como registro de la decisión previa.

> **Aclaración de procedimiento (2026-10-20):** las consultas PostgreSQL directas de este preflight sí estuvieron dentro de una transacción `READ ONLY`. Sin embargo, las credenciales de conexión se obtuvieron por el flujo CLI sin contraseña; [Supabase documenta](https://supabase.com/docs/reference/api/v1-create-login-role) que éste puede crear o renovar `cli_login_postgres` mediante API POST con permiso `database:write`. Por ello las frases de este informe que califican al procedimiento completo como de lectura no acreditan ausencia de efectos sobre roles. No repetir ese flujo para una captura estrictamente read-only. Usar una credencial DEV preexistente obtenida sin aprovisionamiento, verificar proyecto/ref/host/usuario/base, consultar sólo metadatos en `BEGIN READ ONLY` con timeout y cerrar con `ROLLBACK`; si no existe esa vía, dejar la captura bloqueada o solicitar autorización separada para el efecto administrado.

## Dictamen sobre la captura manual íntegra — 2026-10-20

**Procedencia:** el usuario pegó el JSON íntegro exportado del bloque SQL preparado en el checkpoint anterior y ejecutado manualmente en el SQL Editor de `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`). Codex cotejó ese contenido con `verifyCatalog(..., 'dev-hosted')` y el inventario local; **no ejecutó consultas contra DEV**. Según el procedimiento comunicado, el bloque usó `BEGIN TRANSACTION READ ONLY`, `SET LOCAL statement_timeout='5s'` y `ROLLBACK`. El JSON confirma base `postgres`, usuario `postgres`, PostgreSQL `17.6`, `transaction_read_only=on` y timeout `5s`. Esta vía satisface la lectura manual de metadatos sin el flujo CLI que puede aprovisionar roles; no representa una conexión automatizada.

| Condición | Cotejo del JSON recibido |
| --- | --- |
| Migraciones | Las **22 versiones**, una a una y en orden, coinciden con las primeras 22 de los 23 archivos locales aprobados; no hay extra ni hueco. Sólo falta `20261019170000_add_appointment_slot_civil_time.sql`. |
| RPC PRE y dependencias | Una sola firma `staff_search_appointment_slots(uuid,uuid,uuid,date)`, retorno PRE de dos `timestamptz`, owner `postgres`, `SECURITY DEFINER=true`, `proconfig=['search_path=""']`. La captura manual específica anterior informó cero dependencias entrantes; el JSON nuevo no repitió ese dato. Las **once** firmas de Appointments coinciden exactamente con `expectedAppointmentRpcs`, sin sobrecarga inesperada. |
| EXECUTE y defaults | `proacl={postgres=X/postgres,authenticated=X/postgres}`; `aclexplode` devuelve sólo esos dos grantees con `grantable=false`. Su orden en el JSON sigue los OID y no altera el conjunto. `authenticated=true`, `anon=false`, `service_role=false`; PUBLIC ausente. Default ACL de función para owner `postgres` en `public`: sólo `postgres`. La ACL más amplia de `supabase_admin` pertenece a otro owner y no se aplica a la recreación prevista como `postgres`. |
| Roles y rutas | Los cuatro roles de infraestructura cumplen los atributos/rutas que exige `dev-hosted`: LOGIN esperado, `SUPERUSER=false`, `BYPASSRLS=false`, `INHERIT=false`, `USAGE(authenticated)=false`, `SET(authenticated)=true`. Las **ocho** aristas salientes esperadas de infraestructura son exactamente las capturadas, todas con grantor `supabase_admin`, `ADMIN=false`, `INHERIT=false`, `SET=true`; la novena, `postgres→authenticated`, tiene `ADMIN=true`, `INHERIT=true`, `SET=true`. En las aristas de infraestructura `USAGE` del rol concedido es false y `SET` true. No hay `USAGE` ni `SET authenticated` inesperados en el barrido global; `anon` y `service_role` carecen de ambos caminos. Único superusuario: `supabase_admin`. |
| Atributos adicionales | `rolcreatedb=false` y `rolreplication=false` en los cuatro. `rolcreaterole=false` en Authenticator, Realtime y CLI; `supabase_storage_admin` devuelve `rolcreaterole=true`. Ese atributo no forma parte de la comparación cerrada del verificador, no se había medido en el PRE anterior y no demuestra un cambio del RPC ni una ruta nueva; se registra como capacidad de infraestructura, sin atribuirle ausencia histórica. `rolvaliduntil` es NULL salvo en CLI. |
| RLS | Las siete tablas inspeccionadas tienen RLS habilitada y `FORCE=false`. `appointments` conserva cero policies, `anon_select=false` y `authenticated_table_access=false`. Las otras seis conservan una policy `SELECT` tenant para `authenticated` cada una, con nombres y expresiones acordes al PRE. Su `authenticated_table_access=true` proviene de `has_table_privilege('SELECT,INSERT,UPDATE,DELETE')`, que sólo indica **algún** privilegio entre esos cuatro; no demuestra cuáles individualmente y no se presenta como prueba de DML. |

`cli_login_postgres` sigue **presente** en `pg_roles` y conserva su membresía única a `postgres`, aunque `rolvaliduntil` es `2026-10-19 23:54:11.885443+00`. Según [PostgreSQL 17](https://www.postgresql.org/docs/17/catalog-pg-authid.html), ese campo vence la contraseña para autenticación por password; no elimina el rol ni sus membresías. Por ello el cotejo usa el rol y las rutas efectivamente capturadas, sin asumir desaparición ni renovación. `supabase_storage_admin` con `CREATEROLE=true` queda registrado como capacidad administrada en esta fotografía; sin evidencia de novedad o efecto sobre el contrato, no crea un bloqueo nuevo.

**Veredicto: PASS del preflight de metadatos PRE en DEV, según evidencia manual suministrada por el usuario.** Identidad, lectura transaccional, paridad exacta, contrato/ACL/dependencias del RPC, perfil `dev-hosted`, default ACL y RLS no muestran drift material. `pnpm bootstrap` y `verify.mjs --local` pasaron; SHA-256 actual del verificador `7BE82EAC9AD81B991562F595B2A357463855C1A4B9756CB8221387728497B97D` y del SQL `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`. Este PASS no es ejecución independiente del perfil contra DEV ni certifica catálogo POST, Auth/RPC funcional, fixtures, carreras o navegador. Gate D y TASK-009 siguen abiertos.

### Paquete preparado para autorización humana de la única migration pendiente

- **Destino:** sólo Supabase DEV `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, base `postgres`; nunca PROD. Reconfirmar identidad inmediatamente antes de escribir.
- **Artefacto:** `supabase/migrations/20261019170000_add_appointment_slot_civil_time.sql`, SHA-256 `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`. Se espera pasar el ledger de 22 a 23 con ésta como única versión nueva.
- **Alcance SQL:** dentro de `BEGIN`/`COMMIT`, `DROP` y `CREATE` de `public.staff_search_appointment_slots(uuid,uuid,uuid,date)` para ampliar el retorno de dos a seis columnas civiles; `REVOKE` a PUBLIC/anon/authenticated/service_role y `GRANT EXECUTE` sólo a authenticated. No incluye fixtures ni cambios de roles, tablas o policies.
- **Comando propuesto, no ejecutado:** obtener por canal seguro una contraseña PostgreSQL DEV **preexistente** y acreditada; usar `SUPABASE_DB_PASSWORD` para la vía CLI con password, sin aprovisionamiento passwordless. Reconfirmar ref/host/base y ejecutar primero `pnpm exec supabase db push --linked --dry-run --skip-vault`. Sólo si muestra **exactamente** esa migration y existe autorización humana específica, ejecutar `pnpm exec supabase db push --linked --skip-vault`, sin `--include-seed`, `--include-roles` o `--include-all`. [Supabase documenta](https://supabase.com/docs/guides/troubleshooting/supabase-cli-failed-sasl-auth-or-invalid-scram-server-final-message) la autenticación mediante `SUPABASE_DB_PASSWORD` y [su referencia](https://supabase.com/docs/reference/cli/supabase-test-db) describe `db push` y `--dry-run`. Si no hay credencial existente o el CLI intenta passwordless, **detenerse**; este PASS no autoriza crear o renovar roles.
- **Riesgos:** sustitución `DROP/CREATE` del RPC consumido por clientes, incompatibilidad temporal entre retorno PRE y cliente de seis columnas y fallo remoto cuya fase de commit debe determinarse. Coordinar cliente y DB. No renovar el rol CLI vencido por iniciativa del agente.
- **Comprobaciones posteriores:** ledger 23/23 y dry-run vacío; firma única con seis columnas en nombre/tipo/orden; owner `postgres`, `SECURITY DEFINER`, `search_path=''`, ACL EXECUTE exacta sin PUBLIC/anon/service_role/GRANT OPTION; rutas y RLS sin drift; lint y smoke read-only con sesión normal en fase autorizada. Sólo después considerar fixtures, integración y Playwright bajo autorizaciones propias.
- **Recuperación:** si falla antes de `COMMIT`, confirmar ledger aún 22 y RPC PRE intacta tras rollback antes de reintentar. Si hubo commit o estado incierto, detener pruebas y tráfico dependiente, leer ledger y catálogo; no repetir a ciegas. Reparación forward o restauración del contrato anterior requiere nueva migration revisada y nueva autorización.

**Estado de la propuesta:** preparada para revisión y autorización humana **separada** de este PASS. No se solicitó ni ejerció autorización de escritura en este checkpoint. No se ejecutaron migration, fixtures, integración, Playwright, commit o push; no se modificaron roles/ACL/RLS ni se accedió a PROD.

> Las secciones siguientes conservan checkpoints históricos; sus veredictos `BLOCKED` quedaron superados sólo para el preflight PRE por el dictamen anterior.

## Checkpoint anterior: consolidación de consultas manuales del SQL Editor — 2026-10-20

**Procedencia:** resultados comunicados por el usuario tras ejecutar consultas manuales en `https://supabase.com/dashboard/project/ehllxymqyzrofydrvtzo/sql/new`, proyecto mostrado `salud-plus-turnos-dev`. No son consultas ejecutadas ni verificadas independientemente por Codex. Según el procedimiento comunicado, cada bloque usó `BEGIN TRANSACTION READ ONLY`, `SET LOCAL statement_timeout = '5s'`, SELECT de catálogos y `ROLLBACK`; la sesión devolvió base `postgres`, usuario `postgres`, PostgreSQL `17.6` y `transaction_read_only=on`. Esta vía acredita lectura no mutante **para los SQL comunicados** y resuelve la falta de contraseña para el alcance manual del preflight; no equivale a una conexión PostgreSQL automatizada y no utilizó el flujo CLI que puede aprovisionar `cli_login_postgres`.

**Paridad exacta:** se cotejaron las 22 versiones remotas suministradas, una a una y en orden, con los primeros 22 nombres de `supabase/migrations/` y `expectedMigrations` del verificador local: **22/22 coincidencias**, sin versión remota extra ni hueco. El inventario local tiene 23 archivos; únicamente `20261019170000_add_appointment_slot_civil_time.sql` queda pendiente. La consulta manual al ledger también devolvió 22 aplicadas y `civil_time_migration_applied=false`. SHA-256 local de la pendiente: `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`. `pnpm bootstrap` pasó y confirmó el ref DEV enlazado. El dry-run CLI previo es histórico; no se repitió mediante el flujo cuestionado.

**Catálogo actualmente acreditado por el usuario:** `public.staff_search_appointment_slots(uuid,uuid,uuid,date)` conserva `TABLE(starts_at timestamptz, ends_at timestamptz)`, owner `postgres`, `SECURITY DEFINER` y ACL textual `{postgres=X/postgres,authenticated=X/postgres}`; EXECUTE efectivo: `authenticated=true`, `anon=false`, `service_role=false`. Las otras funciones de Appointments consultadas mostraron la misma política. La consulta de dependencias devolvió `rpc_found=true`, cero dependencias entrantes y lista vacía. Éstos son datos PRE; las seis columnas, ACL y comportamiento POST sólo podrán comprobarse después de una migration expresamente autorizada.

**ACL hospedada, compatibilidad parcial:** están presentes los seis roles reportados (`authenticated`, `authenticator`, `postgres`, `supabase_storage_admin`, `supabase_realtime_admin`, `cli_login_postgres`). Para CLI se comunicó `LOGIN=true`, `INHERIT=false`, `SUPERUSER=false`, `CREATEROLE=false`, `BYPASSRLS=false`; para Realtime, los mismos valores salvo `LOGIN=false`. Las aristas comunicadas tienen grantor `supabase_admin`: CLI→postgres (`SET=true`, `INHERIT=false`, `ADMIN=false`), postgres→authenticated (`SET=true`, `INHERIT=true`, `ADMIN=true`), Realtime→anon/authenticated/service_role, Storage→authenticator y authenticator→authenticated (las últimas cinco con `SET=true`, `INHERIT=false`, `ADMIN=false`). `pg_has_role` indicó capacidad SET sin herencia inmediata en los casos reportados. Todo ello **coincide con las rutas permitidas** por el perfil `dev-hosted` aprobado localmente; `cli_login_postgres` es opcional en ese perfil. Las consultas parciales no prueban que éstas sean todas las aristas salientes de infraestructura, que no haya otro rol con `USAGE`/`SET authenticated`, ni que sólo exista el superuser aprobado. Tampoco se comunicaron `rolcreatedb`, `rolreplication` y `rolvaliduntil`, ni todas las aristas de `authenticator`.

**Evidencia útil anterior, sin recaptura actual:** RLS habilitada y cero policies de `appointments`, RLS/policies de las seis tablas de contexto, `search_path=''` de la RPC, default ACL, extensiones/tzdata, health/lint y dry-run con sólo la migration civil pendiente fueron registrados en el PRE anterior. El acceso CLI usado para parte de ese PRE no acredita lectura no mutante de extremo a extremo; sus observaciones de catálogo sirven como comparación histórica, no como sustituto de la captura manual actual. No hay indicio positivo de drift de seguridad; tampoco se puede declarar aún PASS del perfil hospedado con muestras parciales.

**Evidencia indispensable restante para cerrar este preflight:** una sola captura manual, dentro de la transacción de lectura del SQL Editor, de los atributos completos de roles de infraestructura, **todas** sus aristas salientes y grantors/opciones, superusers y rutas globales `USAGE`/`SET` hacia `authenticated`, ACL/`search_path`/sobrecargas del RPC, default ACL de funciones y RLS/policies relevantes. El bloque siguiente también reidentifica sesión y versiones para que el resultado sea una fotografía coherente. Ningún resultado de este bloque se presume antes de que el usuario lo ejecute y comparta. No se pide otra implementación ni otro review general.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '5s';

WITH
infra AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.rolname), '[]'::jsonb) AS v
  FROM (
    SELECT r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper,
           r.rolcreaterole, r.rolcreatedb, r.rolreplication,
           r.rolbypassrls, r.rolvaliduntil::text AS rolvaliduntil,
           pg_has_role(r.oid, 'authenticated'::regrole, 'USAGE') AS usage_authenticated,
           pg_has_role(r.oid, 'authenticated'::regrole, 'SET') AS set_authenticated
    FROM pg_roles r
    WHERE r.rolname IN ('authenticator', 'supabase_storage_admin',
                        'supabase_realtime_admin', 'cli_login_postgres')
  ) x
),
edges AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.member, x.granted_role), '[]'::jsonb) AS v
  FROM (
    SELECT m.rolname AS member, p.rolname AS granted_role, g.rolname AS grantor,
           a.admin_option, a.inherit_option, a.set_option,
           pg_has_role(m.oid, p.oid, 'USAGE') AS usage_granted_role,
           pg_has_role(m.oid, p.oid, 'SET') AS set_granted_role
    FROM pg_auth_members a
    JOIN pg_roles m ON m.oid = a.member
    JOIN pg_roles p ON p.oid = a.roleid
    JOIN pg_roles g ON g.oid = a.grantor
    WHERE m.rolname IN ('authenticator', 'supabase_storage_admin',
                        'supabase_realtime_admin', 'cli_login_postgres')
       OR (m.rolname = 'postgres' AND p.rolname = 'authenticated')
  ) x
),
paths AS (
  SELECT jsonb_build_object(
    'unexpected_usage', (
      SELECT COALESCE(jsonb_agg(r.rolname ORDER BY r.rolname), '[]'::jsonb)
      FROM pg_roles r
      WHERE NOT r.rolsuper AND r.rolname NOT IN ('postgres', 'authenticated')
        AND pg_has_role(r.oid, 'authenticated'::regrole, 'USAGE')
    ),
    'unexpected_set', (
      SELECT COALESCE(jsonb_agg(r.rolname ORDER BY r.rolname), '[]'::jsonb)
      FROM pg_roles r
      WHERE NOT r.rolsuper
        AND r.rolname NOT IN ('postgres', 'authenticated', 'authenticator',
                              'supabase_storage_admin', 'supabase_realtime_admin',
                              'cli_login_postgres')
        AND pg_has_role(r.oid, 'authenticated'::regrole, 'SET')
    ),
    'client_paths', (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.rolname), '[]'::jsonb)
      FROM (
        SELECT r.rolname, r.rolsuper,
               pg_has_role(r.oid, 'authenticated'::regrole, 'USAGE') AS usage_authenticated,
               pg_has_role(r.oid, 'authenticated'::regrole, 'SET') AS set_authenticated
        FROM pg_roles r WHERE r.rolname IN ('anon', 'service_role')
      ) x
    ),
    'superusers', (
      SELECT COALESCE(jsonb_agg(r.rolname ORDER BY r.rolname), '[]'::jsonb)
      FROM pg_roles r WHERE r.rolsuper
    )
  ) AS v
),
rpc AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.signature), '[]'::jsonb) AS v
  FROM (
    SELECT p.oid::regprocedure::text AS signature,
           pg_get_function_result(p.oid) AS result_type,
           pg_get_userbyid(p.proowner) AS owner,
           p.prosecdef AS security_definer, p.proconfig,
           p.proacl::text AS acl,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
           has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'grantee', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                     ELSE pg_get_userbyid(a.grantee) END,
                     'grantable', a.is_grantable
                   ) ORDER BY a.grantee), '[]'::jsonb)
            FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
            WHERE a.privilege_type = 'EXECUTE') AS execute_acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'staff_search_appointment_slots'
  ) x
),
signatures AS (
  SELECT COALESCE(jsonb_agg(p.oid::regprocedure::text
                             ORDER BY p.oid::regprocedure::text), '[]'::jsonb) AS v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE '%appointment%' OR p.proname LIKE 'staff_list_bookable_%'
         OR p.proname = 'staff_bookable_professional_centers_for_specialty')
    AND p.proname <> 'staff_update_usual_appointment_duration'
),
function_defaults AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.owner, x.schema_name), '[]'::jsonb) AS v
  FROM (
    SELECT pg_get_userbyid(d.defaclrole) AS owner,
           COALESCE(n.nspname, '<global>') AS schema_name,
           d.defaclacl::text AS acl
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
    WHERE d.defaclobjtype = 'f' AND (n.nspname = 'public' OR d.defaclnamespace = 0)
  ) x
),
rls AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.table_name), '[]'::jsonb) AS v
  FROM (
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
           c.relforcerowsecurity AS rls_forced,
           has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE')
             AS authenticated_table_access,
           has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'name', pol.policyname, 'command', pol.cmd, 'roles', pol.roles,
                     'permissive', pol.permissive,
                     'qual', pol.qual, 'with_check', pol.with_check
                   ) ORDER BY pol.policyname), '[]'::jsonb)
            FROM pg_policies pol
            WHERE pol.schemaname = 'public' AND pol.tablename = c.relname) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname IN ('appointments', 'centers', 'center_memberships',
                        'patient_centers', 'professional_centers',
                        'specialties', 'availabilities')
  ) x
),
migrations AS (
  SELECT COALESCE(jsonb_agg(version ORDER BY version), '[]'::jsonb) AS v
  FROM supabase_migrations.schema_migrations
)
SELECT jsonb_pretty(jsonb_build_object(
  'identity', jsonb_build_object(
    'database', current_database(), 'user', current_user,
    'read_only', current_setting('transaction_read_only'),
    'timeout', current_setting('statement_timeout'),
    'server_version', current_setting('server_version')
  ),
  'migrations', migrations.v, 'infrastructure_roles', infra.v,
  'infrastructure_edges', edges.v, 'role_paths', paths.v,
  'slot_rpc', rpc.v, 'appointment_rpc_signatures', signatures.v,
  'default_function_acl', function_defaults.v,
  'rls', rls.v
)) AS gate_d_metadata
FROM migrations CROSS JOIN infra CROSS JOIN edges CROSS JOIN paths
                CROSS JOIN rpc CROSS JOIN signatures CROSS JOIN function_defaults
                CROSS JOIN rls;

ROLLBACK;
```

**Resultado de ese checkpoint:** `TASK-009 GATE D DEV READ-ONLY PREFLIGHT BLOCKED — METADATA SNAPSHOT REQUIRED`. Tras comparar ese único resultado con el perfil aprobado, si no hay drift material, el preflight podrá quedar listo para **solicitar** autorización humana de aplicar únicamente la migration civil a `ehllxymqyzrofydrvtzo`; no se aplicará por efecto del preflight. La integración Auth/RPC, fixtures, carreras, Playwright, catálogo POST y cleanup pertenecen a pasos posteriores expresamente autorizados. TASK-009 continúa activa.

## Checkpoint anterior: reanudación del preflight — 2026-10-20

**Resultado: BLOCKED por falta de credencial PostgreSQL DEV preexistente y acreditada.** El review SQL/security independiente desde la línea 502 de `review.md` da `PASS — DEV INFRASTRUCTURE ACL REMEDIATION` al perfil `dev-hosted` y a sus pruebas locales. Este PASS no valida el catálogo DEV actual. `pnpm bootstrap` pasó y confirmó la configuración de desarrollo y el enlace al ref autorizado `ehllxymqyzrofydrvtzo`.

**Método investigado.** Existe una URL local del pooler en `supabase/.temp/pooler-url`: esquema PostgreSQL, host `aws-0-sa-east-1.pooler.supabase.com`, puerto `5432`, base `postgres`, usuario `postgres.ehllxymqyzrofydrvtzo`. No contiene contraseña. La conexión directa esperada por el procedimiento previo usa `db.ehllxymqyzrofydrvtzo.supabase.co` y base `postgres`; su contraseña anterior provino de `supabase db dump --linked --dry-run` y no tiene origen no aprovisionador acreditado. El script existente invoca exactamente ese flujo antes de conectar y, por ello, no se ejecutó.

Se inspeccionaron **sólo nombres/presencia**, sin imprimir valores: `.env.local` contiene claves de configuración de app, proyecto y API/Auth Admin, pero ninguna contraseña o DSN PostgreSQL; el entorno del proceso no tiene variables `PG*`, `DATABASE*`, `SUPABASE*` o `TASK009*` de conexión; no existen los archivos estándar `.pgpass`, `pg_service.conf` o sus equivalentes de `%APPDATA%\postgresql`. `supabase/.temp/linked-project.json` contiene identidad del proyecto, no una credencial DB. La clave de API/Auth Admin no acredita autenticación PostgreSQL. La URL del pooler por sí sola no permite autenticar.

**Límite de esta reanudación.** No hubo conexión ni consultas a DEV; por tanto no se pudo probar `BEGIN READ ONLY`, `transaction_read_only`, timeout y `ROLLBACK`, ni recapturar ledger 22/23, contrato PRE de dos columnas, dependencias, privilegios, RLS, ACL `dev-hosted`, atributos/membresías de `supabase_realtime_admin`, presencia de `cli_login_postgres` o rutas `USAGE`/`SET`. Los resultados DEV de 2026-10-19 que figuran abajo son históricos y no se presentan como paridad o catálogo actual. El hash local de la migration pendiente `20261019170000_add_appointment_slot_civil_time.sql` sigue siendo SHA-256 `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`.

**Intervención humana necesaria.** Identificar y poner a disposición por un canal seguro una credencial PostgreSQL **ya existente** para el proyecto DEV autorizado, con procedencia verificable ajena al flujo CLI sin contraseña, y acreditar host/puerto/base/usuario (directo o pooler aprobado). No registrar el secreto en este informe ni en el chat. Con esa conexión acreditada, el siguiente paso permitido es el preflight de metadatos dentro de una transacción `READ ONLY` con timeout, verificación del modo de sesión y `ROLLBACK`. Hasta obtener PASS de ese preflight, no corresponde solicitar aplicación de la migration. No se crearon ni renovaron roles, no se ejecutaron migration, DDL/DML, fixtures, integración o Playwright, y no se accedió a PROD ni se hizo commit o push. TASK-009 sigue activa.

## Alcance y autoridad

El último dictamen de `review.md` (desde línea 437) aprobó D-P1/D-P2/D-P3 y habilitó **sólo** este preflight de lectura. Gate C continúa PASS; TASK-009 sigue activa. Se leyeron las instrucciones de `AGENTS.md`/Harness y los artefactos actuales de TASK-009. El estado de apertura de `docs/status.md` estaba desactualizado respecto del review final; se corrige en este checkpoint.

No se aplicaron migrations, DDL, DML, fixtures ni E2E; no se consultaron filas de pacientes/usuarios ni PROD. No hubo commit ni push. Las consultas directas se ejecutaron bajo `BEGIN READ ONLY`, con `transaction_read_only=on`, `statement_timeout=10s` y `ROLLBACK` al cerrar. El script [preflight-dev-readonly.mjs](../../../../scripts/task009-gate-d/preflight-dev-readonly.mjs) comprueba APP_ENV, URL, ref enlazada, host, usuario y base antes de conectarse y sólo imprime metadatos sin credenciales. La CLI `migration list`, `db push --dry-run --skip-vault`, `db lint` y el health check fueron de lectura. El rol de conexión CLI `cli_login_postgres` no pudo leer directamente `supabase_migrations.schema_migrations` (`42501`); para el historial se usó la salida de `migration list`, que sí completó la lectura.

## Identidad de DEV y checkpoint local

- Rama `task/009-appointments`, HEAD `73122b680949acd4dfa905bf79da37e1d3e3205d`; cambios Gate C/SQL review locales y sin stage. `pnpm bootstrap` PASS (Node 24.21.0, pnpm 11.26.0). `next-env.d.ts` continúa con hash `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Configuración aprobada `scripts/config/approved-supabase-dev.mjs`: `ehllxymqyzrofydrvtzo`, `sa-east-1`; `.env.local` validó `APP_ENV=development`, host público exacto y ref; `supabase/.temp/project-ref` coincide. `projects list` devolvió **un solo proyecto accesible**, `salud-plus-turnos-dev`, ref igual, región `sa-east-1`, `ACTIVE_HEALTHY`, host DB `db.ehllxymqyzrofydrvtzo.supabase.co`, engine 17.6.1.166. El health check de sólo lectura pasó.
- El CLI dry-run interno de `db dump` produjo una conexión a ese host directo, base `postgres`, usuario `cli_login_postgres`; ningún secreto ni URL completa se imprimió o guardó. La conexión a PostgreSQL real reportó versión `17.6`, zona de sesión UTC. El proyecto y host se cotejaron **antes** del primer SELECT de catálogo. No se utilizó PROD.
- La migration local mantiene SHA-256 `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`; `verify.mjs` mantiene `F51818CF9F5821746DE8635B67A1D7DAA6F90A6B0B85688BF167746D6CEAC3D8`, iguales al review independiente. `node verify.mjs --local` PASS 23/23. Los verificadores históricos A2/B0 permanecieron intactos.

## Inventario de migraciones

La comparación de `migration list --linked` encontró **22 versiones locales/remotas en el mismo orden**, ninguna remota desconocida ni hueco intermedio. La única versión local sin remoto es la 23. `db push --linked --dry-run --skip-vault` devolvió `dryRun=true`, `migrations=[20261019170000_add_appointment_slot_civil_time.sql]`, `seeds=[]` y `roles=[]`; no aplicó ni registró nada. `.gitkeep` fue ignorado por la CLI como archivo sin patrón de migration.

| Orden | Archivo local aprobado | DEV |
| ---: | --- | --- |
| 1 | `20260921150000_initial_domain_schema.sql` | Aplicada |
| 2 | `20260921170000_enforce_normalized_document_not_null.sql` | Aplicada |
| 3 | `20260921210000_use_explicit_appointment_blocking_statuses.sql` | Aplicada |
| 4 | `20260922120000_add_user_email_and_platform_admins.sql` | Aplicada |
| 5 | `20260922121000_add_auth_access_helpers_and_policies.sql` | Aplicada |
| 6 | `20260922122000_add_auth_platform_center_rpcs.sql` | Aplicada |
| 7 | `20260922123000_remove_unused_membership_lock_variable.sql` | Aplicada |
| 8 | `20260923100000_add_provisioning_idempotency.sql` | Aplicada |
| 9 | `20260923120000_enforce_provisioning_intent_fingerprints.sql` | Aplicada |
| 10 | `20260924120000_add_bootstrap_platform_preflight.sql` | Aplicada |
| 11 | `20260924140000_harden_bootstrap_final_auth_revalidation.sql` | Aplicada |
| 12 | `20260924160000_serialize_bootstrap_auth_users.sql` | Aplicada |
| 13 | `20260925120000_enforce_professional_membership_assignment.sql` | Aplicada |
| 14 | `20260928120000_make_membership_stale_check_atomic.sql` | Aplicada |
| 15 | `20261009120000_add_professional_specialty_foundation.sql` | Aplicada |
| 16 | `20261009130000_enforce_task006_cas_monotonicity.sql` | Aplicada |
| 17 | `20261009140000_align_professional_email_contract.sql` | Aplicada |
| 18 | `20261013190000_add_patient_foundation.sql` | Aplicada |
| 19 | `20261013200000_remove_patient_rpc_unused_variables.sql` | Aplicada |
| 20 | `20261016160000_add_availability_foundation.sql` | Aplicada |
| 21 | `20261016190000_add_appointment_foundation.sql` | Aplicada |
| 22 | `20261019150000_add_appointment_mutations.sql` | Aplicada |
| 23 | `20261019170000_add_appointment_slot_civil_time.sql` | **Pendiente** |

## Catálogo PostgreSQL PRE migración

- Existen las **once** RPC públicas de Appointments esperadas, sin sobrecarga adicional entre esos nombres. En especial, `staff_search_appointment_slots(uuid,uuid,uuid,date)` existe una sola vez con parámetros de entrada `p_center_id uuid`, `p_professional_center_id uuid`, `p_specialty_id uuid`, `p_local_date date` y retorno **PRE** `TABLE(starts_at timestamptz, ends_at timestamptz)`. Ésta es la diferencia prevista con el retorno **POST** de seis columnas, no drift.
- Las once funciones tienen owner `postgres`, `SECURITY DEFINER`, `search_path=''` y ACL `{postgres=X/postgres,authenticated=X/postgres}`. `authenticated` tiene EXECUTE efectivo; `anon`, `service_role` y PUBLIC no lo tienen. La firma objetivo no tiene dependencias **entrantes** en `pg_depend` que bloqueen su `DROP`; se consultó por el OID concreto. La inspección no ejecutó `DROP` ni probó comportamiento POST en DEV.
- Default ACL de funciones en `public`: para owner `postgres`, `{postgres=X/postgres}`; para owner `supabase_admin`, incluye `postgres`, `anon`, `authenticated` y `service_role`. La migration recrea como owner `postgres` según el mecanismo local revisado y revoca explícitamente PUBLIC/anon/authenticated/service_role antes de conceder authenticated; owner y ACL POST deben verificarse inmediatamente tras una futura aplicación.
- `appointments`: RLS habilitada, `FORCE RLS` desactivado, **cero policies**, sin SELECT/INSERT/UPDATE/DELETE efectivo para `authenticated`, y sin SELECT para `anon`. `centers`, `center_memberships`, `patient_centers`, `professional_centers`, `specialties` y `availabilities` mantienen RLS y sus seis policies SELECT tenant respectivas; no apareció policy de Appointment. `db lint --linked --schema public --level error --fail-on error`: **sin errores**.
- PostgreSQL dispone de `btree_gist` 1.7 y `plpgsql` 1.0. `pg_timezone_names` reconoce `America/Argentina/Buenos_Aires`, `America/New_York`, `Australia/Lord_Howe` y `Pacific/Auckland`. No se consultaron zonas de Centers ni filas operativas: la tzdata y las reglas DST efectivas del flujo quedan para integración autorizada.

## Desvío de grafo de roles frente al shadow aprobado

El ACL directo de la RPC actual es estrecho y `service_role`/`anon` no heredan ni pueden hacer `SET ROLE authenticated`. No se observó una exposición nueva de la RPC actual. Sin embargo, el verificador POST aprobado (`verify.mjs`, `otherSetters`) sólo admite `authenticator` y `supabase_storage_admin` como identidades adicionales capaces de hacer `SET ROLE authenticated`. El catálogo DEV devuelve además:

| Rol DEV | `USAGE` de `authenticated` | `SET` de `authenticated` | Ruta observada |
| --- | --- | --- | --- |
| `cli_login_postgres` | false | true | `cli_login_postgres → postgres → authenticated`; la primera arista tiene `inherit=false`, `set=true` |
| `supabase_realtime_admin` | false | true | arista directa a `authenticated`, `inherit=false`, `set=true`; `rolcanlogin=false` |

`postgres` y `supabase_admin` también pueden adoptar el rol, como autoridades de infraestructura ya contempladas. Las cuatro aristas aprobadas `authenticator → anon/authenticated/service_role` y `supabase_storage_admin → authenticator` coinciden en grantor `supabase_admin` y opciones `admin=false, inherit=false, set=true`. El rol `cli_login_postgres` fue el usuario de la conexión CLI de este preflight; su ciclo de vida fuera de la sesión no se presume. `supabase_realtime_admin` aparece como rol de infraestructura sin LOGIN. Estos hechos **no equivalen a herencia inmediata de EXECUTE**, pero sí son una diferencia material frente a la política cerrada del verificador local. Sin un review que clasifique y trate las rutas exactas, el verificador POST fallaría en DEV aunque la migration y su ACL queden correctas. No se amplió la allowlist ni se modificaron roles.

## Decisión y procedimiento condicionado

**No resulta seguro solicitar todavía la autorización para aplicar la migration.** El orden, contrato PRE, dependencias, ACL actual, RLS, lint y dry-run son consistentes. El bloqueo es la discrepancia nueva del grafo de roles DEV respecto del verificador aprobado. Requiere análisis/review SQL/security independiente de las dos rutas DEV y una forma de verificación POST que preserve la detección de roles extra no autorizados. Si el rol CLI es efímero, comprobar su ciclo de vida sin alterar permisos; no asumirlo. No tratar esta diferencia como permiso para cambiar infraestructura o relajar controles por cuenta propia.

Una vez resuelto ese bloqueo, el siguiente preflight deberá repetir identidad, hash, `migration list`, dry-run `--skip-vault`, dependencias y ACL. Si vuelve a ser exactamente la migration 23, presentar al humano para aprobación la aplicación **sólo** sobre `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`). Comando previsto, **no ejecutado**: `pnpm exec supabase db push --linked --skip-vault` (sin `--include-seed`, `--include-roles` ni `--include-all`), precedido por `pnpm exec supabase db push --linked --dry-run --skip-vault`. El riesgo operativo es la sustitución `DROP/CREATE` de una RPC consumida por el cliente nuevo; mantener coordinados SQL y versión del cliente. El archivo lleva `BEGIN`/`COMMIT` y shadow probó atomicidad, pero hay que verificar estado real tras cualquier error remoto.

Inmediatamente después de una aplicación **autorizada**: comprobar ledger 23/23 sin otras versiones, dry-run vacío, owner/ACL/roles efectivos, única firma y seis columnas en nombre/tipo/orden, `SECURITY DEFINER`, `search_path`, dependencias, RLS/policies, lint y llamada de sólo lectura con sesión normal en la fase de integración autorizada. Si falla antes de `COMMIT`, verificar rollback real, ledger aún 22 y función PRE intacta antes de cualquier reintento. Si hubo `COMMIT`, **no existe rollback automático**: detener pruebas/tráfico dependiente, inventariar el estado exacto y preparar una reparación forward o restauración del contrato anterior mediante migration revisada y autorización nueva. Fixtures, Auth/RLS/RPC funcional, DST, carreras, Playwright, cleanup y Gate D real permanecen pendientes.

## Verificación local y límites

`pnpm bootstrap`, `node verify.mjs --local` (23/23), `node --check` del script read-only y `git diff --check` pasaron. El `pnpm check` de 601 Vitest/11 tooling y el replay shadow PASS pertenecen al review independiente anterior, no se repitieron como integración en DEV. La primera invocación de pnpm para la CLI intentó reconstruir `node_modules` por una restricción local de telemetría; se detuvo y restauraron las dependencias exactas con `pnpm install --frozen-lockfile`, sin cambio de versiones ni lockfile. Se usó después la CLI local directamente. El directorio `.pnpm-store` temporal se eliminó. Ninguna de estas operaciones modificó DEV.

**TASK-009 GATE D DEV READ-ONLY PREFLIGHT BLOCKED — ACTION REQUIRED**
