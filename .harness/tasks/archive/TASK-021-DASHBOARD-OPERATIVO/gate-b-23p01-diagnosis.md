# TASK-021 — Gate B 23P01 y conciliación pendiente

## Estado preservado

La persona usuaria ejecutó una sola vez `run` en DEV y comunicó preflight PASS, runId
`c8c10bdb-705b-405e-8990-070edcd8bde6` y STOP `23P01` en
`appointments_no_blocking_overlap`. No se ejecutó `run`, `reconcile` ni `cleanup` desde este
agente. El ledger local y `active.lock` permanecen intactos. SHA-256 del ledger observado:
`1B03FAF23A83D7777012C6A8593C49CCCF92EA2E91F492924B2994C0716A2D29`.

## Causa y punto exacto

La exclusión GiST de `20260921210000_use_explicit_appointment_blocking_statuses.sql`
prohíbe, para un mismo `professional_center_id`, rangos `tstzrange(starts_at, ends_at, '[)')`
superpuestos con estado PENDING, CONFIRMED, ATTENDED o NO_SHOW. CANCELLED no bloquea.

El plan guardado en el ledger usa `centerA=578d432e-de02-48f5-a3ac-cda98257dbcc`,
`pcA=b861a71d-5ddb-4b42-8798-4a9acece7ab2` y
`pcA2=56d76baa-bda9-49fb-b3a0-bad60964afe8`. Los diez turnos duran 20 minutos:

| Orden de INSERT | Fixture | Estado | Vínculo profesional | Inicio UTC | Fin UTC |
| --- | --- | --- | --- | --- | --- |
| 1 | `a1-pending-1` (`70a72e33-be85-4d22-8596-cb13be54c3e3`) | PENDING | pcA | 2026-10-22 23:22:55.577 | 2026-10-22 23:42:55.577 |
| 2 | `a2-pending` | PENDING | pcA2 | 2026-10-22 23:32:55.577 | 2026-10-22 23:52:55.577 |
| 3 | `a1-confirmed-1` (`92947e14-48e3-4917-805e-a0ab61af0479`) | CONFIRMED | pcA | 2026-10-22 23:32:55.577 | 2026-10-22 23:52:55.577 |
| 4 | `a1-pending-2` | PENDING | pcA | 2026-10-22 23:42:55.577 | 2026-10-23 00:02:55.577 |
| 5 | `a1-confirmed-2` | CONFIRMED | pcA | 2026-10-22 23:52:55.577 | 2026-10-23 00:12:55.577 |
| 6 | `a1-pending-3` | PENDING | pcA | 2026-10-23 00:02:55.577 | 2026-10-23 00:22:55.577 |
| 7 | `a1-confirmed-3` | CONFIRMED | pcA | 2026-10-23 00:12:55.577 | 2026-10-23 00:32:55.577 |
| 8 | `a1-attended` | ATTENDED | pcA | 2026-10-22 22:27:55.577 | 2026-10-22 22:47:55.577 |
| 9 | `a1-no-show` | NO_SHOW | pcA | 2026-10-22 22:17:55.577 | 2026-10-22 22:37:55.577 |
| 10 | `a1-cancelled` | CANCELLED | pcA | 2026-10-22 22:07:55.577 | 2026-10-22 22:27:55.577 |

El tercero se solapa diez minutos con el primero, en el mismo `pcA`. El segundo comparte
horario pero usa otro vínculo profesional, por lo que no entra en esa exclusión. El código
inserta `plan.appointments` en orden dentro de una transacción; este es el primer choque
determinístico del plan. Los turnos `NO_SHOW` `[-20,0)` y `ATTENDED` `[-10,+10)` también se
solapaban en `pcA` y habrían fallado después. El `center_id` y los IDs profesionales se toman
directamente de `plan.ids`; se envían `startsAt`/`endsAt` ISO UTC a PostgreSQL sin conversión
intermedia. La zona `America/Argentina/Buenos_Aires` sólo determina el día civil del plan y
de las RPC. No hay evidencia de transformación horaria ni de una cita preexistente que explique
este error; además, `absent()` comprobó los IDs propios antes de escribir y el vínculo `pcA`
fue creado en la misma transacción que los turnos.

## Ledger y límites de la evidencia

