# TASK-007C+D · GATE D DEV runbook

## Finalización vigente: un solo comando

En la terminal local autenticada con Supabase, desde la raíz del checkout, ejecutar una sola vez:

```bash
pnpm task007:finalize
```

El comando valida este run y el ledger persistente, audita ownership exacto, limpia sólo los UUIDs registrados, ejecuta auditoría posterior, paridad de migrations, dry-run, lint, schema/API y comparación Baseline V2 exacta, verifica `next-env.d.ts`, actualiza documentación, stagea archivos legítimos, hace commit y push a `origin/task/007-patients`. Falla sin commit/push ante drift o ambigüedad. Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**; no se afirma smoke PASS. Los procedimientos manuales históricos debajo no deben repetirse para este run.

**Reanudación vigente:** la primera ejecución pasó ownership, cleanup por UUID exacto y audit posterior; el ledger está en `cleaned` y tiene el SHA post-cleanup fijado por el finalizador. Se detuvo en `migration-parity` porque el parser exigía timestamps desnudos y no aceptaba celdas delimitadas por backticks. El parser ahora lee celdas tabulares con o sin backticks, ignora encabezados/mensajes y rechaza filas con una sola contraparte; el diagnóstico diferencia fallo del CLI y fallo de parsing. Al repetir el mismo comando, el finalizador valida localmente ese ledger y comienza en paridad de migrations. No consulta fixtures eliminados ni repite cleanup/audit. Cada etapa emite sólo `stage`, `PASS/FAIL` y, al fallar, un error sanitizado. El commit/push sigue condicionado a todos los gates finales.

## Ruta vigente del ledger y estado del run

El manifest de ownership de `c9818e40-2d4d-4c1b-a392-14a9404a5111` está en **`.task007-gate-d/fixture-ledger.json`**. `test-results/task007-gate-d/fixture-ledger.json` era la ruta anterior al fix y debe estar ausente: Playwright limpia `test-results`. `server-temp.json` en ese directorio registra únicamente la copia temporal del servidor Next.

Comprobación local, read-only y sin imprimir contraseña:

```bash
node scripts/task007-gate-d/ledger-status.mjs c9818e40-2d4d-4c1b-a392-14a9404a5111
```

El comando exige el runId exacto y muestra ruta, SHA-256, etapa, Centers, cantidades ownadas y presencia de credenciales. `cleanup-isolated.mjs` comprueba que el SHA del ledger permanezca idéntico antes/después de retirar la copia temporal. `audit` comprueba el mismo SHA antes/después de consultar DEV. Si el servidor aislado está escuchando en 31007, `cleanup-isolated.mjs` se niega a retirar su copia; detenerlo primero con Ctrl+C. La prueba local de lifecycle cubre limpieza de `test-results` y ejecución real de `cleanup-isolated.mjs` en un workspace temporal.

Estado histórico tras el E2E puntual: `e2e_pass`, 8 Persons y 8 PatientCenters ownados. Estado vigente tras el cleanup y audit: `cleaned`; el smoke humano no comenzó. No repetir `setup`, integración ni E2E. No reconstruir el ledger existente.

## Reanudación puntual de E2E tras el segundo fallo (completada)

La ejecución Playwright más reciente pasó el escenario completo de RECEPTION desktop. El segundo escenario avanzó por NOT_LINKED, mismatch de nacimiento, vínculo explícito, ACTIVE reuse, móvil y acceso ADMIN, y falló únicamente en la última aserción: esperaba HTTP 404 para PROFESSIONAL y recibió 200. El `error-context.md` muestra la página 404 renderizada, sin la UI de pacientes. La ruta usa `notFound()` ante `ROLE_FORBIDDEN`; Next puede emitir HTTP 200 si la respuesta ya comenzó por streaming. La aserción del spec original ahora verifica el contenido 404 y ausencia de la pantalla de pacientes.

El `audit` posterior pasó con 8 Persons y 8 PatientCenters propios registrados en el ledger. La comprobación pendiente se cerró sin repetir escrituras UI mediante estos comandos, ya ejecutados y **no repetibles sobre el run actual**:

```bash
node node_modules/@playwright/test/cli.js test tests/e2e/task-007-gate-d-denial-recovery.spec.mjs --config=playwright.task007.config.mjs --project=chromium --workers=1
node scripts/task007-gate-d/cleanup-isolated.mjs
node scripts/task007-gate-d.mjs audit
```

El test puntual validó el runId exacto, ownership local 8/8 y login de PROFESSIONAL, navegó sin mutaciones a Pacientes y comprobó 404 visible, ausencia del título Pacientes y ausencia del listado: 1/1 PASS. Después registró `e2e_pass` con la procedencia compuesta de ambos resultados. `cleanup-isolated` y `audit` también pasaron.

