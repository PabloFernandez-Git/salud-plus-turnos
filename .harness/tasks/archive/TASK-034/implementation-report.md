# TASK-034 — Informe de implementación acotada

**Estado:** ACTIVE — Fase B implementada localmente; Fase C documentada en `validation-report.md`. Sin commit, PR ni despliegue.

`main` y `origin/main` locales y `main` remoto apuntan a `855f7fae` (cierre de TASK-033). La comprobación remota se completó mediante el conector GitHub porque `git ls-remote` no tuvo conectividad directa.

## Decisión técnica y alcance

- `requireCenterMembership` permanece obligatorio y fuera de la recuperación. Sólo `hasOptionalPlatformNavigation` convierte un error de la consulta global en ausencia temporal del enlace del encabezado. `hasPlatformAdminRole` conserva su semántica estricta: respuesta sin fila es `false`, error se propaga.
- `getAccessOverview` resuelve centros y permiso global de manera independiente. Un error global con centros accesibles produce `isPlatformAdmin: null` y mantiene el destino tenant. Sin centros, el error se propaga y la frontera de error de la aplicación ofrece reintento manual; nunca se convierte en `/no-access`.
- `/platform` sigue llamando `requirePlatformAdmin` antes de renderizar o consultar datos. Para el enlace de vuelta lee sólo los centros accesibles; se eliminó la lectura global que hacía `getAccessOverview`. `listPlatformCenters` conserva su propia guardia estricta, que consulta `platform_admins`. Las acciones administrativas no se modificaron.
- La UI de error compartida muestra un mensaje genérico y botón «Reintentar» que recarga la ruta mediante `window.location.reload()`, sin revelar detalles internos. La Fase C comprobó que `reset()` no reejecutaba la resolución del servidor en este caso y motivó el cambio.

Archivos de código: `src/modules/access/server/access.ts`, `src/modules/access/domain/access-routing.ts`, `src/app/centers/[centerId]/layout.tsx`, `src/app/platform/page.tsx` y `src/app/error.tsx`. Pruebas junto al código: `access.test.ts`, `authorization.test.ts`, `access-routing.test.ts`, `layout.test.tsx`, `platform/page.test.tsx` y `app/error.test.tsx`.

## Seguridad

Los fallos de membresía o centro se propagan; una membership ausente o centro inactivo siguen denegados. `null` nunca equivale a permiso global positivo y el enrutador rechaza ese valor si no hay centro. `requirePlatformAdmin` y las acciones siguen siendo la autoridad para `/platform`. No hubo cambios SQL, RPC, RLS, migraciones, roles ni cachés de permisos.

## Verificación y límites

- `pnpm bootstrap`: PASS, Node 24.21.0 y pnpm 11.26.0; sólo verificó configuración local, sin conexión a Supabase.
- Vitest focal, seis archivos: primera corrida 43 pruebas en cuatro archivos PASS, dos workers no iniciaron a tiempo bajo carga; repetición aislada de esos dos archivos: 21/21 PASS. Corrida final con un worker sobre el estado formateado: **6/6 archivos y 64/64 pruebas PASS**.
- `pnpm typecheck`: PASS.
- ESLint focal sobre los 11 archivos TS/TSX afectados: PASS en tres grupos; la primera invocación conjunta se detuvo por demora sin salida.
- Prettier focal sobre código y documentación afectados: PASS. `git diff --check`: PASS; sólo se emitieron avisos de conversión LF/CRLF, incluidos archivos preexistentes.

En Fase C se validaron con Next real los estados de error y reintento, incluida la entrada tras login, y se corrigió el botón de reintento. La verificación con Supabase real, E2E autenticado y gate completo se reservan para fases posteriores. En Fase B no se ejecutaron suite completa, Chromium ni revisión independiente exhaustiva.

## Tiempos aproximados

Preparación y análisis de rama: ~2 min. Implementación y autoría de pruebas: ~4 min. Verificaciones focales, incluida la repetición por timeout de workers: ~8 min. Formato, inspección y documentación: ~2 min. Son tiempos aproximados; las fases se solaparon y el arranque de Vitest bajo carga dominó la medición.
