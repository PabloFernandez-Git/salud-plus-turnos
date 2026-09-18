# Salud Plus — Gestión de Turnos

Aplicación web para pequeños consultorios y centros médicos. El núcleo del producto es la **agenda**, con gestión de centros, accesos, profesionales, especialidades, pacientes, disponibilidad y turnos.

## Estado

El proyecto se encuentra en **TASK-001 — Project Bootstrap**.

La arquitectura, el MVP y las decisiones técnicas principales ya están documentados. El scaffold inicial del repositorio y el Harness v1 están materializados. Falta ejecutar la instalación real de dependencias en un entorno con Node.js 24 + pnpm 11.26.0, generar `pnpm-lock.yaml` y ejecutar la verificación completa antes de cerrar TASK-001.

## Stack

- Next.js + React + TypeScript
- Tailwind CSS + shadcn/ui (componentes agregados solo cuando se necesiten)
- PostgreSQL + Supabase
- Supabase Auth + RLS
- Zod + React Hook Form
- Vitest + React Testing Library + Playwright
- Vercel
- GitHub Actions

## Requisitos

```text
Node.js 24 LTS
pnpm 11.26.0
```

La versión esperada de Node está declarada en `.nvmrc` y `package.json`. La versión de pnpm está fijada en `package.json`.

## Puesta en marcha

Una vez clonado el repositorio en un entorno con acceso a npm:

```bash
corepack enable
corepack prepare pnpm@11.26.0 --activate
pnpm install
pnpm bootstrap
pnpm dev
```

El primer `pnpm install` generará `pnpm-lock.yaml`. Ese archivo debe versionarse en Git y, a partir de entonces, CI utilizará instalación congelada.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build

pnpm check
pnpm verify
```

`pnpm check` agrupa lint + typecheck + tests. `pnpm verify` agrega el build.

## Documentación

- Producto: `docs/product.md`
- Alcance MVP: `docs/mvp.md`
- Reglas de negocio: `docs/business-rules.md`
- Arquitectura: `docs/architecture.md`
- Decisiones técnicas: `docs/technical-decisions.md`
- Estado actual: `docs/status.md`
- Módulos: `docs/modules/`
- Guía pedagógica del stack: `docs/stack-guide.md`

## Agent Harness

El proyecto incluye un Harness v1 para trabajo multiagente.

- Entrada operativa: `AGENTS.md`
- Manual: `.harness/README.md`
- Agentes: `.harness/agents/`
- Protocolos: `.harness/protocols/`
- Tareas: `.harness/tasks/`

Principio central:

> Los chats son efímeros. El repositorio es la memoria del sistema.

## Flujo de trabajo

```text
Startup
→ Task Brief
→ Plan
→ Implementation
→ Verification
→ Review
→ Fix loop si corresponde
→ Close Task
→ Retrospective
```
