# TASK-034 — Resiliencia de acceso ante fallos de platform_admins

**Estado:** ACTIVE — Fases B y C completadas; gate técnico de Fase D `APPROVED`. Publicación por PR autorizada, sin autorización de merge ni cierre. **Base local:** `main` / `origin/main` en `855f7fae`.
**Rama:** `codex/task-034-platform-admin-resilience`.

## Objetivo y diagnóstico

Un error de `platform_admins` bloquea el layout de un centro después de validar su membresía y también rechaza `getAccessOverview` por su `Promise.all`. El privilegio global sólo determina navegación opcional cuando ya existe un centro accesible; `/platform` y sus mutaciones exigen autorización positiva independiente.

## Criterios de aceptación

- Membresía y centro activos siguen siendo obligatorios. Error, ausencia o denegación de esos datos no se recuperan como acceso válido.
- Un centro autorizado se renderiza ante error de la lectura global, sin enlace a plataforma. Una lectura positiva muestra el enlace; una negativa válida lo oculta.
- Con centros accesibles, el destino tras login y el selector funcionan ante error global. Sin centros, un error global muestra un estado recuperable con reintento manual; `true` conduce a `/platform` y `false` a `/no-access`.
- `/platform` y sus acciones conservan la comprobación global estricta. Ningún error produce privilegio positivo.
- Pruebas focales de acceso, rutas y seguridad, TypeScript, ESLint y Prettier focales, y `git diff --check`.

## Impacto y riesgos

Alcance: módulo `access`, layout de centro, navegación de entrada, página de plataforma, pruebas y mensaje de error recuperable. Riesgos: ocultar errores de membresía, confundir una consulta fallida con una negativa definitiva, reutilizar un resultado opcional para autorizar plataforma o crear un bucle de reintentos. Sin SQL, RPC, RLS, migraciones, cambios de roles ni operaciones Supabase.

## Límites de Fase B

No ejecutar suite completa, E2E, Chromium ni gate independiente. No modificar TASK-029, archivos locales preexistentes, expedientes archivados ni `.env.local`; no hacer commit, push, PR, merge o despliegue.
