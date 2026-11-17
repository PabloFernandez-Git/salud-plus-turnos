# TASK-PORTFOLIO-038 — Bloqueos excepcionales en portfolio

## Fase de integración y despliegue — 2026-11-16

La migración y el seed ya fueron aplicados y verificados en Supabase DEMO
`oygrwetmxsqgcizopezq`: cuatro bloqueos activos, tres turnos conservados,
seis pruebas HTTP de acceso y seguridad aprobadas y acceso invitado operativo.
No se vuelven a ejecutar SQL de migración ni seed.

**Objetivo:** publicar la interfaz y las consultas de lectura de TASK-038 en
`codex/portfolio-mvp`, partiendo del commit de sidebar ya integrado (`7e6973c`).

**Criterios de aceptación:** integrar únicamente archivos de interfaz, tipos,
consulta RPC de listado, pruebas focales y documentación correspondiente;
conservar Turnstile, acceso invitado y bloqueos de escritura; pasar pruebas
focales, TypeScript y build; comprobar configuración exclusiva de Supabase DEMO;
publicar por el flujo existente de Vercel; verificar Agenda y Disponibilidad
con los cuatro bloqueos ficticios en la URL publicada.

**Impacto:** Agenda, Disponibilidad, ajuste de foco de CenterSidebar, tipos de
Supabase y documentación de esos módulos. No incluye SQL, migraciones, seeds,
Server Actions de escritura ni cambios de DEV/PROD.

**Riesgos y controles:** `main` contiene RPC y Actions mutantes de bloqueos;
solo se copian rutas y módulos de lectura del worktree local. La configuración
de Vercel debe mantener `PORTFOLIO_DEMO_MODE`, CAPTCHA, invitados y URL DEMO.
Ante cualquier bloqueo de seguridad, detener el despliegue e informar.

La prohibición de push/deploy de la fase local de preparación, descrita abajo,
queda reemplazada para esta fase por la solicitud explícita de publicación.

## Objetivo

Trasladar selectivamente la visualización de bloqueos, los encabezados de Agenda y la corrección de CenterSidebar de V1 al portfolio público, conservando acceso de invitados y solo lectura.

## Criterios de aceptación

- Disponibilidad muestra los bloqueos existentes por profesional con fechas y motivo, sin acciones para crearlos o retirarlos.
- Agenda señala bloqueos en Día, Semana y Mes, e indica horarios no disponibles.
- CenterSidebar se abre por hover, navega al hacer clic y se cierra al salir el cursor, con teclado y menú móvil funcionales.
- Las personalizaciones DEMO y las barreras de escritura del portfolio permanecen intactas.
- Hay una migración y un seed incrementales exclusivos de DEMO para bloques ficticios, sin ejecución remota ni alteración de datos ya publicados.
- Pasan TypeScript, ESLint, Prettier, pruebas focales, build y revisión de permisos con base aislada cuando esté disponible.
- La vista local queda disponible para revisión antes de publicar.

## Impacto

`src/modules/availability`, `src/modules/agenda`, `src/modules/access/components/center-sidebar`, páginas del centro, tipos Supabase, SQL DEMO y documentación del harness.

## Riesgos y controles

- La migración V1 concede EXECUTE de escritura: la variante DEMO debe omitir esas concesiones y verificar grants efectivos.
- Las RPC SECURITY DEFINER y RLS pueden filtrar datos de otro centro: mantener el alcance tenant y probarlo en una base aislada.
- El portfolio usa invitados con rol sintético ADMIN: conservar Turnstile, Auth y las barreras server-side de escritura.
- No hacer push, deploy ni cambios remotos en Supabase, Vercel o Cloudflare.

## Base

Rama `codex/portfolio-task038-local`, creada desde `origin/codex/portfolio-mvp` (`7e6973c`). Referencia V1 `origin/main` (`5dde773`). Worktree `.worktrees/portfolio-task038-local`.
