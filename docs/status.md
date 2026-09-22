# Estado actual

**Fase:** Preparación de Auth, usuarios y acceso a centros
**Tarea activa:** ninguna; la próxima tarea todavía requiere Task Brief
**Última tarea completada:** TASK-004 — Esquema PostgreSQL inicial
**Estado:** `READY_FOR_NEXT_TASK`

## Completado

- Definición de producto y alcance MVP.
- Reglas principales de negocio.
- Stack y arquitectura general.
- Estrategia de seguridad, RLS, testing y observabilidad inicial.
- Estrategia de migrations, zonas horarias, tooling, naming y seeds.
- Harness v1 diseñado.
- Scaffold inicial del repositorio materializado.
- Documentación consolidada dentro de `docs/`.
- Documentación técnica modularizada en `docs/decisions/` y `docs/stack/` para facilitar el context routing.
- Repositorio público de GitHub creado y remoto confirmado.
- Node.js 24 y pnpm 11.26.0 validados en runtime.
- Dependencias instaladas y lockfile congelado verificado.
- Bootstrap, formato, lint, tipos, tests y build verificados.
- TASK-001 aceptada con Review PASS y archivada.
- TASK-002 validó React Big Calendar con mock data determinista en las vistas Día, Semana y Mes,
  incluidas verificaciones visuales a 375 px, 768 px y 1280 px.
- React Big Calendar adoptado como librería base de la agenda para el MVP, con enfoque
  desktop-first y limitaciones responsive/de simultaneidad aceptadas.
- TASK-002 aceptada con Review PASS, decisión humana registrada y archivada.
- TASK-003 configuró el contrato mínimo de entorno, clientes Supabase browser/server no privilegiados,
  health check DEV, tipos generados desde `public` y guía reproducible. Fue aceptada con Review PASS
  funcional, Security y Database y archivada sin crear schema, migrations, Auth, RLS ni datos.
- TASK-004 implementó en Supabase DEV el esquema inicial aprobado mediante migrations SQL
  versionadas: once tablas, integridad multi-centro, normalización documental PostgreSQL,
  exclusion constraints GiST, triggers técnicos y RLS default-deny.
- La suite SQL transaccional, la prueba real de concurrencia, lint/advisor de seguridad y la
  regeneración de tipos desde DEV pasaron; no quedaron datos de prueba persistentes.
- Las tres migrations de TASK-004 están aplicadas y sincronizadas con Supabase DEV; los tipos
  TypeScript generados reflejan las once tablas, enums, relaciones y nulabilidad del schema real.
- RLS está habilitada en las once tablas sin policies permisivas y sin grants de tabla para `anon` o
  `authenticated`. El resultado actual es default-deny; Auth y las policies funcionales todavía no
  están implementadas.
- TASK-004 obtuvo Review PASS independiente de Database/RLS y Security y fue cerrada y archivada.

## Próximo

Definir un Task Brief independiente para Auth, usuarios y acceso a centros sobre el schema ya
creado. La etapa deberá coordinar Supabase Auth con `public.users` y `center_memberships`, diseñar la
autorización server-side y agregar policies RLS funcionales sin debilitar el aislamiento
multi-centro. No corresponde implementar ese alcance como parte del cierre de TASK-004.

## Estado operativo

- Branch: `task/004-initial-postgres-schema`.
- TASK-004: `CLOSED`; artefactos archivados en `.harness/tasks/archive/TASK-004/`.
- Supabase DEV: schema inicial aplicado; tres migrations sincronizadas; tipos regenerados; cero
  fixtures persistentes al cierre.
- Seguridad actual: RLS default-deny en las once tablas, cero policies funcionales y cero helpers
  `SECURITY DEFINER` propios.
- Próximo gate: aprobar objetivo, criterios, riesgos e impacto del Task Brief de Auth, usuarios y
  acceso a centros antes de implementar.
- PROD no fue utilizado. Continúan fuera de alcance durante este cierre: Auth funcional, policies
  permisivas, seeds, UI, cambios en PROD, commit, push y PR.

## Decisiones postergadas

- Email/recovery provider definitivo.
- Rate limiting concreto antes de producción pública.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.
