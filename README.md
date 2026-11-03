# Salud Plus — demo de gestión de turnos

Salud Plus es un proyecto de portfolio que muestra la operación diaria de un centro de salud ficticio. La **agenda** es el núcleo: vistas diaria, semanal y mensual, junto con dashboard, profesionales, especialidades, disponibilidad, pacientes y turnos.

La demo pública usa un único centro y datos inventados. La cuenta de visita permite explorar en modo lectura. Los flujos de alta y edición se muestran mediante capturas o una grabación; la demo no permite guardar cambios. No está destinada a operar con pacientes reales.

## Tecnologías

Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL con RLS, Zod, Vitest, React Testing Library y Playwright. Preparada para Vercel.

## Acceso a la demo

[Abrir la demo de Salud Plus](https://salud-plus-portfolio.vercel.app). Las credenciales de visita se comparten por un canal separado; no se versiona la contraseña. El registro público está desactivado en Supabase Auth DEMO.

## Desarrollo local

Requiere Node.js 24 y pnpm 11.26.0.

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm dev
```

Copiar `.env.example` a `.env.local` y completar las variables locales. Para publicar la demo independiente, seguir [la guía de DEMO](docs/portfolio-demo.md). Las migraciones de TASK-029 permanecen en otra rama y no forman parte de esta publicación.

## Verificación

```bash
pnpm typecheck
pnpm test
pnpm build
```

Documentación de producto en [docs/product.md](docs/product.md) y estado de desarrollo en [docs/status.md](docs/status.md).
