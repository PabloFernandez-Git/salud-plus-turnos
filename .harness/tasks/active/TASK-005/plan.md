# TASK-005 — Plan

**Estado:** `TASK-005A COMPLETED` · `TASK-005B1 COMPLETED` · `TASK-005B2 COMPLETED`

## Estrategia

Implementar por capas verificables, manteniendo separadas identidad, plataforma global y tenant. La
secret key sólo coordina Supabase Auth Admin; el acceso normal usa el cliente SSR del usuario, grants
mínimos, RLS y RPCs que revalidan `auth.uid()`.

```text
Auth/session
↓
identidad public.users
├── requirePlatformAdmin() → /platform
└── requireCenterMembership(centerId) → /centers/[centerId]/...
```

## Fase 1 — Startup, baseline y diseño (completada)

1. Leer instrucciones, Harness y contexto funcional/técnico relevante.
2. Verificar `main`, `origin/main`, SHA, limpieza y crear la branch.
3. Ejecutar bootstrap y health check DEV.
4. Inspeccionar migrations, tipos, clientes y catálogo remoto de grants/RLS.
5. Diseñar Auth, email, centro activo, memberships, PROFESSIONAL y compensación.
6. Incorporar PLATFORM_ADMIN global, `/platform` y el nuevo bootstrap.
7. Revisar RLS/grants/RPCs tabla por tabla y actualizar documentación permanente.
8. Resolver todas las decisiones humanas y dejar `READY_FOR_IMPLEMENTATION`.

## Gate operativo antes de implementar

Aunque el diseño está aprobado, antes de crear SQL/código o tocar DEV el Implementer deberá:

1. releer Brief, Plan y propuesta final;
2. confirmar branch, diff y ausencia de cambios ajenos conflictivos;
3. ejecutar `pnpm bootstrap` y guards DEV;
4. reconfirmar project ref `ehllxymqyzrofydrvtzo` y PROD fuera de alcance;
5. presentar/confirmar el lote de migrations y configuración Auth que se aplicará;
6. no solicitar ni recibir secretos por chat: el humano configura `.env.local`/secret env;
7. crear fixtures Auth sólo cuando las migrations y tests estén listos para cleanup inmediato.

## Fase 2 — Database y seguridad (TASK-005A completada)

1. Crear migrations incrementales nuevas; nunca editar las tres migrations aplicadas.
2. Agregar `public.users.email` con backfill seguro desde Auth, lowercase, NOT NULL y UNIQUE.
3. Crear `platform_admins`, RLS y privilegios fail-closed.
4. Crear helpers privados de plataforma/tenant con retornos mínimos.
5. Crear RPCs administrativas estrechas para plataforma y centro.
6. Implementar policies SELECT y grants exactos; no abrir tablas operativas para contadores.
7. Proteger cambios de ADMIN/activación de centro con advisory lock transaccional por `center_id` y
   postcondición de al menos un ADMIN activo para todo centro creado; la reactivación vuelve a
   verificarla como defensa adicional.
8. Aplicar sólo en DEV tras el gate y regenerar `database.types.ts`.

## Fase 3 — Auth e infraestructura server-only (foundation TASK-005A completada; web en TASK-005B)

1. Incorporar `SUPABASE_SECRET_KEY` al contrato seguro sin valor versionado.
2. Crear cliente admin `supabase-js` separado con:
   - `persistSession: false`;
   - `autoRefreshToken: false`;
   - `detectSessionInUrl: false`.
3. Implementar proxy SSR de refresh y helpers `requireUser`, `requirePlatformAdmin`,
   `requireCenterMembership`, `requireRole` y `requireProfessionalContext`.
4. Configurar password mínimo 10, Site URL y redirect allowlist concreta en DEV.
5. Implementar en TASK-005B login, logout, cambio y recovery; no signup público.
6. Mantener email confirmado como decisión server-side de los flujos administrativos.

## Fase 4 — Operaciones de provisioning (backend TASK-005A completado; UI en TASK-005B)

1. Implementar bootstrap one-shot del primer PLATFORM_ADMIN con guard DEV, precondición vacía,
   lock, compensación y reconciliación.
2. Implementar resolución exacta de cuenta existente sin revelar centros/roles.
3. Implementar la operación backend de `/platform` → crear Center + primer ADMIN.
4. Implementar la operación backend ADMIN → alta/reutilización de usuario y membership.
5. Implementar reactivación/desactivación/cambio de rol mediante RPC separada.
6. Probar fallos entre Auth y DB y compensar sólo Auth users creados por la ejecución actual.

