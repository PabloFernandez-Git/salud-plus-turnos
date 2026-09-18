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
- [ ] Dependencias instaladas con pnpm.
- [ ] `pnpm-lock.yaml` generado y versionado.
- [ ] `pnpm bootstrap` pasa en Node 24.
- [ ] `pnpm format:check` pasa.
- [ ] `pnpm check` pasa.
- [ ] `pnpm build` pasa.
- [ ] Review final PASS.

## Impactos

- Security: sí — creación de `.env.example` y reglas de secretos.
- Authorization: no — todavía no se implementa auth.
- Database: bajo — estructura de scripts/migrations, sin schema aplicado.
- Documentation: sí — consolidación completa.
- Testing: sí — configuración base.

## Riesgos

- La instalación real puede revelar incompatibilidades entre versiones actuales de paquetes.
- El entorno de generación del artefacto no dispone de Node 24/pnpm instalado ni acceso npm desde el contenedor, por lo que no puede completar la validación runtime.

## Fuera de alcance

- Supabase DEV real.
- Auth real.
- Schema de negocio.
- React Big Calendar.
- UI funcional del MVP.
