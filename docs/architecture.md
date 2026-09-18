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
- Autorización server-side basada en usuario + centro activo + membership + rol.
- RLS como barrera de aislamiento por centro.
- Service role únicamente en servidor.
- Inputs externos revalidados con Zod.
- IDs no implican permiso sobre un recurso.

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
