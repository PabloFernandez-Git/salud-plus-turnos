# TASK-021 — Gates Supabase DEV preparados, no ejecutados

## Alcance y decisión pendiente

Estos procedimientos pertenecen exclusivamente al worktree `codex/task-021-dashboard-sql` y al proyecto previsto `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`). La preparación local no conectó a DEV/PROD, no aplicó migrations y no creó fixtures. El checkout habitual, la migration aprobada y la UI aprobada no se alteraron. Gate A y Gate B requieren autorizaciones remotas **separadas**. Gate B exige que Gate A haya registrado la versión `20261022130000`.

El Task Brief general y el contrato funcional siguen en `brief.md` y `contract.md`. En esta fase el objetivo es dejar dos procedimientos ejecutables y revisables. Criterios de aceptación: fail closed antes de escribir, SHA fijo, 24 versiones previas exactas, postcheck estructural de dos RPC, fixtures exclusivamente sintéticos con runId e inventario de 14 recursos, seis sesiones autenticadas, UI real y cleanup exacto sin residuos. Riesgos: identidad DEV equivocada, drift de catálogo, commit incierto, Auth Admin parcialmente creado, día civil que cambie durante el run, selectores E2E falsamente rígidos y cleanup parcial. La estrategia es detener nuevas escrituras en cualquier ambigüedad, conservar el ledger y reconciliar en lectura.

## Gate A: migration estructural

Archivo aprobado: `supabase/migrations/20261022130000_add_daily_dashboard_rpcs.sql`. SHA-256 fijo:

```text
7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1
```

`scripts/task021-dev/gate.mjs` verifica localmente rama, conjunto de 25 archivos, orden de los ocho statements de la migration, SHA y cuerpos aprobados de los helpers. Su conexión fija host pooler de `sa-east-1`, usuario `postgres.ehllxymqyzrofydrvtzo`, base `postgres`, puerto `5432` y CA con SHA-256 aprobado. El ref se confirma como parámetro exacto. No se usa `.env.local` ni un link de Supabase del worktree.

**Preflight remoto read-only:** PostgreSQL 17.6, rol `postgres`, columnas del historial, las 24 versiones locales exactas y ninguna versión extra; ausencia de ambas RPC y sus overloads; tablas, columnas, enum, índices, RLS y SELECT de appointments; definición, propietario, volatilidad, SECURITY DEFINER, search_path y grants de ambos helpers de autorización; permisos de las RPC de turnos existentes; inventario de IDs/digest de 14 recursos y fingerprint de funciones, relaciones, políticas, índices, default ACL, roles y membresías de roles. Toda discrepancia detiene el proceso antes de escribir.

**Apply posterior a autorización específica:** una transacción con `lock_timeout=5s`, lock exclusivo del historial de migrations, nuevo preflight de catálogo/inventario y SHA, ejecución de los seis statements internos de la migration, inserción de la versión y los ocho statements íntegros en `supabase_migrations.schema_migrations`, y comprobación antes de COMMIT. Tras COMMIT, un postcheck read-only exige 25 versiones, firmas de un UUID, proyección ordenada, propietario postgres, `STABLE SECURITY DEFINER`, `search_path=''`, EXECUTE sólo `authenticated`, funciones existentes intactas, datos intactos y ledger exacto. Si el resultado del COMMIT es incierto, no se reintenta; se inspecciona en lectura con intervención humana.

Comandos exactos desde PowerShell local, cada uno con contraseña ingresada mediante `Read-Host -AsSecureString` en el lanzador:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-dev\run.ps1" -Mode local
& "$worktree\scripts\task021-dev\run.ps1" -Mode preflight -ConfirmProjectRef ehllxymqyzrofydrvtzo
& "$worktree\scripts\task021-dev\run.ps1" -Mode apply -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

`preflight` conecta a DEV en sólo lectura; `apply` escribe en DEV. **No ejecutar ninguno de los dos modos remotos hasta su autorización correspondiente.** El CA esperado está en `$env:USERPROFILE\Downloads\supabase-dev-ca.crt.crt`; puede pasarse `-CaPath` si está en otra ubicación, siempre con el SHA fijado en el lanzador.

## Gate B: validación funcional autenticada

