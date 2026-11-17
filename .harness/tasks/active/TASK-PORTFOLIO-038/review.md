# TASK-PORTFOLIO-038 — Review de integración

## Preflight

**Resultado:** integración y despliegue aprobados; cierre funcional condicionado al smoke visual autenticado.

- El diff seleccionado contiene interfaz, lectura, tipos, pruebas y documentación de TASK-038.
- `listAvailabilityBlocks` invoca únicamente `staff_list_availability_blocks` desde el servidor, con contexto de centro autorizado por las páginas.
- La pantalla de Disponibilidad no contiene controles nuevos para crear o retirar bloqueos. Agenda conserva el modo DEMO y deshabilita la continuación de alta.
- La base DEMO confirma los cuatro bloqueos y conserva los tres turnos. Los permisos directos de escritura de bloques están denegados.
- La configuración Production conserva las tres banderas de solo lectura, CAPTCHA e invitados; la URL Supabase sensible se comprueba también mediante el guard de servidor y se revisará en el sitio publicado.
- No se tocó Auth, Turnstile, DEV o PROD ni se ejecutaron migración o seed.

El diff staged contenía solo 20 archivos de TASK-038, sin SQL ni escritura. Vitest, TypeScript, ESLint, Prettier, build y `git diff --check` pasaron. Vercel asignó el alias público al commit `557cc6b` en estado `READY`; login y bundle DEMO se comprobaron por HTTP. La inspección de Agenda y Disponibilidad desde invitado continúa pendiente por indisponibilidad del host de navegador conectado. No declarar TASK-PORTFOLIO-038 cerrada hasta acreditar ese smoke.
