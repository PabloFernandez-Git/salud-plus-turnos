# TASK-021 — Gate B: cierre del incidente y preparación de nuevo run

## Cleanup anterior: PASS comunicado y estado local

La persona usuaria ejecutó una sola vez el cleanup del run
`c8c10bdb-705b-405e-8990-070edcd8bde6` y comunicó:

```text
TASK021_FUNCTIONAL_PREFLIGHT_PASS migrations=25 project=salud-plus-turnos-dev
TASK021_FUNCTIONAL_CLEANUP_PASS runId=c8c10bdb-705b-405e-8990-070edcd8bde6 resources=14 residue=0
```

Inspección local independiente de esa salida: el único archivo en
`.task021-functional-dev/` es el ledger histórico de ese run. Tiene `stage=cleaned`,
`cleanup.kind=rolled_back_auth_only`, seis resultados `delete_ack` con los UUID autorizados,
`finalInventory` de 14 recursos idéntico al baseline y evidencia conservada del
`FAIL stage=db_rolled_back code=23P01` junto con
`Exact six Auth cleanup and 14-resource baseline PASS`. `active.lock` no existe y no hay
ledgers inconclusos. `LOCAL_CLEANUP_LEDGER_PASS stage=cleaned auth_ack=6 inventory=14/14
lock=absent unfinished=0`. El ledger no se eliminó ni editó en esta preparación.

El PASS remoto y `residue=0` son la salida comunicada por la persona usuaria; este agente no
consultó DEV. La consistencia del ledger, inventario final y liberación del lock sí se
comprobaron localmente.

## Plan corregido que usará el próximo run

`run` llama `assertPlan(buildPlan())` tras el preflight y antes de crear recursos. Sin argumento,
`buildPlan` usa `randomUUID()` para un runId nuevo; la creación del ledger usa `flag: "wx"`, de
modo que una colisión con el archivo histórico detendría la ejecución antes de Auth/SQL. El
plan nuevo conserva seis Auth y 34 filas SQL propias como máximo, con 2 centros, 2 pacientes,
2 profesionales, sus relaciones indispensables y diez turnos. Todos los turnos duran 20
minutos y pertenecen al centro A sintético:

| Orden | Fixture | Estado | Vínculo | Intervalo relativo a `now`, minutos `[)` |
| --- | --- | --- | --- | --- |
| 1 | a1-pending-1 | PENDING | pcA | `[+45,+65)` |
| 2 | a2-pending | PENDING | pcA2 | `[+55,+75)` |
| 3 | a1-confirmed-1 | CONFIRMED | pcA | `[+65,+85)` |
| 4 | a1-pending-2 | PENDING | pcA | `[+85,+105)` |
| 5 | a1-confirmed-2 | CONFIRMED | pcA | `[+105,+125)` |
| 6 | a1-pending-3 | PENDING | pcA | `[+125,+145)` |
| 7 | a1-confirmed-3 | CONFIRMED | pcA | `[+145,+165)` |
| 8 | a1-attended | ATTENDED | pcA | `[-10,+10)` |
| 9 | a1-no-show | NO_SHOW | pcA | `[-30,-10)` |
| 10 | a1-cancelled | CANCELLED | pcA | `[-40,-20)` |

La exclusión GiST bloquea PENDING/CONFIRMED/ATTENDED/NO_SHOW por el mismo
`professional_center_id` y permite límites contiguos `[)`. Los seis futuros de pcA no se
superponen; NO_SHOW termina exactamente donde empieza ATTENDED; pcA2 es independiente;
CANCELLED no bloquea. `assertPlan` rechaza solapamientos. El centro usa
`America/Argentina/Buenos_Aires`; `buildPlan` exige que `now-40` y `now+165` caigan en su
misma fecha civil. Si la ventana no cabe, detiene antes de crear fixtures. Los conteos
originales se conservan: staff 4 PENDING, 3 CONFIRMED, 1 ATTENDED, 1 NO_SHOW, 1 CANCELLED y
dos profesionales con turnos; pcA 3/3/1/1/1; pcA2 un PENDING. Se conservan cinco próximos
en orden estable para staff y pcA.

