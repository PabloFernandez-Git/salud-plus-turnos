# TASK-021 — Gate B: fallo de carga móvil y auditoría preventiva del E2E

## Evidencia del run detenido

La persona usuaria comunicó preflight DEV PASS, runId
`f27b72bc-ed76-4942-850c-d98607d39c9d`, un fallo Chromium y
`TASK021_FUNCTIONAL_CLEANUP_PASS ... resources=14 residue=0`, seguido de
`STOP TASK-021 Gate B [CHECK]: Chromium exit 1`. Este agente no consultó DEV ni repitió
`run` o `cleanup`.

El ledger local de ese run está en `stage=cleaned`; `baseline` y `finalInventory` son
idénticos en los 14 recursos y conserva `FAIL stage=fixtures_ready code=CHECK`.
`active.lock` no existe. Los otros dos ledgers históricos permanecen. El stage
`fixtures_ready` implica por el orden de `gate.mjs` que `rpcChecks()` completó sus
aserciones antes de abrir Chromium. No consta un PASS Chromium integral.

El error-context disponible registra un único `role=status` en la sección de actividad
durante los cinco segundos del `expect(...).toHaveCount(0)` anterior. El código del
`DailyDashboardPanel` crea dentro de esa sección un solo status en fase `loading`, cuyo
texto es **«Cargando actividad…»**. La evidencia de Playwright no contiene snapshot DOM,
árbol accesible, trace, captura, respuesta de Server Action ni logs persistidos de Next;
`playwright.task021.config.ts` tiene trace/screenshot/video desactivados y el servidor
aislado emite a la terminal, sin archivo local. Por ello está demostrado que el test
observó loading durante cinco segundos, pero no si la petición seguía lenta, quedó
pendiente, hubo nueva revisión del componente o un problema de transporte. No hay
evidencia de respuesta RPC fallida ni de defecto funcional del Dashboard.

El stack apunta a `assertDashboard(mobile.page, i.pcA, "professional")`: PROFESSIONAL A
en viewport 390×844, justo después del login. Las cuatro comprobaciones desktop
(ADMIN, RECEPTION, PROFESSIONAL A y PROFESSIONAL A2) debieron completar en el bucle
secuencial previo. El centro B, usuario sin membresía, denegaciones UI, error/reintento,
actualizaciones y vacíos no habían empezado.

## Corrección del test y auditoría completa

`dashboardReady()` espera un desenlace semántico: `dl` de métricas cargadas **o** alerta.
Si aparece alerta de error/denegación, falla inmediatamente; si se cumple el presupuesto
acotado de 30 segundos sin desenlace, falla e informa sólo el texto de status. Tras los
datos exige ausencia de status y encabezado de próximos. El límite corresponde al
`actionTimeout` configurado y permite una respuesta demorada; no hay sleeps en el E2E.
No se tocó el componente de producción.

La lectura completa del spec detectó además una llamada residual a `ready()` en el
último escenario tras haber extraído el helper: habría producido `ReferenceError` al
llegar al estado vacío. Se cambió por `dashboardReady()` y se verificó explícitamente
`no-undef`. La anterior prueba de ancho `body.scrollWidth != 0` no comprobaba el diseño
móvil; ahora exige `document.documentElement.scrollWidth <= window.innerWidth`.

Auditoría de los demás bloques:

| Bloque | Resultado de revisión |
| --- | --- |
| ADMIN/RECEPTION y profesionales A/A2 | Métricas y tarjetas por rol, href/orden/identidad de hasta cinco próximos; nombres visibles exactos; IDs ajenos y DNI/correos ausentes para profesionales. |
| Centro B y usuario sin membresía | La prueba espera vacío autorizado en B y 404 sin datos de A al navegar al centro ajeno; el no vinculado espera 404 sin datos. |
| Fechas/horas | El plan fija los intervalos en un mismo día civil del centro y el E2E compara `localDate`, zona y hora con offset. El run vuelve a validar ventana temporal antes de escribir. |
| Error, retry y refresh | Error debe quitar `dl` y conservar tarjetas; retry exige nuevo `dl`; cambios de estado exigen conteos o lista/aviso distintos, de modo que una fotografía anterior no basta para PASS. |
| Vacíos | Distingue centro sin turnos de actividad registrada sin próximos, y comprueba cancelación total. |
| Selecciones y sesiones | No quedan búsquedas negativas de nombre paciente sobre texto concatenado; las sesiones se crean en contextos Chromium separados y se cierran tras cada escenario. |

