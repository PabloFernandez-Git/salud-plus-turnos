# TASK-004 — Esquema PostgreSQL inicial

**Estado:** `READY_FOR_REVIEW`

## Objetivo

Diseñar y dejar humanamente aprobado, sin implementar todavía, el esquema relacional inicial del MVP
de Salud Plus para PostgreSQL/Supabase. La propuesta debe representar centros, accesos, profesionales, especialidades,
personas/pacientes, disponibilidad y turnos; definir integridad, índices y aislamiento preliminar; y
dejar un contrato completo para una migration SQL posterior.

## Gate humano de schema

TASK-004 tiene impacto Database alto. El gate humano de diseño fue completado: U1, U2, P1, P2, P3,
S1, I1, I2, A1, A2, A3 y T1 fueron aprobadas y se incorporaron a `schema-proposal.md`.

La tarea está lista para que un Implementer materialice el diseño en una etapa posterior. En esta
conversación continúa prohibido:

- crear archivos SQL en `supabase/migrations/`;
- aplicar migrations o cualquier cambio de schema en Supabase DEV;
- crear tablas desde el Dashboard;
- regenerar o editar `src/lib/supabase/database.types.ts`;
- crear seeds o datos de prueba;
- implementar Auth, RLS funcional, UI o lógica productiva;
- ejecutar cualquier operación contra Supabase PROD;
- hacer commit, push o merge.

La aprobación del diseño no autoriza por sí sola ninguna operación contra PROD.

## Decisiones aprobadas incorporadas

- `public.users.id` comparte PK/FK 1:1 con `auth.users(id)` y el borrado no propaga en cascada.
- Una membership tiene un rol único; `PROFESSIONAL` exige un `professional_center_id` del mismo
  centro y roles combinados quedan fuera del MVP.
- La matrícula opcional pertenece a `professional_centers` y no tiene unicidad en el MVP.
- `persons` y `professionals` deduplican por nacionalidad ISO alpha-2 + documento normalizado por
  PostgreSQL, conservando el valor original.
- La duración habitual es `integer`, default 30, rango 5–480 y múltiplo de 5.
- El nombre de especialidad queda reservado por centro con unicidad case-insensitive y trim externo.
- Turnos bloquean por `professional_center_id`, no globalmente por `professional_id`; todos los
  estados salvo `CANCELLED` bloquean.
- `btree_gist` y exclusion constraints GiST fueron aprobados para la integridad concurrente.
- `centers.timezone` se guarda como texto no vacío con default aprobado; la validación IANA real es
  server-side, sin trigger PostgreSQL.
- `public.users` no incorpora `email` en el schema inicial: `auth.users` es la fuente y cualquier
  copia/sincronización se resolverá en la futura implementación de Auth/gestión de usuarios.

## Contexto relevante leído

- `AGENTS.md`
- `.harness/README.md`
- `.harness/protocols/startup.md`
- `.harness/protocols/task-loop.md`
- `.harness/agents/orchestrator.md`
- `.harness/agents/specialists/database-reviewer.md`
- `docs/product.md`
- `docs/business-rules.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/modules/centers.md`
- `docs/modules/access.md`
- `docs/modules/professionals.md`
- `docs/modules/specialties.md`
- `docs/modules/patients.md`
- `docs/modules/availability.md`
- `docs/modules/appointments.md`
- `docs/decisions/03-base-de-datos-y-plataforma-de-datos.md`
- `docs/decisions/04-autenticacion.md`
- `docs/decisions/05-autorizacion.md`
- `docs/decisions/09-testing.md`
- `docs/decisions/13-acceso-a-postgresql.md`
- `docs/decisions/14-seguridad-basica.md`
- `docs/decisions/16-estrategia-de-entornos-supabase.md`
- `docs/decisions/20-server-actions-route-handlers-y-lecturas-internas.md`
- `docs/decisions/21-supabase-cli-migrations-y-tipos-typescript-generados.md`
- `docs/decisions/22-fechas-horas-y-zonas-horarias.md`
- `docs/decisions/24-convenciones-de-codigo-y-naming.md`
- `docs/decisions/26-decisiones-pendientes.md`
- `docs/supabase-dev-setup.md`
- `supabase/README.md`
- `src/lib/supabase/database.types.ts`
- scripts de bootstrap, identidad DEV, conectividad y generación de tipos.

## Estado inicial verificado

- `main` estaba limpia antes de crear la branch.
- `git fetch origin` confirmó que `main` y `origin/main` apuntaban a
  `9093cd04a5f102a1fd5d5380c1f831554e77b983`, con divergencia `0/0`.
