# Arquitectura

## Visión

Aplicación full-stack con Next.js, React y TypeScript. PostgreSQL vive en Supabase y el acceso se realiza principalmente mediante Supabase Client desde el servidor de Next.js.

```text
React / Next.js UI
↓
Next.js Server
↓
queries / actions / domain
↓
Supabase Client
↓
PostgreSQL + RLS
```

## Organización por dominio

```text
src/
├── app/          # routing, layouts, pages, composición
├── modules/      # funcionalidades del producto
├── components/   # UI global reutilizable
└── lib/          # infraestructura compartida
```

Los módulos crecen de forma progresiva. Cuando la complejidad lo justifique pueden contener:

```text
components/
schemas/
queries/
actions/
domain/
```

No se crean capas vacías por anticipado.

## Entrada al servidor

```text
Server Components + queries
→ lecturas internas

Server Actions
→ mutaciones iniciadas desde la web

Route Handlers
→ APIs, webhooks e integraciones externas
```

Server Actions y Route Handlers son adaptadores. La lógica de negocio reutilizable pertenece al módulo.

## Seguridad

- Supabase Auth para identidad.
- Autorización global server-side mediante `platform_admins` para `/platform`.
- Autorización tenant server-side basada en usuario + centro activo + membership + rol.
- Los permisos global y tenant son independientes y nunca se sustituyen entre sí.
- RLS como barrera de aislamiento por centro.
- `SUPABASE_SECRET_KEY` moderna únicamente en un cliente administrativo `supabase-js` server-only,
  separado de los clientes SSR/browser y limitado a Auth Admin, compensación y bootstrap o
  reconciliación controlada. No se incorpora la key legacy `service_role`.
- Las mutaciones Auth→PostgreSQL persisten una operación privada identificada por UUID y hash de
  payload. Las RPCs serializan por ese UUID, guardan el resultado en la misma transacción de negocio
  y permiten distinguir commit, rollback confirmado y estado indeterminado antes de compensar Auth.
- Inputs externos revalidados con Zod.
- IDs no implican permiso sobre un recurso.

```text
/platform
→ requirePlatformAdmin()
→ RPCs globales estrechas

/centers/[centerId]/...
→ requireCenterMembership(centerId)
→ requireRole(...) / requireProfessionalContext(...)
```

### Demo pública independiente

La demo de portfolio se publica desde `codex/portfolio-mvp` en Vercel y apunta a un proyecto Supabase DEMO separado de DEV. Next.js y React presentan el centro ficticio. El visitante completa Cloudflare Turnstile y Supabase Auth crea una sesión anónima propia mediante `signInAnonymously()`; el hook de Auth admite solo altas anónimas y un trigger crea el perfil y la membresía del centro DEMO.

PostgreSQL aplica RLS para aislar perfiles y membresías de invitados. En DEMO, los grants de `authenticated` revocan INSERT, UPDATE y DELETE sobre tablas públicas y EXECUTE sobre RPC sensibles; solo se conceden las RPC de lectura auditadas. `PORTFOLIO_DEMO_MODE=true` bloquea además las Server Actions de escritura y la interfaz muestra esos controles deshabilitados. Esta configuración es exclusiva del proyecto DEMO y no modifica la autenticación de la aplicación completa. Ver [guía de DEMO](portfolio-demo.md) y [acceso invitado](portfolio-guest-access.md).

## Base de datos

- PostgreSQL.
- Migrations SQL versionadas en `supabase/migrations/`.
- DEV antes que PROD.
- Tipos TypeScript generados desde el esquema.
- PROD nunca recibe migrations automáticas de un agente.

## Tiempo

- Centro: timezone IANA.
- Turnos: `timestamptz`.
- Disponibilidad recurrente: día de semana + `time` local.
- Fechas puras (ej. nacimiento): `date`.
- Agenda renderizada según timezone del centro activo.

## Testing

- Vitest: dominio y utilidades.
- React Testing Library: comportamiento de componentes.
- Playwright: E2E cuando exista entorno reproducible y aislado.

## Harness

El Orchestrator enruta contexto por capas:

```text
Global
→ producto + status + AGENTS

Módulo
→ docs/modules/<módulo>.md

Tarea
→ brief + plan

Trabajo
→ código/tests/diff relevantes
```
