# TASK-035 — Informe de Fase C (validación local y preparación de DEV)

**Resultado: `PHASE_C_PASSED`.** Fecha: 2026-10-30. Rama: `codex/task-035-center-settings`; HEAD `dd3c2c9`. La migración TASK-035 quedó aplicada y verificada en DEV; la prueba funcional autorizada confirmó guardado, recarga, conflicto y restauración exacta de los valores visibles. No se accedió a PROD, no hubo commit/push y no se inició Fase D.

## 1. Preflight y límites de evidencia

- `pnpm bootstrap` pasó: Node 24.21.0, pnpm 11.26.0 y configuración DEV local coherente. Git conserva los cambios locales preexistentes y archivos ajenos a TASK-035; no se cambió de rama.
- Hay 27 migraciones SQL locales. La última es `20261030120000_admin_update_center_settings.sql`; la anterior es `20261027120000_add_appointment_status_time_rules.sql`. El repositorio no contiene `supabase/config.toml`.
- Docker 28.5.1 respondió mediante acceso local autorizado al daemon. Antes del laboratorio no había contenedores Supabase activos. El servidor existente `localhost:3000` respondió y se mantuvo en ejecución, sin reiniciarlo.
- El primer intento de `pnpm exec supabase migration list --linked` no pudo consultar DEV: `LegacyPlatformAuthRequiredError: Access token not provided`. El usuario completó después el login oficial de la CLI. Las consultas de solo lectura posteriores confirmaron el inventario y el catálogo descritos en la sección 4. No se usó `SUPABASE_SECRET_KEY` ni se expusieron credenciales.
- Se intentó iniciar el stack Supabase en un directorio temporal exclusivo; la descarga de imágenes ajenas al PostgreSQL ya instalado recibió `toomanyrequests: Rate exceeded`. El intento se detuvo y no dejó contenedores Supabase. Se usó después la imagen local `ghcr.io/supabase/postgres:17.6.1.166` sin red ni puertos en un contenedor exclusivo y descartable, `task035-pg-49f0dc68`.

## 2. Diagnóstico del guardado

Recorrido inspeccionado: `CenterSettingsScreen` forma `FormData` con cuatro campos y `expectedUpdatedAt`; la Server Action delega en `performUpdateCenterSettingsAction`; ésta valida UUID, autoriza ADMIN del centro y valida el schema compartido; `updateCenterSettings` llama `.rpc("admin_update_center_settings", {p_center_id, p_name, p_phone, p_email, p_address, p_expected_updated_at}).single()` con el cliente Supabase de sesión; la RPC comprueba identidad/membership, compara `updated_at` bajo lock, persiste los cuatro campos y devuelve la fila. Los parámetros y el tipo manual coinciden con la firma y el resultado inspeccionados en PostgreSQL local. El timestamp se transmite como texto ISO y la base lo recibe como `timestamptz`.

La acción distingue errores de campos, autorización (`42501`), conflicto (`P0001 / STALE_CENTER_SETTINGS`) y fallo inesperado; este último muestra un mensaje sin detalles internos y conserva el borrador. La pantalla habilita Guardar sólo con cambios válidos. Los tests de servicio/acción/pantalla cubren la llamada RPC y la respuesta con mocks, incluido un error sintético `PGRST202`.

**Causa ambiental comprobada:** el catálogo de DEV no contiene `admin_update_center_settings` en ningún esquema. Por lo tanto, esa RPC no puede guardar cambios allí y la migración TASK-035 pendiente es necesaria. El código de error de la solicitud manual no se conservó; no se puede atribuir retrospectivamente cada detalle de esa respuesta ni descartar un segundo problema que sólo aparecería después de desplegar la función. La prueba local descarta, dentro del esquema migrado y los casos cubiertos, un defecto SQL evidente en firma, permisos, validación, autorización o concurrencia. No se cambió código de producto sin identificar un defecto.

## 3. PostgreSQL aislado: pruebas reales, sin mocks

Se aplicaron **las 27 migraciones locales en orden** al contenedor PostgreSQL sin red. La migración TASK-035 creó la función con firma `admin_update_center_settings(uuid,text,text,text,text,timestamptz)` y resultado `TABLE(center_id uuid, name text, phone text, email text, address text, updated_at timestamptz)`. Consulta de catálogo: `SECURITY DEFINER = true`, `search_path = ''`, `EXECUTE` para `authenticated = true`, `EXECUTE` para `anon = false`, `UPDATE` directo de `public.centers` para `authenticated = false`.