## Fase 5 — UI funcional mínima (TASK-005B1 y TASK-005B2 completadas; B3 no iniciada)

1. Login/logout, recovery y cambio de contraseña.
2. Landing con prioridad de contexto, selector de centros y estado sin acceso.
3. `/platform` protegido con tabla, contadores, alta de centro+ADMIN y activación/desactivación.
4. `/centers/[centerId]/...` protegido por membership activa y centro activo.
5. Administración mínima de usuarios/memberships para ADMIN.
6. Mensajes seguros para cuenta existente, membership activa/inactiva, conflicto y fallo parcial.
7. Sin trabajo visual sofisticado; accesibilidad y estados de error/carga sí son obligatorios.

## Fase 6 — Verificación y review

1. Unit tests de schemas, helpers y orquestación/compensación.
2. Integration tests Auth/RLS/RPC con fixtures DEV temporales y cleanup verificado.
3. Tests de concurrencia para último ADMIN y creación/activación de centro.
4. Component/E2E de login, selector, no-access, `/platform` y administración mínima.
5. Catálogo: grants/policies/helpers coinciden exactamente con la matriz.
6. Ejecutar bootstrap, secret guard, format, lint, typecheck, tests y build.
7. Producir `implementation-report.md` sanitizado.
8. Review independiente funcional, Security y Database/RLS; corregir y verificar de nuevo.
9. No cerrar sin PASS y no tocar PROD.

## Orden de migrations previsto

1. `add_user_email_and_platform_admins`:
   - proyección email y constraints;
   - tabla global `platform_admins`;
   - RLS/revokes iniciales.
2. `add_auth_access_helpers_and_policies`:
   - helpers privados anti-recursión;
   - policies SELECT;
   - grants mínimos por tabla/función.
3. `add_auth_platform_center_rpcs`:
   - RPCs de provisioning, membership, plataforma y contadores;
   - revokes/grants por firma;
   - invariantes concurrentes del último ADMIN.

El Implementer puede combinar migrations si conserva orden, atomicidad y revisión clara; nunca debe
reescribir migrations aplicadas.

## Archivos permitidos en la implementación futura

- nuevas migrations/tests SQL bajo `supabase/`;
- infraestructura Supabase server-only y proxy;
- módulos de access/centers/users y rutas UI aprobadas;
- tests unitarios/componentes/E2E;
- scripts estrechos de bootstrap/verify;
- `.env.example` sólo con el nombre/placeholder no secreto aprobado;
- tipos generados mediante `pnpm db:types`;
- documentación/reportes del Harness.

## Prohibiciones permanentes

- service-role legacy o secrets `NEXT_PUBLIC_*`;
- cliente admin importable por browser/SSR con cookies;
- grants CRUD genéricos o RPC `update_anything`;
- bypass global RLS por PLATFORM_ADMIN;
- signup público;
- acceso operativo de `/platform` a datos tenant;
- insertar manualmente en `auth.users`;
- aplicar cambios, seeds o fixtures en PROD;
- commit/push sin solicitud posterior.

## Gates

- `STARTUP_VERIFIED` — completado.
- `AUTH_ACCESS_PROPOSED` — completado.
- `AUTH_ACCESS_HUMAN_APPROVED` — completado.
- `PLATFORM_ADMIN_DESIGN_APPROVED` — completado.
- `READY_FOR_IMPLEMENTATION` — completado.
- `IMPLEMENTATION_DEV_GATE` — completado para Fase A.
- `TASK-005A READY_FOR_VERIFICATION` — completado.
- `TASK-005A READY_FOR_REVIEW` — completado.
- `TASK-005A REVIEW PASS` — completado; ambos findings cerrados.
- `TASK-005A COMPLETED` — completado como checkpoint.
- `TASK-005B READY_FOR_IMPLEMENTATION` — completado y dividido en checkpoints B1/B2.
- `TASK-005B1 READY_FOR_VERIFICATION` — completado.
- `TASK-005B1 READY_FOR_REVIEW` — completado.
- `TASK-005B1 REVIEW PASS` — completado.
- `TASK-005B1 COMPLETED` — completado como checkpoint.
- `TASK-005B2 READY_FOR_IMPLEMENTATION` — completado.
- `TASK-005B2 READY_FOR_VERIFICATION` — completado.
- `TASK-005B2 READY_FOR_REVIEW` — completado.
- `TASK-005B2 REVIEW PASS` — completado; ambos findings cerrados.
- `TASK-005B2 COMPLETED` — completado como checkpoint.
- TASK-005B3 — no iniciada.
- `CLOSED` — no iniciado.
