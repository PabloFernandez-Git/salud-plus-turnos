# Implementación y verificación — TASK-023

## Base y aislamiento

- Rama: `codex/task-023-ux-refinement`.
- Worktree: `C:\Users\Pablo\.codex\worktrees\task-023-ux-refinement\salud-plus-turnos`.
- Base: `origin/main` `b271dcff197e0a567575fa4567f75b2aea3d9649`.
- Checkout habitual con cambios locales: no modificado.
- Sin copia de `.env.local`, credenciales, Supabase DEV/PROD, migrations ni datos reales.

## Cambios A–E

A. El Dashboard elimina el bloque de encabezado y descripción redundantes. `DailyDashboardPanel` y `CenterNavigation` conservan sus props, tarjetas, rutas, visibilidad por rol y separación `space-y-10`.
B. Semana utiliza el botón nativo de React Big Calendar en cada encabezado de fecha, con etiqueta accesible «Abrir día», área de 44 px, cursor, hover y foco visible. `onDrillDown` existente navega mediante `civilDate(day)` y `agendaUrl`, preservando centro y filtros. Día no añade encabezados interactivos; Mes conserva su navegación.
C. El encabezado de Agenda conserva únicamente «Crear turno» para ADMIN/RECEPTION; PROFESSIONAL no recibe acción vacía. La ruta de Turnos y la tarjeta del Dashboard siguen presentes.
D. Tras la [auditoría](audit.md), búsqueda y nota de Crear turno alinean radio y foco con los selectores; los selectores muestran foco y disabled consistentes. Los botones principales usan la clase compartida. No cambian etapas, validaciones, estado ni operaciones.
E. Se reutilizan componentes y clases existentes; el único CSS nuevo es focal al botón de encabezado semanal.

## Verificación exacta

- `pnpm bootstrap`: dependencias instaladas, Node 24.21.0 y pnpm 11.26.0 OK; salida 1 porque no existe `.env.local` en este worktree.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS con una advertencia preexistente de variable `oid` no usada en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238`.
- `pnpm format:check`: FAIL en 375 archivos del repositorio fuera de TASK-023. El chequeo focal de los 10 archivos de código/test/runner modificados: PASS.
- `pnpm exec vitest run`: 93 archivos, 713/713 tests PASS. La primera corrida focal tuvo dos fallos por falta de `cleanup` en el test nuevo; se corrigió y la corrida focal de Dashboard pasó 3/3 antes de la suite completa.
- `pnpm build`: PASS, compilación, TypeScript y generación estática.
- Chromium local con respuestas controladas y puertos 31023–31025: Dashboard, Agenda y Crear turno PASS a 1440×900 y 390×844. No se contactó a Supabase; cada runner bloquea orígenes externos.
- Agenda: Semana → Día por Enter y Espacio, filtros, cruce octubre/noviembre, foco visible, hover, columnas desplazables, detalle, estados error/vacío y sin desborde de página. El primer intento del runner falló por exigir que cada encabezado estuviera enteramente visible dentro del scroll; se ajustó la medición de intersección y pasó.
- Crear turno: búsqueda sintética de paciente, catálogos, fecha/horario, resumen, botón habilitado y error de negocio sintético; sin desborde.
- `git diff --check b271dcf`: PASS tras documentación y revisión.
- Comprobación final tras conservar el estilo original del enlace: TypeScript PASS, Vitest focal 24/24 y `node --check` de los tres runners PASS.
- Verificación focal adicional comunicada tras investigar una discrepancia visual del filtro de estado: 41/41 PASS. La discrepancia se atribuyó al runner sintético, sin defecto de la aplicación. Este resultado fue aportado por la persona usuaria; no se repitió la suite en esta preparación de PR.
- Revisión independiente: PASS sin hallazgos bloqueantes; detalle en [review.md](review.md).

## Evidencia visual

- `artifacts/task023-ux/dashboard/`: actividad, error y vacío para desktop/mobile.
- `artifacts/task023-ux/agenda/`: Día/Semana/Mes, foco y hover semanal, Día desde Semana, error y columnas móviles; `results.json`.
- `artifacts/task023-ux/crear-turno/`: inicial, listo y error de negocio para desktop/mobile; `results.json`.

## Límites

Las respuestas y la autenticación de los recorridos de Chromium son sintéticas. Las rutas servidoras, permisos reales y Supabase DEV/PROD no se probaron en esta tarea por restricción expresa. El expediente se preparó antes de la publicación del PR; el merge queda fuera de alcance.
