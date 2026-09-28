# Estado actual

**Fase:** Auth, plataforma y acceso a centros — A/B1/B2, preflight, B3A y B3B completados
**Tarea activa:** TASK-005 — Auth, usuarios y acceso a centros
**Última tarea completada:** TASK-004 — Esquema PostgreSQL inicial
**Estado:** `TASK-005A COMPLETED` · `TASK-005B1 COMPLETED` · `TASK-005B2 COMPLETED` · `BOOTSTRAP PREFLIGHT REMEDIATION COMPLETED` · `TASK-005B3A COMPLETED` · `TASK-005B3B COMPLETED / REVIEW PASS`

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
- TASK-005B1 implementó login/logout, recovery/callback/update password, resolución 0/1/N de
  memberships activas en Centers activos, selector, shell tenant protegido y placeholder temporal
  de PLATFORM_ADMIN. Las pruebas unitarias y 9 E2E DEV pasan con cleanup cero.
- TASK-005B1 obtuvo `TASK-005B1 REVIEW PASS` y se cerró formalmente como checkpoint sin cambios de
  schema, migrations, RLS, grants ni RPCs, y sin cerrar ni archivar TASK-005.
- TASK-005B2 implementó `/platform` funcional para listar Centers con contadores agregados, crear
  Center + primer ADMIN y activar/desactivar Centers, reutilizando exclusivamente la foundation
  aprobada de Fase A.
- TASK-005B2 obtuvo `TASK-005B2 REVIEW PASS`; ambos findings quedaron cerrados y B2 se cerró como
  checkpoint sin cambios de schema, migrations, RLS, grants, RPCs ni tipos generados.
- La remediación del bootstrap agregó una RPC de preflight service-only con respuesta exacta,
  revalidación final de `auth.users`, serialización con lock `SHARE`, y pruebas de
  concurrencia/idempotencia sin ampliar grants de dominio.
- La remediación obtuvo `BOOTSTRAP PREFLIGHT REMEDIATION REVIEW PASS`; BP-F1 y BP-F2 quedaron
  cerrados.
- El bootstrap persistente del primer PLATFORM_ADMIN se ejecutó después de su autorización humana.
  El smoke manual real confirmó login, `/platform`, creación de `Centro Médico Salud Plus`
  reutilizando la identidad existente como primer ADMIN, acceso tenant, refresh, logout y redirect
  directo al único Center activo al volver a iniciar sesión.
- TASK-005B3 completó ANALYZE + PLAN y design review. B3-D1 fue aprobada con máximo una membership
  PROFESSIONAL activa por ProfessionalCenter, preservando asociaciones inactivas históricas cuando
  el modelo actual lo permite. B3 queda `DESIGN APPROVED FOR IMPLEMENTATION`; TASK-005 continúa
  activa.
- TASK-005B3A implementó en DEV el UNIQUE parcial de ProfessionalCenter activo exclusivo y ajustó
  `admin_provision_center_user`/`admin_set_center_membership` con el lock común por Center,
  validaciones state-aware y postcondición concurrente del último ADMIN. La migration 13, las
  regresiones y el baseline persistente pasan.
- TASK-005B3A obtuvo `TASK-005B3A REVIEW PASS`; el finding medio del harness B2 quedó cerrado tras
  verificar la barrera determinística de cleanup, distinguir HTTP 200 de éxito funcional y
  clasificar el fallo aislado B1 como flake preexistente del harness. En ese checkpoint B3B y UI B3
  todavía no se habían iniciado.
- TASK-005B3B implementó el listado tenant read-only `/centers/[centerId]/users`, protegido por
  ADMIN activo del Center, con tabla de identidad/rol/estado/asociación Professional y navegación
  tenant mínima. Reutiliza SELECT + RLS/grants existentes, sin migrations, RPCs, DML ni ampliación de
  permisos. Unit/component, E2E B3B y regresiones B1/B2/B3A pasan con baseline DEV intacto.