`scripts/task021-functional-dev/plan.mjs` genera un runId UUID, IDs independientes y turnos dentro del día civil `America/Argentina/Buenos_Aires`. Si la hora actual no deja al menos 40 minutos del día transcurridos y 140 minutos antes de medianoche, se detiene **antes de crear datos**. Máximo: 6 Auth users y 6 `public.users`, 2 centros, 5 memberships, 2 profesionales, 2 ProfessionalCenters, 1 especialidad, 2 asignaciones, 2 personas, 2 PatientCenters y **10 turnos**; 40 filas sintéticas en total. No usa datos preexistentes. Center B y el usuario sin membresía ejercitan vacío/denegación. Los 10 turnos del Center A producen: staff 4 pendientes, 3 confirmados, 1 atendido, 1 ausente, 1 cancelado, total vigente 9, por atender 7 y 2 profesionales; el profesional A ve 3,3,1,1,1 y sólo su proyección. Hay siete próximos abiertos en el centro, seis del profesional A y uno del segundo profesional, incluidos dos con igual `starts_at` para comprobar desempate por UUID. El límite visible es cinco.

`scripts/task021-functional-dev/gate.mjs` exige previamente la migration aplicada y el catálogo compatible. Captura inventario inicial de 14 recursos, comprueba ausencia de todos los IDs y emails planificados y toma un lock exclusivo local. Persiste intención antes de cada escritura Auth y antes del COMMIT DB en un ledger ignorado por Git (`.task021-functional-dev/run-<runId>.json`). La contraseña sintética sólo vive en el proceso. Auth Admin se usa únicamente para alta/baja de identidades; las aserciones usan JWT reales con la publishable key. El entorno de Next aislado recibe sólo las variables públicas; no recibe secret key ni contraseña de DB. Chromium corre contra un Next temporal en `localhost:31021`, puerto diferente del servidor habitual; el proceso se detiene y Gate B retira por runId su copia temporal al salir de Playwright.

**RPC/sesiones:** ADMIN y RECEPTION leen todo Center A con staff RPC; ambos son rechazados por la RPC profesional. Cada PROFESSIONAL lee sólo su ProfessionalCenter y es rechazado por staff RPC. ADMIN B ve Center B vacío y es rechazado en Center A. El usuario sin membership es rechazado por ambas RPC. La desactivación temporal, siempre por ID sintético exacto, de membership profesional y de su ProfessionalCenter debe producir `42501`; se restauran antes del navegador.

**Chromium/UI:** ADMIN, RECEPTION, ambos PROFESSIONAL y un profesional a 390 px; fecha y zona del centro, conteos de cinco estados, cancelados fuera del total, hasta cinco links cronológicos con empate por ID, horario local y offset, nombres/especialidad, proyección mínima profesional, información de profesionales sólo para staff y conservación de 7/4/3 tarjetas por rol. También prueba Center B vacío, accesos denegados sin datos en HTML, error provocado en una Server Action y reintento sin ceros falsos, `Actualizar` tras cambio autorizado y los dos estados vacíos. Las mutaciones de estado de esta última secuencia sólo afectan los 10 turnos inventariados y exigen cantidades exactas.

**Cleanup e inventarios:** el run intenta cleanup tras las pruebas si el estado es conocido. Antes de borrar verifica por UUID los marcadores de runId, emails, relaciones de centro, vínculos y ausencia de filas ajenas en ambos centros sintéticos. Borra filas DB por IDs exactos en orden de dependencias, luego Auth Admin por IDs cuya metadata `gate/runId` fue comprobada. Comprueba ausencia de todos los IDs/emails, inventario final idéntico al inicial y catálogo intacto. Si Auth/COMMIT/cleanup tiene resultado incierto, se detienen nuevas escrituras, se conserva el ledger y se usa `reconcile` en lectura; `cleanup` posterior requiere autorización explícita. No hay reintentos automáticos.

Comandos preparados para PowerShell:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode local
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode preflight -ConfirmProjectRef ehllxymqyzrofydrvtzo
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
# Sólo si un run informado necesita reconciliación/cleanup exacto:
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode reconcile -ConfirmProjectRef ehllxymqyzrofydrvtzo -RunId '<UUID informado>'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode cleanup -ConfirmProjectRef ehllxymqyzrofydrvtzo -RunId '<UUID informado>'
```

`preflight` y `reconcile` conectan en lectura; `run` y `cleanup` escriben sólo en DEV. La autorización del Gate A no autoriza Gate B. Ningún modo remoto se ejecutó en esta preparación.

## Pruebas locales y límites

`pnpm bootstrap` se intentó y se detuvo porque este worktree no tiene `.env.local`; es coherente con la restricción de no copiarlo. `node scripts/task021-dev/gate.mjs local`, `node scripts/task021-functional-dev/gate.mjs local`, las pruebas del plan, `node --check`, Prettier y listado estático de Playwright se ejecutan sin DEV. Las suites locales PostgreSQL, Next/Vitest y review previos permanecen documentados en `local-postgres-gate.md` e `implementation-report.md`. No se atribuye PASS remoto ni se repiten volumen, concurrencia o DST.