**Incidente histórico tras integración PASS.** Playwright eliminó el ledger anterior al limpiar `test-results`. La persona usuaria ejecutó `recovery-inventory.mjs` en su terminal autenticada: el inventario read-only aportó UUIDs exactos de los 6 actores, 3 Centers, 6 memberships, Professional/ProfessionalCenter, 7 Persons y 6 PatientCenters. Las cantidades corresponden al baseline anterior más esos fixtures y las referencias externas consultadas son cero. `recover-ledger.mjs` volvió a validar DEV y reconstruyó el ledger local; `audit` confirmó ownership y referencias. `recover-credentials.mjs` reasignó la contraseña temporal a los seis Auth UUIDs y el segundo `audit` pasó. Este procedimiento ya concluyó y no debe repetirse.

## Recuperación de la ejecución interrumpida

Los primeros dos pasos ya pasaron en el terminal autenticado:

```bash
node scripts/task007-gate-d/recover-ledger.mjs  # PASS, no repetir
node scripts/task007-gate-d.mjs audit            # PASS
```

También pasaron, **no repetir**:

```bash
node scripts/task007-gate-d/recover-credentials.mjs  # PASS, no repetir
node scripts/task007-gate-d.mjs audit                 # PASS
```

`recover-ledger.mjs` sólo leyó DEV y escribió el ledger local tras comparar cada UUID, campo, vínculo, cantidad y referencia con la evidencia humana. Reconstruyó el inventario previo restando exclusivamente los UUIDs verificados. `recover-credentials.mjs` volvió a validar el inventario, comprobó ID/email de cada Auth user y asignó una contraseña temporal nueva sólo a esos seis IDs; la guardó en el ledger ignorado por Git sin imprimirla. No editar el ledger a mano. Continuar en la sección 2 **desde Playwright**, sin repetir integración.

Usar exclusivamente el terminal local ya autenticado con Supabase y el checkout de `task/007-patients`. El preflight LIVE DEV aportado por la persona usuaria el 2026-10-14 es `PASS`: proyecto `ehllxymqyzrofydrvtzo`, 19/19 migrations, dry-run sin pendientes, lint y schema/API PASS, Baseline V2 exacto `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`. No repetir GATE C ni modificar foundation.

El ledger local ignorado por Git será `.task007-gate-d/fixture-ledger.json`, fuera del `outputDir` que Playwright limpia al iniciar. Se crea **antes de la primera escritura DEV**, con inventario previo y UUIDs reservados. Registra los IDs Auth devueltos por la API, UUIDs de Center, memberships, Professional, Persons y PatientCenters, y cada ID generado por RPC/UI. La contraseña temporal de Auth queda sólo en ese archivo local: no copiarla a reportes, chat ni commits. `setup` rechaza un ledger previo; nunca reutilizar fixtures de otra ejecución. Todos los comandos se detienen si el anterior falla.

## 1. Ownership y fixtures

Desde `C:\Users\Pablo\Documents\mis_proyectos\salud-plus-turnos` en PowerShell:

```powershell
pnpm bootstrap
node scripts/task007-gate-d.mjs setup
```

`setup` valida `.env.local` y el vínculo al ref DEV aprobado, obtiene conexión PostgreSQL transitoria de `supabase db dump --linked --dry-run`, inventaría IDs de Auth/public y exige `persons=0`, `patient_centers=0` antes de crear. Los Auth users y filas DB son propios de esta ejecución. Si falla, **no ejecutar la integración ni E2E**. El ledger muestra el estado exacto; `node scripts/task007-gate-d.mjs cleanup` sólo admite recuperación parcial cuando la DB quedó sin filas de fixture y todos los Auth IDs creados ya constan en el ledger. Si hay ambigüedad, detener cleanup.

## 2. Integración DB y E2E

```powershell
node scripts/task007-gate-d/integration.mjs
node node_modules/@playwright/test/cli.js test tests/e2e/task-007-gate-d.spec.mjs --config=playwright.task007.config.mjs --project=chromium --workers=1
node scripts/task007-gate-d/cleanup-isolated.mjs
node scripts/task007-gate-d.mjs audit
```

La integración usa actores y Centers propios para roles/RLS, privacy A/B, DOB mismatch, `NOT_LINKED`, ACTIVE reuse, carreras reales `create/create`, `create/link`, `link/link`, `reactivate/reactivate`, CAS stale, no-op y preservación de datos administrativos. E2E cubre RECEPTION desktop y móvil, NOT_FOUND, búsqueda tenant sin auto-resolve, edición, baja/reactivación, NOT_LINKED, ACTIVE reuse, mismatch, ADMIN, PROFESSIONAL y stale UI. El servidor Next de E2E corre desde una copia temporal de `src` y configuración, para preservar byte a byte el `next-env.d.ts` del checkout. Ejecutar `cleanup-isolated.mjs` incluso si Playwright falla; sólo elimina su ruta temporal registrada y se niega si el servidor sigue escuchando. El ledger conserva exactamente los IDs generados; si una creación UI sucede pero no se captura su UUID, `audit` bloqueará cleanup. No recuperar por prefijo, nombre o DELETE amplio.

