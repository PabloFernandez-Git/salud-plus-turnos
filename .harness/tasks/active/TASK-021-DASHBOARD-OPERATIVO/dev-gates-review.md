# TASK-021 — Revisión independiente focal de gates DEV

**Dictamen:** PASS para la preparación local de Gate A y Gate B (2026-10-22). No es un PASS remoto. La revisión no conectó a DEV/PROD ni modificó el repositorio.

## Alcance revisado

`scripts/task021-dev/`, `scripts/task021-functional-dev/`, `tests/e2e/task-021-dashboard-dev.spec.mjs`, `playwright.task021.config.ts` y `.gitignore`. Se inspeccionaron identidad y SHA, barrera pre-write, firmas/permisos, fixtures, sesiones autenticadas, aislamiento de datos, aserciones Chromium, entorno de secretos, inventario y cleanup.

## Hallazgos corregidos antes del dictamen

- P1: el esperado del profesional recibía UUID mientras el plan filtraba una clave lógica; ahora acepta ambos y se prueba localmente.
- P1: el postcheck de Gate A dependía del texto de `regprocedure`, sensible a `search_path`; ahora comprueba namespace y tipo de argumento.
- P1 de test: la métrica con nota secundaria concatenaba texto en el `dd`; Chromium comprueba el nodo numérico sin asumir espacios.
- P2: el lanzador ahora restaura `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; Playwright hereda sólo variables necesarias y no recibe Auth Admin secret key.
- P2: las aserciones Chromium comprueban horario local, offset, nombres y especialidad visibles por rol.
- P2: Gate A compara atributos, grants y cuerpos de helpers autorizadores con la migration aprobada; la extracción del SQL corre también en modo local.
- P2: un lock exclusivo impide dos `run` simultáneos desde el mismo worktree; un ledger inconcluso bloquea nuevos runs.
- P1 de entorno: el servidor Next aislado usa `localhost:31021` para evitar el problema de hidratación/HMR conocido con `127.0.0.1` en este proyecto.
- P2 de limpieza local: Gate B retira la copia temporal del Next por runId después de Playwright; la segunda revisión focal comprobó la ruta, el junction y las carreras de `ENOENT` sin hallazgos bloqueantes.

## Evidencia y límite

El reviewer independiente ejecutó `node --check` de los módulos MJS afectados y ambos modos `local`: PASS. Una comprobación Chromium local con URL y credenciales Supabase ficticias, y todas las solicitudes externas bloqueadas, cargó `/login` con HTTP 200, hidrató el botón de contraseña, sin errores de página ni solicitudes externas. SHA de la migration: `7B9C3B4C864B643E9BD5A9B9F723870B03D13074D4CD9977AAF9FBB4205358B1`. El catálogo real, Auth y Next contra DEV sólo podrán confirmarse en los preflight/gates autorizados. Una prueba sintética de cleanup de Next eliminó exclusivamente la carpeta del runId y preservó una carpeta de otro runId. El inventario de residuos cubre 14 recursos de dominio/Auth y seis Auth users previstos; eventos internos de auditoría Auth generados por Supabase no se tratan como fixtures eliminables.