## Secuencia de Gate B preparada

`run.ps1 -Mode run` pide contraseña PostgreSQL, secret key Auth Admin y publishable key por
entrada oculta, exige project ref DEV/CA aprobada y no apunta a PROD. `gate.mjs` ejecuta
`remotePreflight()` antes de escribir, que verifica PostgreSQL, 25 migrations, dos RPC,
firmas, proyecciones, permisos y catálogo con snapshot read-only. Después valida el plan,
comprueba que no haya lock ni ledger inconcluso, abre lock exclusivo, repite el preflight y
verifica ausencia de sus IDs/emails antes de crear recursos.

Auth Admin crea seis usuarios con email/metadata de runId y guarda ID por actor en el ledger.
Los 34 registros SQL se insertan dentro de una transacción; se verifica ownership antes de
probar RPC por ADMIN, RECEPTION, PROFESSIONAL, otro centro y sin membresía, además de
desactivaciones/restauraciones controladas de membresía y vínculo. Playwright ejecuta
Chromium autenticado contra Next.js en una copia temporal, puerto exclusivo 31021 y
`reuseExistingServer=false`; si está ocupado, se detiene sin reutilizar el servidor ajeno.
La prueba cubre Dashboard por rol, proyección profesional, estados vacío/error/reintento,
actualización y navegación. El cleanup genérico exige ownership, elimina sólo IDs propios,
comprueba ausencia e inventario final igual al baseline en 14 recursos, y sólo entonces emite
`TASK021_FUNCTIONAL_PASS ... residue=0`.

Auth Admin opera fuera de la transacción SQL. Una creación o borrado ambiguos pueden dejar
recursos parciales: el ejecutor conserva ledger/lock, se detiene y no reintenta
automáticamente. En tal caso correspondería otra conciliación read-only y una autorización
separada para cualquier cleanup. El plan deja 45 minutos antes del primer turno futuro; si
la ejecución funcional durara más, los próximos turnos podrían cambiar y el test debería
detenerse sin declarar PASS. El estado actual de DEV se revalidará sólo durante el próximo
run, si se autoriza.

## Verificación local y revisión

`run.ps1 -Mode local`: `TASK021_FUNCTIONAL_LOCAL_PASS
fixtures=6_auth/2_centers/2_professionals/2_patients/10_appointments`. Pruebas focales del
plan, inventario y cleanup: **17/17 PASS**. Prettier y ESLint focales PASS; SHA-256 de la
migration aprobada intacto:
`7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`.
`playwright --list` sin fixture se detuvo por diseño al faltar
`TASK021_LEDGER_PATH/TASK021_FIXTURE_PASSWORD`; Chromium autenticado queda para Gate B.

Revisión independiente focal: **PASS sin bloqueantes**. Confirmó ledger/lock locales,
cronograma y ausencia de solapamientos, nuevo runId, preflight, aislamiento del servidor,
control de ownership/cleanup y tratamiento conservador de fallos Auth. No hubo conexión a DEV
o PROD, fixtures nuevos, migrations, cambios de UI, commit, push ni PR.

## Autorización específica recibida para una ejecución

La persona usuaria autorizó una única nueva ejecución de Gate B `run` en
`salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), exclusivamente desde su PowerShell local.
La autorización cubre el preflight previo a escrituras, hasta 40 fixtures sintéticos, pruebas
RPC y Chromium autenticado, evidencia por escenario y cleanup exacto con inventarios 14/14
y `residue=0`. No habilita reintentos, cleanup separado, PROD, migrations ni cambios de
RPC, RLS, permisos o UI. El agente no ejecutó el comando ni se conectó a DEV.

Comprobación local tras recibir la autorización: el único ledger anterior conserva
`stage=cleaned` y las seis respuestas `delete_ack`; `active.lock` permanece ausente. La
ejecución generará un runId nuevo y repetirá sus precondiciones remotas antes de escribir.

## Comando para la única ejecución autorizada desde PowerShell

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

Ante un STOP o resultado ambiguo, conservar salida, ledger y lock. No repetir `run` ni
ejecutar `cleanup` separado sin conciliación y autorización nuevas.
