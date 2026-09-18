# TASK-001 — Project Bootstrap

## Objetivo

Materializar el repositorio inicial de Salud Plus — Gestión de Turnos, consolidar la documentación aprobada e instalar la estructura mínima del Harness v1 y del stack técnico para comenzar desarrollo real.

## Contexto relevante

- `docs/product.md`
- `docs/mvp.md`
- `docs/business-rules.md`
- `docs/technical-decisions.md`
- `docs/architecture.md`
- `AGENTS.md`

## Criterios de aceptación

- [x] Documentación previa consolidada dentro del repositorio.
- [x] README y AGENTS creados.
- [x] Harness v1 materializado.
- [x] Estructura inicial de Next.js/TypeScript/Tailwind creada.
- [x] Configuración inicial de lint, format, tests y CI creada.
- [x] Node 24 y pnpm 11.26.0 declarados.
- [x] Scripts de bootstrap y DB preparados sin acciones destructivas.
- [x] Dependencias instaladas con pnpm.
- [x] `pnpm-lock.yaml` generado y preparado para versionar.
- [x] `pnpm bootstrap` pasa en Node 24.
- [x] `pnpm format:check` pasa.
- [x] `pnpm check` pasa.
- [x] `pnpm build` pasa.
- [x] Review final PASS.

## Impactos

- Security: sí — creación de `.env.example` y reglas de secretos.
- Authorization: no — todavía no se implementa auth.
- Database: bajo — estructura de scripts/migrations, sin schema aplicado.
- Documentation: sí — consolidación completa.
- Testing: sí — configuración base.

## Riesgos

- La instalación real reveló incompatibilidades entre TypeScript 7 / `typescript-eslint` y ESLint 10 / plugins de Next; se corrigieron fijando TypeScript 6.0.3 y ESLint 9.39.5.
- ESLint 9.39.5 aparece como rama de mantenimiento obsoleta en npm, pero es la última versión que satisface los peers actuales de todos los plugins incluidos por Next.js 16.3.5.

## Fuera de alcance

- Supabase DEV real.
- Auth real.
- Schema de negocio.
- React Big Calendar.
- UI funcional del MVP.