La batería Chromium local monta **los componentes reales** `CenterDashboard`,
`DailyDashboardPanel` y `CenterNavigation` con CSS y respuestas controladas de la Action,
en un servidor Vite de loopback con puerto efímero. No usa Supabase, Auth Admin, Next
aislado ni datos remotos. Cubrió 13 escenarios PASS: ADMIN; RECEPTION; ambos
PROFESSIONAL; PROFESSIONAL A móvil; carga móvil demorada 6,2 s seguida de éxito;
error inicial que no pasa ready; carga persistente que falla; vacío informativo con datos
cargados; denegación que no pasa ready; centro ajeno y no vinculado; abort de POST local
con header `next-action` y reintento; error, retry, cambios de estado y ambos vacíos.
La prueba local de plan/inventario/cleanup/selector obtuvo 18/18 PASS. TypeScript,
ESLint `no-undef`, sintaxis y Prettier focales PASS.
La suite Vitest del componente se intentó, pero el sandbox impidió a Vite crear
`node_modules/.vite-temp` en este worktree (`EPERM`); no se contabilizó como PASS.

La batería local no prueba Auth real, Next Server Actions, RPC, RLS ni datos DEV. El
transporte Next del abort y el resto del recorrido Chromium todavía requieren un Gate B
remoto con nueva autorización. Si vuelve a persistir loading, el helper conservará un
diagnóstico legible sin exponer credenciales; se necesitará la salida de PowerShell para
atribuir la causa de transporte o aplicación.

## Revisión y dictamen

Revisión independiente focal: **READY, sin bloqueantes locales**. El revisor ejecutó
por separado el harness Chromium completo (13/13 PASS), confirmó que no quedan llamadas
`ready()` obsoletas, revisó el caso POST `next-action` abortado/reintentado y verificó
que error, denegación y carga persistente no pueden declarar ready. La revisión mantiene
explícita la falta de evidencia de transporte Next, sesiones, RLS y DEV.
La autorización del run `f27b72bc-ed76-4942-850c-d98607d39c9d` está consumida.
No se hizo commit, push, PR, conexión DEV/PROD, fixtures nuevos, migration, cleanup,
cambio de RPC/RLS/permisos ni modificación del checkout habitual.

## Autorización posterior para un único Gate B run

El 2026-10-22 la persona usuaria autorizó **una sola** nueva ejecución `run` desde su
PowerShell local, exclusivamente en `salud-plus-turnos-dev` (project ref
`ehllxymqyzrofydrvtzo`). El agente no ejecutó el comando ni se conectó a DEV.
La autorización exige preflight previo, 25 migrations, contratos y permisos de ambas
RPC, plan de diez turnos y ventana temporal válidos, E2E auditado con
`dashboardReady`, runId nuevo e inventario inicial de 14 recursos. El PASS integral
requiere todos los escenarios RPC y Chromium, cleanup exacto, inventarios idénticos,
`residue=0`, ledger finalizado y liberación de `active.lock`. Ante un fallo no hay
reintento automático ni cleanup separado autorizado.

Comprobación local previa a entregar el comando: los tres ledgers históricos están
`cleaned`, cada par de inventarios inicial/final coincide en 14 recursos y
`active.lock` está ausente. `gate.mjs` invoca
`tests/e2e/task-021-dashboard-dev.spec.mjs`, que importa y usa el helper
`dashboardReady`. El script `run.ps1` solicita las credenciales DEV mediante entrada
oculta y valida el project ref. La identidad, migrations, catálogo, permisos y
fotografía actual de DEV se volverán a verificar durante el preflight del `run`.

Comando autorizado para una única ejecución desde PowerShell:

```powershell
$worktree = 'C:\Users\Pablo\.codex\worktrees\task-021-dashboard-sql\salud-plus-turnos'
& "$worktree\scripts\task021-functional-dev\run.ps1" -Mode run -ConfirmProjectRef ehllxymqyzrofydrvtzo
```

El intento de Vitest bloqueado por `EPERM` en `node_modules/.vite-temp` sigue
pendiente y deberá resolverse antes del cierre técnico final, aun si Gate B obtiene
PASS integral.
