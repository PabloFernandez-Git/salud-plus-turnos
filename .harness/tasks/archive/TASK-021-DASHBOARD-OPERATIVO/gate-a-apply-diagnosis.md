# TASK-021 — Diagnóstico de Gate A apply detenido

**Estado histórico del primer intento (2026-10-22):** detenido antes de `COMMIT`; la conciliación posterior confirmó 24 versiones y ausencia de ambas RPC. **Estado actual de Gate A: PASS estructural DEV**, según la segunda ejecución y sus postchecks comunicados por la persona usuaria. No se conectó a DEV desde este agente.

## Evidencia recibida

La persona usuaria ejecutó una vez `run.ps1 -Mode apply` desde su PowerShell y comunicó:

```text
LOCAL PASS
PREFLIGHT PASS PostgreSQL=17.6 role=postgres migrations=24 target_only_pending=true
STOP TASK-021 [ERR_ASSERTION]
Expected: array de modos de argumentos
Actual: cadena PostgreSQL {i,t,t,t,...}
```

El proyecto/ref y SHA comunicados coinciden con los valores fijos del Gate A; la salida completa y el estado remoto aún no se han inspeccionado en esta fase.

## Causa y orden de operaciones

`pg_proc.proargmodes` es `char[]` (`_char`, OID 1002). La versión instalada de `pg` deja su representación textual `{i,t,...}` como `string`; `gate.mjs` comparaba directamente con un array JS. La aserción falló en `catalog(client, versions, true)` después de ejecutar los seis statements internos de la migration e insertar la versión en `supabase_migrations.schema_migrations`, todo dentro de la misma transacción. `commitAttempted` todavía era `false`: el flujo no llegó al comando `COMMIT`. El `catch` intentó `ROLLBACK` y luego cerró la conexión. Aunque PostgreSQL revierte una transacción abierta al cerrar la sesión, el código descarta un error eventual del `ROLLBACK`; por eso la persistencia se confirma sólo mediante la conciliación remota.

Gate A no tiene ledger local: el registro de versionado es la tabla remota `supabase_migrations.schema_migrations`. No se halló reporte local de `apply` adicional.

## Corrección local

`gate.mjs` ahora normaliza sólo `proargmodes` desde un array de caracteres de un elemento o el literal canónico PostgreSQL `{i,t,...}`. La aserción conserva cantidad, orden y valor exactos: un modo `i` seguido por un modo `t` por columna de salida. No se modificaron la migration, las RPC ni el resto del postcheck. Se auditaron los tipos del mismo SELECT con los parsers locales de `pg`: `text[]` (nombres, configuración, tipos de salida y statements) se convierte en array JS; `char`, `smallint` y `boolean` se convierten en sus tipos esperados. Sólo `_char` necesitaba esta normalización.

## Conciliación de solo lectura

`reconcile.mjs` abre transacciones `REPEATABLE READ READ ONLY`, lee identidad, las versiones, el registro de TASK-021 y ambas RPC con firmas, columnas, modos, atributos y permisos. Imprime un resumen `RECONCILE_OBSERVED`; luego exige una de dos secuencias exactas: 24 versiones y ninguna RPC, o 25 versiones y ambas RPC. `inspect()` repite los controles estrictos de catálogo, proyección, grants e historial, y un segundo snapshot exige que historial y RPC no hayan cambiado durante la conciliación. Cualquier estado mixto o fallo produce `STOP`; no hay DML, DDL ni retry.

Comando para ejecutar exclusivamente en el PowerShell de la persona usuaria, con contraseña oculta:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-dev\reconcile.ps1" -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

Compartir `RECONCILE_OBSERVED` y la línea final `RECONCILE_PASS` o `STOP`, sin credenciales. Si el estado es `PENDING_24_NO_RPCS`, la migration quedó pendiente; cualquier nueva ejecución de `apply` requiere una nueva autorización específica. Si es `APPLIED_25_TWO_RPCS`, no ejecutar `apply` y emitir dictamen estructural con la evidencia estricta. Si es inconsistente, detenerse e investigar la diferencia entre historial y catálogo.

## Verificación local y revisión

`node --test scripts/task021-dev/gate.test.mjs`: 3/3 PASS, incluidas la representación OID 1002 real, arrays JS y rechazos por longitud, orden o valor. `node scripts/task021-dev/reconcile.mjs local`, `node --check`, ESLint, Prettier y parser PowerShell PASS. Revisión independiente focal: PASS sin hallazgos bloqueantes; no hubo conexión DEV/PROD ni cambios remotos durante el diagnóstico.

## Continuación autorizada

La persona usuaria informó `RECONCILE_PASS state=PENDING_24_NO_RPCS migrations=24 strict_catalog=true` y concedió una nueva autorización **única** para `Gate A apply` en DEV. La ejecución será exclusivamente desde su PowerShell con entrada oculta; este agente no ejecutó el comando ni accedió a DEV. El verificador local conserva la normalización de `proargmodes`, su modo `local` y las tres pruebas focales PASS; SHA de la migration sin cambios. Queda pendiente recibir la salida de `apply` y emitir el dictamen estructural. Esta autorización no comprende Gate B ni un nuevo intento si el resultado es ambiguo.

## Gate A estructural DEV — PASS comunicado

La persona usuaria ejecutó desde su PowerShell la segunda y única aplicación autorizada después de `RECONCILE_PASS state=PENDING_24_NO_RPCS`. Comunicó la salida:

```text
LOCAL PASS
PREFLIGHT PASS PostgreSQL=17.6 role=postgres migrations=24 target_only_pending=true
APPLY_AND_POSTCHECK PASS version=20261022130000 sha256=7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1 migrations=25
```

El ejecutor repitió las precondiciones antes de escribir, aplicó exclusivamente `20261022130000_add_daily_dashboard_rpcs.sql` y registró la versión `20261022130000` en el historial. Su postcheck estricto posterior al COMMIT confirmó 25 versiones, ledger íntegro, ambas RPC con firmas `uuid`, proyecciones ordenadas, propietario `postgres`, `STABLE SECURITY DEFINER`, `search_path=''`, EXECUTE sólo para `authenticated`, funciones existentes y datos inventariados intactos. SHA aprobado: `7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`. Dictamen: **Gate A PASS estructural DEV** con base en la salida compartida; no se accedió a PROD ni se aplicó ninguna otra migration. No repetir `apply`.

La persona usuaria autorizó después exclusivamente el **preflight read-only de Gate B** desde su PowerShell. Gate B `run` y cualquier fixture siguen sin autorización.