Si integración o E2E falla, detener la secuencia de pruebas y conservar la salida de error. Ejecutar de todos modos `cleanup-isolated.mjs`, luego `audit` y, sólo si la propiedad exacta queda demostrada, `cleanup` y la verificación final. El fallo mantiene GATE D sin PASS aunque el baseline vuelva a su valor. Si `audit` detecta una fila creada sin UUID capturado u otra referencia ajena, **STOP cleanup** y revisar esos IDs con evidencia humana.

## 3. Smoke humano separado

Tras E2E PASS, iniciar el servidor aislado en un terminal dedicado y esperar a que `http://localhost:31007/login` responda:

```powershell
node scripts/task007-gate-d/isolated-dev-server.mjs
```

Ejecutar manualmente en desktop y móvil con el actor RECEPTION del ledger, sobre el Center A propio. Leer los datos de acceso sólo en otro terminal local:

```powershell
$task007Ledger = Get-Content .task007-gate-d/fixture-ledger.json -Raw | ConvertFrom-Json
$task007Ledger.actors.receptionA.email
$task007Ledger.password
$task007Ledger.ids.centerA
$task007Ledger.generated.smokeDocument
$task007Ledger.generated.manualUnlinkedDocument
```

Para el alta humana NOT_FOUND usar **exactamente** `smokeDocument`, nacionalidad `AR` y nacimiento `1990-01-01`. Tras confirmar el alta, copiar el UUID exacto de `patient=` en la URL y registrarlo inmediatamente:

```powershell
$task007PatientCenterId = Read-Host 'UUID exacto de patient= tras el alta'
node scripts/task007-gate-d.mjs capture-smoke $task007PatientCenterId
```

Para el vínculo humano NOT_LINKED usar **exactamente** `manualUnlinkedDocument` (Person ownada creada en `setup`), `AR` y `1990-01-01`. Tras confirmar el vínculo, copiar su UUID de `patient=` y registrarlo:

```powershell
$task007LinkedPatientCenterId = Read-Host 'UUID exacto de patient= tras el vínculo'
node scripts/task007-gate-d.mjs capture-smoke-link $task007LinkedPatientCenterId
```

Los comandos de captura comprueban en DB el UUID, documento exacto, nacimiento y Center propio antes de agregar IDs al ledger. Si la UI creó una fila pero no se obtuvo/capturó su UUID, detener cleanup. Registrar fecha, actor, viewport, pasos y veredicto **human-captured** para: navegación/listado y búsqueda miss sin auto-resolve; alta NOT_FOUND y confirmación; resolve NOT_LINKED/ACTIVE; DOB mismatch; edición de los cuatro campos administrativos, incluidas notas; baja, filtro INACTIVE, reactivación y preservación; stale y mensajes. Usar sólo fixtures del ledger. No declarar smoke PASS a partir de Playwright.

Al terminar, detener el servidor con Ctrl+C en su terminal y ejecutar `node scripts/task007-gate-d/cleanup-isolated.mjs` en el otro terminal antes de la auditoría final.

## 4. Cleanup exacto

Sólo después de registrar el smoke humano:

```powershell
node scripts/task007-gate-d.mjs audit
node scripts/task007-gate-d.mjs cleanup
```

`audit` exige cada fila ownada por UUID exacto, comprueba vínculos, Auth email/ID y ausencia de referencias ajenas, incluidas Appointments. `cleanup` vuelve a auditar; elimina por listas de UUIDs exactos y orden FK inverso en transacción DB, luego elimina cada Auth user por su ID exacto. Compara inventario completo posterior con el previo. Si encuentra referencias/ownership dudosos, **STOP cleanup**; no usar `LIKE`, comodines, broad DELETE, TRUNCATE ni reset.

## 5. Verificación final DEV

Después de `cleanup` PASS, en el mismo terminal autenticado:

```powershell
pnpm exec supabase migration list --linked
pnpm exec supabase db push --dry-run --linked
pnpm exec supabase db lint --linked
node scripts/verify-task007a-schema-v2.mjs
node --import ./scripts/compare-task007a-baseline-v2.mjs scripts/verify-task007a-baseline-v2.mjs
Get-FileHash scripts/verify-task007a-baseline-v2.mjs -Algorithm SHA256
Get-FileHash next-env.d.ts -Algorithm SHA256
git status --short
```

Exigir 19 migrations locales/remotas idénticas, dry-run `Remote database is up to date.`, lint sin errores, schema/API PASS, comparador V2 exact PASS, verifier SHA `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c`, digest `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`, y `next-env.d.ts` M/unstaged con SHA `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. Si cualquier control falla, TASK-007 no está ready for review. No regenerar baseline ni aplicar cambios de schema. No stage/commit/push antes de PASS integral.