`supabase/tests/task-035-center-settings.sql` pasó con `psql -X -v ON_ERROR_STOP=1` y `ROLLBACK` final. Verificó ADMIN del mismo centro, normalización, retorno persistido, envío sin cambios sin avanzar `updated_at`, conflicto stale, nombre/email inválidos, centro ajeno, roles RECEPTION/PROFESSIONAL, PLATFORM_ADMIN sin membership, sesión ausente, UPDATE directo denegado, centro inactivo y preservación de timezone/logo/estado. Los fixtures de ese script no persistieron.

La concurrencia se probó además en **dos conexiones PostgreSQL reales** con un fixture sintético del mismo contenedor. La sesión A, como `authenticated`/ADMIN, actualizó la versión inicial a `Version A` y mantuvo su transacción abierta 15 segundos; la sesión B intentó `Version B` con el mismo `expected_updated_at`. B recibió `STALE_CENTER_SETTINGS` y no sobreescribió A. La fila final conservó `Version A`, el token actualizado, timezone `UTC` y logo `race-logo`. Esto comprueba la serialización y el rechazo atómico del intento obsoleto en PostgreSQL. No prueba PostgREST ni el navegador contra esa base.

## 4. Inventario DEV previo a la autorización de aplicación

Tras el login oficial del usuario, `pnpm exec supabase projects list` confirmó el proyecto vinculado `ehllxymqyzrofydrvtzo` / `salud-plus-turnos-dev`, región `sa-east-1`, estado `ACTIVE_HEALTHY`. La CLI de los comandos aislados necesitó acceso local a la sesión de usuario para encontrar su credencial; se deshabilitó telemetría y no se leyó ni imprimió el token.

`pnpm exec supabase migration list --linked` comparó las **27 versiones locales** con DEV: **25 aplicadas**, desde `20260921150000` hasta `20261022130000`, sin versión exclusivamente remota en esa lista. Pendientes, en orden:

```text
Aplicadas en DEV (versiones):
20260921150000  20260921170000  20260921210000
20260922120000  20260922121000  20260922122000  20260922123000
20260923100000  20260923120000
20260924120000  20260924140000  20260924160000
20260925120000  20260928120000
20261009120000  20261009130000  20261009140000
20261013190000  20261013200000
20261016160000  20261016190000
20261019150000  20261019170000
20261022120000  20261022130000
```

Pendientes:

1. `20261027120000_add_appointment_status_time_rules.sql` — migración de reglas temporales de turnos, ajena a TASK-035.
2. `20261030120000_admin_update_center_settings.sql` — migración de TASK-035.

`pnpm exec supabase db push --linked --dry-run --skip-vault` confirmó exactamente esos dos archivos; informó explícitamente que **no** aplicaría migraciones, sin seeds ni roles. Esta comparación valida versiones y orden, no un checksum del contenido histórico aplicado.

`pnpm exec supabase db query --linked` con sólo `SELECT` a `pg_catalog.pg_proc` devolvió **cero filas** para `admin_update_center_settings`, tanto en `public` como en cualquier otro esquema. Por ausencia, no hay firma ni grants que comparar en DEV; no es un caso de firma distinta o permiso de ejecución denegado sobre una función existente. Otra consulta de catálogo confirmó `public.centers`, `public.membership_role`, `private.has_active_center_role(uuid,public.membership_role[])`, `centers.updated_at` y su trigger: presentes. No se invocó la RPC ni se leyó o alteró dato de pacientes/centros.

**En ese inventario anterior, DEV no estaba preparado para aplicar TASK-035 con el comando normal.** Un `db push --linked` habría incluido primero la migración de otra TASK. El procedimiento preparado entonces fue:

