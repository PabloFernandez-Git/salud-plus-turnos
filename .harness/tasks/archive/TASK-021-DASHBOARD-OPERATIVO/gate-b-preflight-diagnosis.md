# TASK-021 — Diagnóstico del primer preflight Gate B detenido

**Estado histórico del primer intento (2026-10-22):** preflight read-only comunicado con `STOP TASK-021 Gate B [ERR_ASSERTION]`. La corrección local y la revisión focal obtuvieron PASS. **Estado actual:** la persona usuaria comunicó un nuevo preflight PASS y autorizó una única ejecución de Gate B `run` desde su PowerShell. Este agente no se conectó a DEV.

## Causa exacta y evidencia

`remotePreflight()` hacía `assert.deepEqual(data, state.data)`. El **esperado** `state.data` provenía de `inspect()` de Gate A en una transacción `REPEATABLE READ READ ONLY`; el **observado** `data` provenía después de `database.inventory()` de Gate B en otra transacción `REPEATABLE READ READ ONLY`. Cada lector ordenaba por su propia lista de 14 recursos. Gate A tiene `private.provisioning_operations` en el índice 1; Gate B tiene `public.users` en el índice 1. Por eso el array fallaba aunque todos los count/digest por tabla coincidieran. El primer elemento de ambas listas es `auth.users`; el fragmento visible `count="1", digest="013a56e27becd9ebd0add67162b650a8"` no identifica una diferencia real de datos.

Las dos capturas originales eran fotografías separadas. Una escritura legítima concurrente podría haber cambiado count/digest entre ellas, pero la diferencia de orden basta para explicar el STOP. La salida truncada no permite afirmar un cambio remoto de ninguna tabla ni un residuo de fixtures. La primera diferencia **demostrable localmente** fue de identidad de tabla en el índice 1, no de count ni digest.

El modo `preflight` retornaba después de `remotePreflight()` y antes de `adminProbe`, `mkdirSync`, lock, ledger, Auth Admin o DML. `inspect()` y `database.inventory()` abrían transacciones read-only y ejecutaban `ROLLBACK`. El directorio local `.task021-functional-dev/` existe pero está vacío: cero archivos de lock, ledger o reporte. No hay evidencia de escritura remota o fixture causado por este intento.

## Corrección focal

`task021-dev/gate.mjs` admite un callback opcional de verificación dentro de la misma transacción `REPEATABLE READ READ ONLY` de `inspect()`. Gate B ejecuta allí `inventoryRows()` con 14 SELECT, comprueba que la transacción sea `READ ONLY` y compara ambos inventarios por **nombre de tabla**, con 14 recursos únicos y count/digest exactos. `canonicalInventory()` normaliza sólo el orden. Una tabla faltante, duplicada, count o digest diferente sigue causando STOP. El inventario inicial/final del cleanup usa el mismo comparador estricto. Las llamadas previas de Gate A conservan su comportamiento; no se modificaron RPC, migration, UI ni Auth.

## Verificación y límite

Pruebas locales de inventario y plan: **6/6 PASS**. Reproducen el orden original, confirman equivalencia con datos iguales y STOP ante count/digest alterados, filas faltantes o duplicadas; comprueban que el lector secundario sólo emite SELECT. Modo Gate B `local`, `node --check`, ESLint, Prettier y `git diff --check`: PASS. SHA de la migration intacto: `7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`.

Revisión independiente focal: **PASS sin bloqueantes**. Confirmó una única fotografía transaccional read-only, STOP ante diferencias reales de count/digest, ausencia de escrituras en preflight y compatibilidad de los demás modos. El digest de inventario cubre claves de fila, como ya hacía antes de esta corrección; no es un hash de todas las columnas.

## Próximo paso, sujeto a confirmación

La corrección está lista para **repetir únicamente el preflight read-only**, si la persona usuaria lo confirma. Comando exacto desde su PowerShell, con contraseña oculta:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode preflight -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

No ejecutar `run` ni crear fixtures sin autorización separada. Si el preflight vuelve a detenerse, conservar salida completa y no atribuirlo al orden sin inspeccionar el nuevo error.

## Preflight PASS y autorización única de run

La persona usuaria ejecutó nuevamente el preflight desde PowerShell y comunicó `TASK021_FUNCTIONAL_PREFLIGHT_PASS migrations=25 project=salud-plus-turnos-dev`. Con ese resultado autorizó **una única ejecución controlada de `run`**, exclusivamente en DEV (`ehllxymqyzrofydrvtzo`), desde su propio PowerShell con credenciales ocultas. El ejecutor volverá a ejecutar `remotePreflight()` y `assertPlan(buildPlan())` antes de cualquier escritura; el plan permite como máximo 6 Auth users y 34 filas DB (40 recursos), identificados por runId y ledger. Luego comprueba RPC y Chromium por rol, intenta cleanup exacto cuando el estado es conocido y sólo declara PASS integral con inventarios inicial/final iguales y `residue=0`. Un resultado ambiguo conserva el ledger y exige conciliación/cleanup con autorización aparte; no reintentar `run`.

Comando reservado a la persona usuaria:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

La verificación local previa a esta autorización: `run.ps1 -Mode local` PASS; pruebas focales de inventario y plan 6/6 PASS; SHA de la migration `7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`, directorio local de estado sin archivos. No se ejecutó `run` desde este agente. Pendiente recibir salida completa para evaluar preflight, runId, RPC, Chromium, cleanup, inventarios y residuo final. Esta autorización no incluye PROD, migrations, cambios de código, reintentos ni cleanup separado.
