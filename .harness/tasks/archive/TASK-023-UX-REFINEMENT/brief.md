# TASK-023 — Refinamiento UX de Dashboard, Agenda y Crear turno

## Objetivo

Simplificar el inicio del centro, permitir abrir Día desde el encabezado de una fecha en Semana, retirar la acción redundante «Lista de turnos» del encabezado de Agenda y alinear detalles visuales menores de Crear turno con los formularios existentes.

## Contexto relevante

- Base: `origin/main` `b271dcff197e0a567575fa4567f75b2aea3d9649`, posterior al cierre de TASK-021 y TASK-022.
- Trabajo exclusivo en `codex/task-023-ux-refinement` y su worktree aislado.
- Dashboard, Agenda, Turnos y Registrar paciente ya funcionan. Crear turno permanece como página.
- No hay `.env.local` en el worktree; se usan respuestas locales controladas y no se accede a Supabase.

## Criterios de aceptación

- [x] Dashboard conserva indicadores y tarjetas por rol; elimina «¿Qué querés hacer hoy?» y «Elegí un módulo para empezar.» sin dejar espacio sobrante.
- [x] Sólo encabezados de fecha de Semana abren Día con la fecha civil elegida, el mismo centro y los filtros válidos; Enter y Espacio funcionan, con hover y foco visibles.
- [x] Agenda conserva Crear turno para staff y retira sólo «Lista de turnos» del encabezado; Turnos sigue accesible por el Dashboard.
- [x] Auditoría comparativa de Crear turno frente a Registrar paciente y administración documentada; sólo ajustes visuales menores justificados, sin cambiar su flujo u operaciones.
- [x] Diseño responsive y accesibilidad verificados en Chromium local a 1440 y 390 px, incluidos estados pertinentes, con capturas conservadas.
- [x] TypeScript, ESLint, Prettier, Vitest, pruebas focales de navegación, Chromium local, build si es viable y `git diff --check` ejecutados; revisión independiente sin hallazgos bloqueantes.

## Impactos

- Security: no — sin secretos ni nuevos datos.
- Authorization: no — conservar visibilidad y acceso existentes.
- Database: no — sin SQL, RPC, RLS ni datos remotos.
- Documentation: sí — expediente y notas focales de módulos si corresponde.
- Testing: sí — navegación, roles, interacción por teclado y visual responsive.

## Riesgos

- El calendario representa días civiles del centro con objetos `Date` locales para React Big Calendar; evitar conversiones UTC en el salto Semana → Día.
- El encabezado semanal debe ser semántico y aislado de la selección de slots.
- Ajustes visuales de Crear turno no deben alterar estados, validaciones, persistencia ni reconciliación.
- La ausencia de `.env.local` impide comprobaciones autenticadas; sólo se autorizan respuestas controladas locales.

## Fuera de alcance

Rediseño general, cambios de negocio o permisos, modal para Crear turno, migrations, Supabase DEV/PROD, refactorización de arquitectura, commit, push, PR y merge.
