# TASK-021 — Cierre de Gate B y refinamiento final

## Gate B DEV

La persona usuaria ejecutó el único `run` autorizado desde PowerShell y comunicó:

```text
TASK021_FUNCTIONAL_PREFLIGHT_PASS migrations=25 project=salud-plus-turnos-dev
Chromium: 1 passed (1.2m)
TASK021_FUNCTIONAL_CLEANUP_PASS resources=14 residue=0
TASK021_FUNCTIONAL_PASS residue=0
```

Inspección local del último ledger `run-2a6cabc8-d5da-4f33-b298-5c4f64efbb66.json`:
`stage=cleaned`, `plan.runId` coincidente, evidencia
`Authenticated RPC and Chromium PASS`, e inventarios `baseline` y `finalInventory`
idénticos en los 14 recursos. `active.lock` está ausente. Los cuatro ledgers
históricos permanecen preservados y todos están en `cleaned`. El ledger registra
la conclusión del ejecutor; el detalle `Chromium: 1 passed` proviene de la salida
PowerShell comunicada. No hubo nueva conexión a DEV ni PROD desde este agente.

**Dictamen Gate B: PASS integral, `residue=0`.** No se repitió `run` ni `cleanup`.

## Vitest y refinamientos visuales

El error anterior de inicio `EPERM` se produjo cuando el cargador `bundle` de Vite
intentó escribir bajo `node_modules/.vite-temp`. En el worktree aislado, la ACL de
`node_modules` concede sólo lectura al usuario de sandbox. La opción
`--configLoader runner` carga la configuración sin esa escritura; no altera Node,
pnpm, el checkout habitual ni la cobertura. Las pruebas `node:test` de los scripts
de Gate A/B se ejecutan con `node --test`, fuera de Vitest.

Los ajustes de presentación son:

- Indicadores: dos columnas en móvil y cuatro en escritorio, con tarjetas que
  admiten contenido largo sin desbordarse.
- Fecha: texto legible de la fecha civil y hora real del centro según
  `centers.timezone`, sin cambiar el cálculo de medianoche ni el offset de los
  turnos.
- Error: mensaje y una sola acción `Reintentar`; se ocultan fecha pendiente y
  botón `Actualizar`. Con datos cargados, `Actualizar` conserva su comportamiento.

El E2E de TASK-021 ahora comprueba el formato legible y el Chromium local comprueba
la geometría de la grilla y los controles de error. No se cambiaron RPC, RLS,
autorización, reglas de negocio ni navegación.

Los seis PNG de `artifacts/task021-dashboard-ui/` corresponden a una captura
**anterior** a estos tres refinamientos. Se conservan como evidencia histórica de
la etapa previa y no representan la presentación final. La geometría, estados y
navegación actuales se verificaron con Chromium local sobre los componentes reales.

## Verificación y revisión

Verificación local posterior a los refinamientos:

| Control | Resultado |
| --- | --- |
| Vitest focal Dashboard con `--configLoader runner` | 4 archivos, 21/21 PASS |
| Vitest completo, excluyendo sólo los archivos `node:test` ejecutados por separado, sin paralelismo | 92 archivos, 706/706 PASS |
| `node --test` Gate A/B | 21/21 PASS |
| Chromium local con componentes reales y respuestas controladas | 13/13 escenarios PASS; roles, privacidad, escritorio/móvil, carga, vacío, error, reintento, actualización y navegación |
| TypeScript (`tsc --noEmit --incremental false`) | PASS |
| ESLint y Prettier focales; sintaxis de E2E/harness; `git diff --check` | PASS |

La primera corrida global de Vitest, con paralelismo, también recogió archivos
`node:test` de TASK-021 y mostró un fallo aislado en una prueba de Turnos. Esa
prueba pasó por separado (7/7); luego la suite Vitest completa pasó 706/706 sin
paralelismo. Los archivos `node:test` excluidos de Vitest se ejecutaron con su
runner propio (21/21), por lo que no se omitieron pruebas.

La revisión independiente concluyó **READY, sin bloqueantes**. Confirmó que los
tres ajustes se limitan a presentación y pruebas, conservan cálculos DST,
aislamiento por rol, privacidad, enlaces y navegación; no se tocaron RPC, RLS,
autorización ni reglas de negocio. También verificó el ledger local, los cuatro
ledgers `cleaned` y la ausencia de `active.lock`, y aceptó que los PNG antiguos
queden rotulados como evidencia histórica. La revisión no reconectó DEV/PROD.

**Dictamen técnico: TASK-021 READY_FOR_PR.** No se preparó ni publicó PR, ni se
hizo commit o push. La evidencia remota de Chromium 1/1 PASS procede de la salida
comunicada por la persona usuaria; el ledger local registra RPC/Chromium PASS y
cleanup verificado con inventarios idénticos.