1. Resolver la aplicación de `20261027120000` en su propia TASK y con autorización específica; no incorporarla como efecto secundario de TASK-035. Volver a consultar el inventario después de esa decisión.
2. Confirmar con `migration list --linked` y `db push --linked --dry-run --skip-vault` que la **única** pendiente sea `20261030120000`. Detenerse ante versiones remotas inesperadas, drift, una RPC homónima o cualquier otro cambio del plan.
3. Presentar el SQL exacto de TASK-035 (SHA-256 local `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`) y pedir autorización explícita para aplicarlo. Sólo entonces usar el flujo versionado `db push --linked --skip-vault`, sin seeds, roles ni `--include-all`.
4. Comprobar versión remota, existencia, firma, `SECURITY DEFINER`, `search_path` y grants. Probar con un centro/identidad sintéticos autorizados: lectura, edición, guardado, recarga, encabezado, conflicto de dos sesiones, denegación no ADMIN, y limpieza exacta con inventario antes/después. No usar el centro persistente del usuario como fixture.

**Cambios exactos de la migración propuesta:** una función `public.admin_update_center_settings` `SECURITY DEFINER` con seis parámetros y retorno de seis columnas; `REVOKE ALL` a `public`, `anon` y `authenticated`, seguido de `GRANT EXECUTE` sólo a `authenticated`. El cuerpo comprueba `auth.uid()`, membership ADMIN activa, centro activo, locks, versión y datos; actualiza sólo `name`, `phone`, `email`, `address`. El archivo está envuelto en `begin`/`commit`. No crea tablas, no altera datos existentes, no concede UPDATE directo y no cambia RLS. Un error durante la migración debe dejarla sin confirmar; si ya confirmó y se detecta un defecto, detener escrituras y preparar una migración compensatoria revisada, sin modificar a mano el historial compartido. La dependencia principal es el esquema/RPCs y enum de las migraciones anteriores.

## 5. Aplicación y regresiones

- Pruebas focales TASK-035 y alta de centros: **56/56**, nueve archivos, PASS. Son pruebas de unidad/componente con mocks; no acreditan persistencia remota.
- TypeScript `pnpm typecheck`: PASS. ESLint `pnpm lint`: exit 0, con un warning previo ajeno a TASK-035 en `scripts/task009-gate-d/preflight-dev-readonly.mjs` (`oid` sin uso).
- Prettier focal de 12 archivos TS/TSX de TASK-035: PASS. `pnpm format:check` global: FAIL por 258 archivos ya fuera de formato, mayormente CRLF y ajenos a este alcance; no se reformatearon.
- Suite Vitest completa: **963/965**; dos tests ajenos a TASK-035 agotaron el timeout de 5 s (`CenterStatusForm`, `ProfessionalsScreen`). `CenterStatusForm` pasó al repetirse; `ProfessionalsScreen` mostró otro timeout al repetirse con 5 s y pasó **41/41** al darle 15 s. No se observó una aserción rota ni un cambio de TASK-035 que afecte esos módulos. Tooling de `pnpm test:task007-tooling` **11/11** y `pnpm test:task021-tooling` **20/20** PASS.
- Navegador en `localhost:3000`, sesión ADMIN existente: escritorio y 390 px móvil. La pantalla cargó valores; un borrador habilitó Guardar; Cancelar abrió el diálogo con foco en «Seguir editando» y backdrop de todo el viewport; «Seguir editando» cerró el modal y conservó el borrador; «Descartar cambios» navegó al centro en escritorio y móvil. Zona horaria permaneció como bloque de solo lectura. No se pulsó Guardar. No hubo prueba de persistencia real ni E2E contra DEV con la RPC desplegada.

## 6. Pendientes y clasificación

Esta sección registra el estado anterior a la autorización de pruebas funcionales. La evidencia y clasificación finales figuran en la sección 9.

## 7. Aplicación controlada de TASK-035 en DEV

