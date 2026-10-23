# TASK-021 — Gate B: diagnóstico de la aserción Chromium

## Resultado y estado del run

La persona usuaria ejecutó una vez Gate B en `salud-plus-turnos-dev` y comunicó preflight
PASS, runId `37e4c23d-0254-4980-9ae2-34b622dddccb`, un fallo Chromium y
`TASK021_FUNCTIONAL_CLEANUP_PASS ... resources=14 residue=0`; el ejecutor terminó con
`STOP TASK-021 Gate B [CHECK]: Chromium exit 1`. No hubo PASS funcional integral.

La inspección **local** del ledger de ese run confirma `stage=cleaned`, seis actores Auth
registrados, `baseline` y `finalInventory` idénticos en los 14 recursos, y evidencia
`FAIL stage=fixtures_ready code=CHECK`. `active.lock` no existe. El ledger previo
`c8c10bdb-705b-405e-8990-070edcd8bde6` permanece `cleaned`; ambos archivos fueron
preservados. `residue=0` es la salida comunicada por la persona usuaria y está respaldada
por la igualdad de inventarios del ledger; no se consultó DEV en este diagnóstico.

El flujo de `gate.mjs` ejecuta `rpcChecks()` completo y guarda `rpc_checks_pass` antes de
guardar `fixtures_ready` y abrir Chromium. Por lo tanto, el estado de fallo
`fixtures_ready` demuestra que `rpcChecks()` retornó sin error. Esto incluye sus
aserciones por ADMIN, RECEPTION, ambos PROFESSIONAL, otro centro, usuario sin membresía y
vínculos inactivos. El ledger no conserva un resultado individual por RPC, y el mensaje
final `Authenticated RPC and Chromium PASS` no se escribió. En la prueba Chromium
se completaron las llamadas a `assertDashboard` de ADMIN y RECEPTION; la del primer
PROFESSIONAL llegó a la aserción de aislamiento y falló. PROFESSIONAL A2, móvil,
denegaciones UI y estados de error/reintento/actualización no llegaron a ejecutarse.

## Causa confirmada por el DOM

`error-context.md` muestra cinco enlaces del profesional A. Cada nombre accesible
termina en `Ver detalle de Task021 Patient A`; ninguno nombra a `Task021 Patient A2`.
El DOM del Dashboard contiene el nombre y la hora en un `span` de cada enlace. La
aserción antigua aplicaba `not.toContainText("Task021 Patient A2")` a **toda** la sección.
El `textContent` de la sección concatenó el final del primer enlace, `...Patient A`, con
la hora del siguiente, `21:15`, y produjo `...Patient A21:15`. Éste es el falso positivo;
la captura no demuestra exposición de Patient A2 al profesional A.

## Corrección local del E2E

El selector `patientLink()` busca enlaces por rol y nombre accesible con límites de palabra,
de forma individual. La aserción negativa comprueba que no haya un enlace del paciente del
otro profesional. Por cada fila, el E2E comprueba además el texto **exacto** del `span`
visible de hora y paciente; así, `Patient A2` no satisface `Patient A`. Se corrigió una
aserción análoga de nombre profesional staff, que antes usaba una subcadena `A`/`A2`.
Los controles de UUIDs de turnos ajenos permanecen. Las ausencias de DNI y correo ahora
incluyen explícitamente a **ambos** pacientes sintéticos, A y A2. No se modificaron UI,
RPC, migration, RLS, permisos ni lógica de producto.

La prueba local de DOM reproduce literalmente `Task021 Patient A21:15` en el texto de la
sección sin enlace de A2 y obtiene PASS. Al insertar realmente un enlace de Patient A2,
la aserción de ausencia falla. También prueba la dirección inversa A/A2 y que un nombre
visible incorrecto falla aunque el texto accesible oculto diga A. La prueba no usa DEV.

## Verificación y alcance pendiente

- Regresión DOM en Chromium local: PASS.
- ESLint focal: PASS.
- TypeScript `tsc --noEmit --incremental false`: PASS.
- Prettier focal: PASS.
- Revisión independiente focal: **PASS sin bloqueantes**. Confirmó la causa en
  `error-context.md`, los selectores y nombres visibles exactos, la regresión negativa
  con A2 real, las garantías de privacidad, el alcance parcial de Chromium y el estado
  `cleaned` con inventarios 14/14 y lock ausente. No encontró otras negaciones de nombre
  paciente sobre texto concatenado de la sección.

La corrección local y el cierre del cleanup dejan el proyecto en condiciones de **solicitar**
una nueva autorización específica de Gate B `run`. El E2E autenticado completo sólo puede
concluirse mediante esa nueva ejecución remota. La autorización del run
`37e4c23d-0254-4980-9ae2-34b622dddccb` está consumida. No se hizo nueva conexión a
DEV, ejecución de run/cleanup, fixtures, migrations, commit, push ni PR.

## Autorización posterior: una nueva ejecución desde PowerShell de la persona usuaria

La persona usuaria otorgó una autorización específica para **un único** Gate B `run` en
`salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`). Debe ejecutarlo desde su PowerShell
local; este agente no ejecutó el comando. No autoriza reintentos automáticos, cleanup
separado, PROD, migrations, cambios de RPC/RLS/permisos/UI, commit, push ni PR.

La comprobación local previa a entregar el comando confirmó:

- Ambos ledgers históricos en `cleaned`, con 14 inventarios iniciales y finales cada uno;
  `active.lock` ausente y ningún ledger inconcluso.
- `run.ps1 -Mode local`: `TASK021_FUNCTIONAL_LOCAL_PASS` con seis Auth, dos centros,
  dos profesionales, dos pacientes y diez turnos. La validación de la fecha civil
  `America/Argentina/Buenos_Aires` se repetirá en el instante del nuevo run.
- Plan, inventario, cleanup y selector DOM: **18/18 PASS**.
- `gate.mjs` invoca directamente `tests/e2e/task-021-dashboard-dev.spec.mjs`, que importa
  `task-021-patient-link.mjs` y usa el selector corregido. SHA-256 actual del E2E:
  `D2AB3DD1996046F08EEEB023DC1536544EB43611E40EAE3D9C19AEF44914FBFF`.
- El run repetirá preflight remoto, verificará identidad DEV, 25 migrations y contratos
  de ambas RPC, exigirá ausencia de lock/ledgers inconclusos, generará runId nuevo,
  validará plan y ventana, y capturará inventario inicial antes de crear fixtures.

Comando exacto reservado para la única ejecución autorizada:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

Si ocurre un STOP o resultado ambiguo, conservar salida, ledger y lock. No repetir `run`
ni ejecutar `cleanup` separado sin conciliación y autorización nuevas. Un único test
Chromium PASS implica que recorrió todos sus escenarios secuenciales; si falla, se
informará exactamente hasta cuál avanzó y no se declarará Gate B PASS integral.