- TASK-005B3B obtuvo `TASK-005B3B REVIEW PASS` y se cerró formalmente como checkpoint sin iniciar
  B3C/B3D ni cerrar TASK-005.

## Próximo

Esperar una instrucción posterior antes de iniciar B3C. B3D permanece sin iniciar.

## Estado operativo

- Branch: `task/005-auth-users-center-access`, creada desde `main` en
  `7bf1aa3d50b31d7ce420c805af60fe5b9c2ce01d` después de confirmar sincronización con `origin/main` y
  working tree limpio.
- TASK-005 Fase A: `TASK-005A COMPLETED`; B1: `TASK-005B1 COMPLETED`; B2:
  `TASK-005B2 COMPLETED`; remediación de preflight: `COMPLETED`; B3:
  `TASK-005B3A COMPLETED`; B3B: `COMPLETED / REVIEW PASS`. Brief, Plan,
  propuesta e implementation report permanecen en `.harness/tasks/active/TASK-005/` porque la
  tarea completa sigue abierta.
- Branch: `task/005-auth-users-center-access`.
- `pnpm bootstrap` y health check DEV: PASS.
- Supabase DEV: `ehllxymqyzrofydrvtzo` (`sa-east-1`). Las diez migrations de TASK-005 están
  sincronizadas local/remoto; las tres de TASK-004 permanecen inmutables (trece versiones totales).
- DB lint: cero resultados. Advisors de seguridad: siete advertencias esperadas por RPCs
  `SECURITY DEFINER` autenticadas más el warning Auth conocido de leaked-password protection; cero
  ERROR y sin nueva superficie pública.
- Suites B3A, schema/concurrencia, catálogo/RLS/grants y Auth foundation: PASS; tipos regenerados
  desde DEV sin drift.
- La existencia de `SUPABASE_SECRET_KEY` moderna se verificó sin exponerla; `.env.local` está ignorado
  y no versionado. La configuración Auth Dashboard fue confirmada mediante comportamiento efectivo.
- Baseline DEV persistente auditado read-only: 1 `auth.users`, 1 `public.users`, 1
  `platform_admins`, 1 Center activo, 1 membership ADMIN activa, 0 Professional, 0
  ProfessionalCenter y 0 Specialty. El User posee, de forma independiente, PLATFORM_ADMIN global y
  ADMIN tenant.
- B3B no cambió DB: trece migrations locales/DEV siguen sincronizadas. Su E2E usa UUIDs propios y
  cleanup exacto por IDs, sin `LIKE` ni prefijos amplios, y reconfirmó el baseline persistente
  idéntico antes/después.
- Center persistente: `Centro Médico Salud Plus`
  (`76dcbe41-38be-475d-a590-f4ae6619c1e8`, `America/Argentina/Buenos_Aires`).
- `private.provisioning_operations` conserva dos operaciones reales `SUCCEEDED`: bootstrap
  `352a309e-f137-488e-b6e7-4b53e2cdb7b2` y creación de Center
  `964ec4bf-eeba-4f4f-914a-d2a8ca101934`. Esta última reutilizó la identidad; no creó otra.
- Cero Auth users con namespaces temporales conocidos de TASK-005. Los datos anteriores son
  persistentes de desarrollo y no deben borrarse ni entrar en cleanup de tests.
- PROD, push, PR, cierre y archivo de TASK-005 permanecen fuera de alcance.

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
- B3-D1 aprobada: un ProfessionalCenter admite como máximo una membership PROFESSIONAL activa. La
  autoridad es un UNIQUE parcial, reforzado por RPCs y el lock común del Center. No se modelan
  cuentas compartidas/delegadas ni quedan decisiones humanas abiertas en B3.

## Decisiones postergadas

- Email/recovery provider definitivo.
- Rate limiting concreto antes de producción pública.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.
