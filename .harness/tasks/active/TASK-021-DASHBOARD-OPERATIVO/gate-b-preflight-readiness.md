# TASK-021 — Gate B preflight: preparación inicial

**Actualización:** el primer preflight se detuvo por un defecto local de comparación de inventarios; corrección y revisión PASS en [gate-b-preflight-diagnosis.md](gate-b-preflight-diagnosis.md). Repetirlo espera confirmación de la persona usuaria.

**Estado (2026-10-22):** Gate A estructural DEV PASS según la salida `APPLY_AND_POSTCHECK PASS version=20261022130000 sha256=7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1 migrations=25` compartida por la persona usuaria. Sólo está autorizado el preflight read-only de Gate B, ejecutado desde su PowerShell. Gate B `run`, Auth Admin, fixtures y Chromium remoto no están autorizados.

Antes de conectar, `preflight` comprueba localmente el plan sintético de 6 Auth users y 10 turnos, la cobertura exacta de 14 recursos entre propiedad de fixtures e inventario/cleanup, y ausencia de un lock o ledger Gate B inconcluso. Después usa `inspect()` en transacción `READ ONLY` para exigir las 25 migrations, versión TASK-021, ambas RPC, proyecciones, permisos y catálogo compatibles; compara el inventario de 14 recursos. Retorna antes de Auth Admin y de cualquier DML/DDL. El lanzador PowerShell pide sólo contraseña PostgreSQL DEV mediante entrada oculta y verifica ref y CA fijos.

Comando autorizado para la persona usuaria:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode preflight -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

El plan local usa una fecha fija para comprobar estructura. Un PASS de preflight no promete que un `run` futuro se encuentre dentro de la ventana civil permitida; `run` vuelve a comprobarla antes de escribir. La revisión independiente focal del nuevo control preflight dictaminó PASS sin bloqueantes. `run.ps1 -Mode local`, pruebas del plan 2/2, ESLint, Prettier y parser PowerShell PASS. Ningún modo remoto de Gate B fue ejecutado por este agente.