El ledger terminó en `stage=db_rolled_back`, con evidencia
`FAIL stage=db_rolled_back code=23P01`, plan y baseline de 14 recursos, seis actores Auth con
IDs registrados y sin inventario final ni evidencia RPC/Chromium. Antes de la transacción SQL,
`createAuth()` había completado seis llamadas Auth Admin y guardado sus IDs. El plan contiene
34 filas SQL: 24 INSERT de preparación y diez de turnos. Los 24 de preparación y los primeros
dos turnos se insertaron dentro de una sola transacción; el tercer INSERT de `appointments`
falla antes de intentar COMMIT.
El bloque de error intenta `ROLLBACK` y luego guarda `db_rolled_back`, pero su `.catch(() => {})`
no verifica el resultado remoto del rollback. Por eso el ledger respalda que se intentó, no
prueba por sí solo el estado remoto. Las seis cuentas Auth se crearon fuera de la transacción
y pueden permanecer. Hubo como máximo 26 INSERT SQL exitosos pero no comprometidos antes del
error; bajo la semántica transaccional de PostgreSQL deben revertirse. La consulta remota debe
confirmar cero filas SQL propias y cuántas cuentas Auth permanecen antes de decidir una
limpieza. No se afirma `residue=0`.

`gate.mjs` no inicia cleanup automático para `db_rolled_back`; sólo cierra la conexión. El lock
`active.lock` conserva el mismo runId y bloquea nuevas ejecuciones. No hay etapa de cleanup
registrada ni `residue=0`.

## Corrección local del plan

`plan.mjs` mantiene veinte minutos por turno. Los seis turnos futuros bloqueantes de `pcA`
comienzan a `+45,+65,+85,+105,+125,+145` minutos; `NO_SHOW` pasa a `-30` y `CANCELLED`
a `-40`, con `ATTENDED` en `-10`. El extremo máximo `+165` debe quedar en el mismo día civil.
`assertPlan()` comprueba para cada par bloqueante del mismo `professionalCenter` que los
intervalos `[)` sean disjuntos y valida cada intervalo. No cambia RPC, migration, constraint,
datos de producto ni el ledger de este run.

Pruebas focales: 8/8 PASS. Incluyen reproducción del choque futuro `+45/+55`, del choque
histórico y la aceptación de intervalos contiguos. El SHA de la migration TASK-021 sigue en
`7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`.

Revisión independiente focal: **PASS sin bloqueantes**. Confirmó causa local determinística,
trazabilidad del ledger, riesgo de seis cuentas Auth fuera de SQL, rechazo de futuros
solapamientos y que `reconcile` no muta DEV. El plan nuevo no altera los IDs ni horarios del
ledger histórico: conciliación y eventual cleanup separado usarán ese ledger intacto. El
review no afirma que DEV esté limpio; requiere la consulta read-only.

## Conciliación remota reservada a la persona usuaria

`run.ps1 -Mode reconcile` exige el project ref exacto y la contraseña PostgreSQL por entrada
oculta. `gate.mjs` ejecuta primero el preflight estructural de DEV en transacción `REPEATABLE
READ READ ONLY`, lee el ledger y llama a `ownership()` en transacción `READ ONLY`. Esta última
compara los IDs y atributos propios en 14 recursos con el plan y lee `auth.users` por los seis
emails de este run, exigiendo `gate=TASK-021`, `runId` e ID esperado. No invoca Auth Admin,
`cleanupDatabase`, `deleteUser`, `insertFixtures`, `save()` ni `releaseLock()`.

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode reconcile -ConfirmProjectRef ehllxymqyzrofydrvtzo -RunId c8c10bdb-705b-405e-8990-070edcd8bde6
```

La salida debe permitir distinguir cuentas Auth presentes y conteos SQL propios. Compararla
con el ledger antes de decidir una limpieza separada, bajo autorización nueva y específica.
No se autoriza un segundo `run` ni una escritura remota por esta corrección.

## Conciliación comunicada después

La persona usuaria ejecutó el comando read-only y comunicó preflight PASS, seis
`auth.users` propios del run y cero filas propias en los otros trece recursos. Los seis UUID,
correos y metadatos `gate=TASK-021`/`runId` coincidieron. Este agente no se conectó a DEV.
El cleanup exacto quedó preparado, sin ejecutar, en
[`gate-b-auth-cleanup-preparation.md`](gate-b-auth-cleanup-preparation.md).
