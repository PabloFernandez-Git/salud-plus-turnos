# Estado actual

**Fase:** Auth, plataforma y acceso a centros — Fase A completada; Fase B lista para implementación
**Tarea activa:** TASK-005 — Auth, usuarios y acceso a centros
**Última tarea completada:** TASK-004 — Esquema PostgreSQL inicial
**Estado:** `TASK-005A COMPLETED` · `TASK-005B READY_FOR_IMPLEMENTATION`

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
- TASK-004 dejó inicialmente RLS default-deny en las once tablas, sin policies permisivas ni grants
  de dominio; TASK-005 Fase A abrió después sólo las seis lecturas aprobadas para `authenticated`.
- TASK-004 obtuvo Review PASS independiente de Database/RLS y Security y fue cerrada y archivada.
- TASK-005 completó y obtuvo aprobación humana de su diseño de Auth, secret key moderna, email
  proyectado, autorización tenant, PLATFORM_ADMIN global, `/platform`, bootstrap excepcional, RLS,
  grants, RPCs y pruebas.
- TASK-005 Fase A aplicó exclusivamente en Supabase DEV seis migrations incrementales con email
  proyectado, `platform_admins`, helpers anti-recursión, seis policies SELECT, grants mínimos y RPCs
  estrechas. DB lint y la suite transaccional de catálogo/RLS/grants pasan.
- La infraestructura local incluye cliente Admin `server-only`, refresh SSR, guards de autorización,
  orquestación con compensación, tooling one-shot y suites para Auth/RLS/concurrencia.
- La configuración Auth DEV efectiva fue verificada: signup público OFF, contraseña mínima 10 sin
  composición, Site URL `http://localhost:3000` y redirects de callback/recovery exactos.
- La suite Auth/RLS foundation pasó con concurrencia real y cleanup verificado: cero fixtures de
  dominio, cero usuarios Auth temporales y ningún PLATFORM_ADMIN persistente.
- La remediación de review agregó idempotencia por `operation_id`, reconciliación antes de compensar
  y pruebas reales de response-loss/retry/concurrencia sin ampliar RLS tenant.
- TASK-005A obtuvo `TASK-005A REVIEW PASS`; ambos findings quedaron cerrados y la Fase A se cerró
  formalmente como checkpoint sin cerrar ni archivar TASK-005.

## Próximo

Iniciar TASK-005B desde el checkpoint aprobado para implementar la UI funcional y los flujos web
previstos. Antes de cualquier bootstrap persistente del primer PLATFORM_ADMIN se mantiene la
autorización humana adicional exigida; ese bootstrap no se ejecutó durante Fase A.

## Estado operativo

- Branch: `task/005-auth-users-center-access`, creada desde `main` en
  `7bf1aa3d50b31d7ce420c805af60fe5b9c2ce01d` después de confirmar sincronización con `origin/main` y
  working tree limpio.
- TASK-005 Fase A: `TASK-005A COMPLETED`; Fase B: `TASK-005B READY_FOR_IMPLEMENTATION`. Brief, Plan,
  propuesta e implementation report permanecen en `.harness/tasks/active/TASK-005/` porque la tarea
  completa sigue abierta.
- Branch: `task/005-auth-users-center-access`.
- `pnpm bootstrap` y health check DEV: PASS.
- Supabase DEV: `ehllxymqyzrofydrvtzo` (`sa-east-1`). Las seis migrations de TASK-005 están
  sincronizadas local/remoto; las tres de TASK-004 permanecen inmutables (nueve versiones totales).
- DB lint: cero resultados. Advisors de seguridad: sólo las siete advertencias esperadas por RPCs
  `SECURITY DEFINER` autenticadas, todas con validación interna y grants explícitos aprobados.
- Suites de schema/concurrencia, catálogo/RLS/grants y Auth foundation: PASS; tipos regenerados desde
  DEV.
- La existencia de `SUPABASE_SECRET_KEY` moderna se verificó sin exponerla; `.env.local` está ignorado
  y no versionado. La configuración Auth Dashboard fue confirmada mediante comportamiento efectivo.
- No se ejecutó el bootstrap persistente. El bootstrap, provisioning y compensación sí se validaron
  con fixtures temporales DEV y cleanup.
- Cero fixtures persistentes, cero usuarios Auth temporales de TASK-005 y cero PLATFORM_ADMIN
  persistentes. PROD, push, PR, cierre y archivo de TASK-005 permanecen fuera de alcance.

## Decisiones aprobadas de TASK-005

- `SUPABASE_SECRET_KEY` moderna, server-only y limitada a Auth Admin/compensación/bootstrap.
- `public.users.email` como proyección lowercase, no nula y única; cambio de email fuera de alcance.
- Centro activo por `/centers/[centerId]/...`, sin preferencia persistida.
- `platform_admins` global separado de `membership_role` y sin bypass tenant.
- Bootstrap one-shot únicamente para el primer PLATFORM_ADMIN.
- `/platform` como mecanismo funcional para crear/activar/desactivar Centers y primer ADMIN.
- RPCs administrativas estrechas, seis policies SELECT y grants mínimos.
- Todo Center activo conserva al menos un ADMIN activo con enforcement concurrentemente seguro.
- Recovery DEV con SMTP de desarrollo y redirects explícitos; custom SMTP obligatorio antes de PROD.
- No quedan decisiones `REQUIRES_HUMAN_DECISION` abiertas en el diseño.

## Decisiones postergadas

- Email/recovery provider definitivo.
- Rate limiting concreto antes de producción pública.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.