- Se creó `task/004-initial-postgres-schema` desde ese commit.
- `pnpm bootstrap` pasó con Node.js `24.21.0`, pnpm `11.26.0` y configuración/link DEV coherentes.
- El proyecto remoto verificado es `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, región
  `sa-east-1`, estado `ACTIVE_HEALTHY` y link activo.
- `pnpm supabase:check:dev` pasó con un health check de sólo lectura.
- Una generación de tipos enviada únicamente a stdout confirmó que `public` no contiene tablas,
  vistas, funciones, enums ni tipos compuestos del dominio.
- `src/lib/supabase/database.types.ts` representa el mismo schema vacío. La salida viva de la CLI
  difiere sólo en formato; el archivo versionado no fue modificado.
- No existen migrations SQL de dominio.

## Alcance del diseño

La propuesta cubre como mínimo:

- `centers`;
- `users`;
- `center_memberships`;
- `professionals`;
- `professional_centers`;
- `specialties`;
- `professional_center_specialties`;
- `persons`;
- `patient_centers`;
- `availabilities`;
- `appointments`.

La única tabla auxiliar agregada es `professional_center_specialties`, necesaria para modelar la
relación many-to-many entre la participación del profesional en un centro y las especialidades de
ese mismo centro, conservar la historia de la asignación y permitir integridad referencial desde
turnos.

## Criterios de aceptación de esta etapa de diseño

- [x] Se ejecutó el Startup Protocol y se inspeccionó el contexto relevante.
- [x] `main` fue verificada limpia y sincronizada antes de crear la branch solicitada.
- [x] `pnpm bootstrap` pasó.
- [x] La identidad de Supabase DEV y la ausencia de tablas del dominio en `public` se comprobaron
  mediante operaciones de sólo lectura.
- [x] El schema generado actual fue inspeccionado sin modificarlo.
- [x] Existe un diagrama textual del modelo.
- [x] Cada tabla propuesta documenta propósito, columnas, tipos, nulabilidad, defaults, PK, FK,
  unicidad, checks, estrategia de inactivación y timestamps.
- [x] Se justifican índices y constraints de consistencia multi-centro.
- [x] Se evalúa explícitamente la relación `users` ↔ `auth.users`.
- [x] Se separa el aislamiento estructural inicial, las policies dependientes de Auth/memberships y
  las reglas que deben permanecer server-side.
- [x] Se analiza la prevención concurrente de turnos y disponibilidades solapadas, incluidos costos
  y portabilidad.
- [x] Todas las decisiones humanas del schema fueron resueltas e incorporadas sin contradicciones.
- [x] No se creó ni aplicó ninguna migration y no se modificó DEV, PROD, Auth, seeds ni tipos.
- [x] La tarea queda en `READY_FOR_IMPLEMENTATION`.

## Impactos

- Security: **sí, alto** — identidad global, datos personales, barreras RLS y prevención de acceso
  entre centros.
- Authorization: **sí, alto** — roles por membership, vínculo del profesional y ownership.
- Database: **sí, alto** — modelo relacional, constraints, índices, extensión PostgreSQL propuesta y
  estrategia de migrations.
- Documentation: **sí** — Brief, Plan, propuesta de schema y estado actual.
- Testing: **sí, diseño** — se definen pruebas futuras de constraints, concurrencia y RLS.
- Production: **fuera de alcance** — no se autoriza ninguna operación contra PROD.

## Riesgos principales

- Una relación incorrecta entre `users`, `auth.users` y profesionales puede debilitar RLS o impedir
  preservar historia.
- `persons` y `professionals` son entidades globales: una policy demasiado amplia puede revelar que
  participan en otros centros.
- Duplicar `center_id` para asegurar coherencia mejora constraints, pero exige FKs compuestas y un
  orden de creación cuidadoso.
- La normalización de documentos puede fusionar identidades distintas o permitir duplicados si se
  define incorrectamente.
- Una validación de solapamiento sólo en código tiene carreras; una exclusion constraint reduce ese
  riesgo a cambio de acoplamiento PostgreSQL y del uso de `btree_gist`.
- El bloqueo por `ProfessionalCenter` permite simultaneidad entre centros para un mismo profesional;
  tests futuros deben proteger expresamente esta regla aprobada.
- Constraints que consulten estados activos o disponibilidad mediante triggers pueden volver el
  modelo rígido y complejo; se propone reservar esas reglas para una operación server-side/atómica.

## Fuera de alcance

- Escribir o aplicar migrations.
- Crear policies RLS definitivas.
- Implementar funciones RPC de reserva.
- Implementar el flujo de creación/sincronización de usuarios de Supabase Auth.
- Regenerar tipos TypeScript.
- Crear seeds, datos o fixtures.
- Cambiar módulos, UI o lógica de aplicación.
- Modificar Supabase DEV o PROD.
- Commit, push, PR, merge o cierre de TASK-004.

## Condición de salida de esta etapa

El diseño aprobado fue implementado mediante migrations versionadas y aplicado exclusivamente en
DEV. Las pruebas de integridad, concurrencia, catálogo, RLS/default-deny, tipos y checks del proyecto
quedaron documentadas en `implementation-report.md`. TASK-004 queda `READY_FOR_REVIEW`; review,
aceptación y cierre ocurren en una etapa posterior.
