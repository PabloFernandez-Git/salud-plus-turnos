# TASK-003 — Implementation Report

**Estado:** `READY_FOR_REVIEW`

## Implementación

- Tras el review `CHANGES_REQUESTED`, se agregó
  `scripts/config/approved-supabase-dev.mjs` como única fuente de verdad ejecutable para el project
  ref DEV aprobado y su región. Los guards comparan env, URL y link directamente contra ella.
- Se reemplazó el contrato legado por cuatro variables mínimas para DEV. No se requiere ni se creó
  una clave privilegiada.
- `scripts/lib/supabase-dev-env.mjs` carga `.env.local`, exige `APP_ENV=development`, valida el
  project ref contra la identidad aprobada y comprueba que tanto la URL exacta como el proyecto
  linkeado apunten a esa misma identidad, sin imprimir valores.
- `pnpm supabase:check:dev` realiza únicamente un `GET` al health check oficial con la publishable
  key. No lee tablas ni muta recursos.
- `pnpm db:types` carga el entorno local, vuelve a validar el destino, usa la CLI autenticada contra
  DEV y genera/formatea `src/lib/supabase/database.types.ts` desde `public`.
- Se agregaron clientes `@supabase/ssr` separados para browser y servidor. Ambos usan sólo URL y
  publishable key y están tipados con `Database`; no existe cliente admin.
- El placeholder de seed dejó de exigir `service_role` y continúa bloqueado hasta una tarea futura
  que autorice schema, dataset y credenciales.
- Se agregó un check que rechaza identificadores privilegiados en `src/`/`next.config.ts`, construye
  con centinelas sintéticos y revisa los artefactos cliente.
- El artefacto temporal `src/app/task003-synthetic-leak/page.tsx` no existe; los centinelas se
  mantienen exclusivamente dentro del script de verificación y no crean una ruta de aplicación.
- Se documentó la reproducción desde un clon limpio en `docs/supabase-dev-setup.md`.
- `supabase/.temp/` quedó ignorado porque contiene metadata local del link de CLI.

## Identidad DEV confirmada

- Proyecto dedicado: `salud-plus-turnos-dev`.
- Región: South America (São Paulo), `sa-east-1`.
- Project ref aprobado y versionado: `ehllxymqyzrofydrvtzo`.
- Project URL, `.env.local` y metadata del link: coherentes con esa fuente versionada.
- `pnpm exec supabase projects list` había sido confirmado por el usuario como `LINKED`; bootstrap y
  ambos wrappers revalidan el metadata local antes de conectar.

## Variables requeridas

Sin valores reales:

```text
APP_ENV
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_DEV_PROJECT_REF
```

No requeridas para TASK-003: secret key, `service_role`, contraseña de base, token personal de CLI y
credenciales de seed.

## Evidencia sanitizada

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0, configuración coherente y link DEV confirmado. |
| `pnpm supabase:check:dev` | PASS — health check HTTPS de sólo lectura. |
| `pnpm db:types` | PASS — tipos generados desde `public` real de DEV. |
| Inspección de tipos | PASS — `Tables`, `Views`, `Functions`, `Enums` y `CompositeTypes` vacíos; sin tablas del dominio. |
| Guard `APP_ENV=production` | PASS — falla antes de abrir red. |
| Guard URL/ref discordantes | PASS — falla antes de abrir red. |
| Guard env ref distinto del aprobado | PASS — falla antes de leer la key o abrir red. |
| Guard proyecto linkeado distinto del aprobado | PASS — falla antes de abrir red o CLI. |
| Env, URL y link alternativos pero coherentes | PASS — rechazados por no ser el proyecto DEV aprobado. |
| Tests específicos de guards | PASS — 7 tests; cubren los seis escenarios requeridos y URL con componentes extra. |
| `pnpm format:check` | PASS. |
| `pnpm check` | PASS — lint, TypeScript y 17 tests en 5 archivos. |
| `pnpm build` | PASS — build productivo y rutas estáticas generadas. |
| `pnpm security:check:client-bundle` | PASS — build con centinelas, artefactos cliente sin filtraciones y sin ruta sintética. |
| `git check-ignore -v .env.local supabase/.temp/project-ref` | PASS — ambos artefactos locales ignorados. |
| `git ls-files -- .env.local '.env*' supabase/.temp` | PASS — sólo `.env.example` está versionado. |
| Comparación de valores locales contra archivos versionados | PASS — URL y publishable key reales no están en Git; project ref y región sí están versionados deliberadamente como identidad no secreta. |
| `git diff --check` | PASS. |

No se ejecutaron `db push`, migrations, seeds, resets ni mutaciones. Ningún comando apuntó a PROD.

## Limitaciones deliberadas

- El esquema `public` sigue vacío; no se crearon tablas, migrations, funciones ni políticas RLS.
- Los clientes son infraestructura mínima y todavía no están conectados a agenda, Auth ni módulos de
  producto.
- La publishable key es pública por diseño y no sustituye RLS; las tareas de dominio deberán habilitar
  RLS antes de exponer tablas.
- Los checks remotos requieren conectividad, login válido de Supabase CLI y un link local al proyecto
  DEV esperado.
- Review funcional, Security y Database independientes quedan para la etapa siguiente del Harness;
  no se cierra ni archiva TASK-003 en esta implementación.