El usuario confirmó que TASK-031 se aplicó y autorizó expresamente **sólo** `20261030120000_admin_update_center_settings.sql` en `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), condicionada al preflight y dry-run. No autorizó escrituras funcionales de prueba.

**Preflight nuevo:** `pnpm bootstrap` pasó; rama y cambios locales preexistentes conservados. `projects list` confirmó proyecto vinculado y saludable. `migration list --linked` mostró 26/27 versiones aplicadas, ninguna exclusivamente remota y sólo TASK-035 pendiente. El archivo SQL fue revisado íntegramente; SHA-256 `A1B631DC5297E450AEB677A881AEC5625E4040A115C68E4B1F83F07A659A52D4`, igual al inventario previo. Una consulta `SELECT` al catálogo confirmó que la RPC no existía, que `centers` tenía las nueve columnas necesarias y el trigger `updated_at`, y que `auth.uid()`, `membership_role` y `private.has_active_center_role(uuid,public.membership_role[])` existían. El helper es `SECURITY DEFINER` de `postgres`; `postgres` puede invocarlo y actualizar `centers`; `authenticated` no tenía `UPDATE` directo.

**Dry-run:** `pnpm exec supabase db push --linked --dry-run --skip-vault` enumeró exclusivamente `20261030120000_admin_update_center_settings.sql`, `seeds=[]`, `roles=[]` y `dryRun=true`.

**Aplicación:** `pnpm exec supabase db push --linked --skip-vault` terminó con exit 0 e informó `migrations=["20261030120000_admin_update_center_settings.sql"]`, `seeds=[]`, `roles=[]`, `dryRun=false`. No se usó `--include-all`, no se reparó el historial y no hubo DML manual sobre centros.

**Verificación posterior read-only:** `migration list --linked` mostró 27/27 versiones coincidentes, incluida `20261030120000`; el dry-run posterior informó `upToDate=true`, `migrations=[]`, `seeds=[]`, `roles=[]`. La única función homónima está en `public`, con parámetros `p_center_id uuid, p_name text, p_phone text, p_email text, p_address text, p_expected_updated_at timestamptz` y resultado `TABLE(center_id uuid, name text, phone text, email text, address text, updated_at timestamptz)`. Es una función `plpgsql` que retorna conjunto, sin parámetros por defecto. Propietario `postgres`; `SECURITY DEFINER=true`; `search_path=''`; ACL explícita `{postgres=X/postgres,authenticated=X/postgres}`. `authenticated` puede ejecutar; `anon` y `public` no; `authenticated` sigue sin `UPDATE` directo sobre `public.centers`.

Para contrastar el cuerpo desplegado sin invocar la función, se calculó `md5(replace(prosrc, CRLF, LF))` en catálogo y MD5 del cuerpo entre los delimitadores `$function$` del archivo local con el mismo tratamiento de saltos de línea: ambos **`dbd33266e56ee168802375e25e8507a7`**. La firma, retorno, configuración y ACL se contrastaron por separado. Así se verificó la definición autorizada sin leer ni modificar filas de centros. No hubo incidencias de aplicación.

## 8. Procedimiento propuesto para prueba funcional (no ejecutado)

Requiere autorización separada para escrituras temporales sobre **un centro DEV elegido explícitamente**. Propuesta de menor alcance: el centro DEV existente de la sesión ADMIN en `localhost:3000`, ID `76dcbe41-38be-475d-a590-f4ae6619c1e8`; no usar pacientes, turnos ni datos de otras TASK. Antes de cualquier edición, registrar de forma privada el nombre, teléfono, email, dirección y `updated_at` actuales, y verificar que no haya otro editor activo. Obtener aprobación específica para cambiar temporalmente el teléfono a `+54 11 5555-0035` y el nombre a su valor actual más ` [TASK-035]`, y restaurar esos dos campos con la versión actual mediante el propio formulario. Si alguno de los valores de prueba ya coincide con el valor inicial, detenerse y proponer otro antes de guardar. Email y dirección quedarían intactos. La restauración recupera los valores visibles originales, pero el `updated_at` avanzará legítimamente y no debe reescribirse a mano.

1. Cargar settings como ADMIN; confirmar los cuatro valores y zona horaria. Cambiar sólo el teléfono a `+54 11 5555-0035`; guardar, recargar y comprobar persistencia.
2. Cambiar temporalmente el nombre con un sufijo `TASK-035`; guardar y comprobar el encabezado y la recarga. Restaurar el nombre original mediante el formulario.
3. Abrir dos sesiones/pestañas ADMIN con la misma versión; guardar teléfono `+54 11 5555-1035` desde A e intentar `+54 11 5555-2035` desde B. B debe recibir conflicto sin sobreescribir A. Descartar el borrador B y restaurar el teléfono original desde una versión fresca.
4. Verificar Cancelar y Descartar sin escritura adicional. Comprobar acceso no ADMIN con una identidad DEV ya disponible, si existe, sin crear usuarios ni memberships sólo para esta prueba; de lo contrario dejar esa verificación pendiente o pedir un fixture separado.
5. Confirmar por lectura final nombre, teléfono, email y dirección iguales al snapshot inicial; timezone/logo/estado intactos. Registrar la nueva versión `updated_at`, cerrar las pestañas de prueba y detenerse ante cualquier conflicto inesperado sin forzar restauración.

El usuario autorizó en una instrucción posterior exactamente este centro, los teléfonos temporales indicados, el cambio de nombre con sufijo y la restauración, aceptando que `updated_at` avance. La ejecución y resultados se registran en la sección 9.

## 9. Prueba funcional real y restauración en DEV

**Autorización y preflight:** el usuario autorizó escrituras temporales exclusivamente en `salud-plus-turnos-dev`, centro `76dcbe41-38be-475d-a590-f4ae6619c1e8`, y restauración posterior. `pnpm bootstrap` pasó. `projects list` confirmó proyecto DEV vinculado y saludable. `migration list --linked` confirmó 27/27 aplicadas, sin pendientes ni versiones exclusivamente remotas. El catálogo confirmó la RPC con firma, propietario `postgres`, `SECURITY DEFINER`, `search_path` y grants esperados; `authenticated` seguía sin `UPDATE` directo. Una lectura `SELECT` acotada a ese centro registró en memoria de la sesión nombre, teléfono, email, dirección, `updated_at`, timezone, logo y estado originales. La ruta local `/centers/76dcbe41-38be-475d-a590-f4ae6619c1e8/settings` cargó y mostró a la identidad autenticada como Administrador. Una segunda lectura inmediatamente antes del guardado confirmó que la fila no había cambiado.

**Guardado real desde la interfaz:** se añadió ` [TASK-035]` al nombre original y se puso `+54 11 5555-0035` en teléfono. El formulario habilitó Guardar, respondió «Configuración guardada.» y deshabilitó de nuevo Guardar. El encabezado mostró el nombre temporal. Un `SELECT` de PostgreSQL confirmó nombre y teléfono esperados, `updated_at` avanzado, y email, dirección, timezone, logo y estado intactos. Tras recargar el navegador, nombre, teléfono y encabezado temporales persistieron; el formulario quedó limpio. No se editó email ni dirección.

**Concurrencia de aplicación:** se abrieron dos pestañas con la misma versión del centro y se comprobaron borradores `+54 11 5555-1035` (A) y `+54 11 5555-2035` (B). La versión persistida no había cambiado antes de la carrera. A guardó y mostró éxito; PostgreSQL confirmó su teléfono y una nueva versión. B intentó guardar su borrador obsoleto y mostró «Los datos del centro cambiaron mientras editabas. Revisá la versión actual antes de guardar.» con opción de recarga; conservó el borrador. Una lectura posterior comparó las nueve columnas observadas con el estado después de A: coincidencia exacta, incluido `updated_at`, por lo que B no sobreescribió nada. Se usó Cancelar → Descartar cambios para retirar el borrador B.

**Restauración:** se recargó A desde la versión vigente y se confirmó por `SELECT` que no hubo cambios de terceros. Se restauraron el nombre y teléfono originales **mediante el formulario**, con respuesta «Configuración guardada.». La lectura final comparó exactamente con el snapshot inicial: nombre, teléfono, email, dirección, timezone, logo y estado coinciden; `updated_at` avanzó como se había autorizado. Tras otra recarga, encabezado y formulario muestran los valores originales, Guardar está deshabilitado y el navegador no registró errores de consola. No quedó ningún valor temporal pendiente. No se ejecutó SQL de actualización manual ni se tocó otro centro.

**Alcance de la evidencia:** esta prueba usó la interfaz real de `localhost:3000`, su Server Action, Supabase DEV y lecturas directas read-only de PostgreSQL. No son mocks. Las pruebas de autorización negativa por rol/centro y la carrera de dos conexiones PostgreSQL del apartado 3 se ejecutaron en la base local aislada; no se crearon identidades no ADMIN ni se modificaron permisos en DEV para repetirlas. No se detectó defecto funcional ni regresión en el flujo probado. Clasificación final: **`PHASE_C_PASSED`**. TASK-035 permanece ACTIVE hasta la fase posterior que se autorice; Fase D no iniciada.
