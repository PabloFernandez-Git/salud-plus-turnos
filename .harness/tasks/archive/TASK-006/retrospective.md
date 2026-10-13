# Retrospective — TASK-006

## Resultado

TASK-006 habilitó la administración tenant de especialidades, profesionales, su vínculo con cada
centro y las asociaciones ProfessionalCenter ↔ Specialty. El review final emitió PASS, el PR #6
obtuvo REVIEW PASS y se integró en `main` mediante squash merge. La tarea quedó `COMPLETED` y
archivada después de la integración.

- PR: `#6 — feat: add professional and specialty administration`.
- Squash commit: `c127d3b81f73aba5c47d9ecf462529c73df79fcb`.
- Estado final: `TASK-006 COMPLETED` · `TASK-006 FINAL REVIEW PASS` · `PR #6 MERGED`.
- PROD permaneció fuera de alcance.

## Objetivo y alcance implementado

Un ADMIN activo de un Center activo puede crear, editar y cambiar el estado de Specialties; crear
un Professional o resolver una identidad existente por documento exacto; vincular, reutilizar o
reactivar su única fila ProfessionalCenter del Center; configurar matrícula y duración; y administrar
sus asociaciones con Specialties mediante deltas explícitos. La UI no crea Auth users, perfiles ni
memberships como efecto del alta de un Professional.

Las rutas tenant componen módulos en `src/modules/professionals/` y `src/modules/specialties/`.
Server Actions delgadas validan los inputs y delegan a funciones server; las mutaciones de dominio
se resuelven en RPCs PostgreSQL. No se agregaron Availability, pacientes, agenda ni turnos.

## Decisiones D1–D8 y arquitectura

- **D1 y D3:** la identidad global y la clave documental de Professional permanecen inmutables.
  PostgreSQL normaliza nacionalidad + documento y aplica la unicidad; una corrección global queda
  fuera de TASK-006.
- **D2:** el resolve exacto muestra sólo nombre, apellido y estado frente al Center actual. IDs y
  token CAS son soporte técnico opaco; no divulga email, teléfono, documento almacenado, otros
  Centers, User, Auth ni memberships. Vincular exige confirmación explícita.
- **D4:** una membership PROFESSIONAL activa bloquea la desactivación del ProfessionalCenter bajo
  el lock compartido con la administración de usuarios. No hay cascade: el ADMIN resuelve primero
  el acceso desde Usuarios. Una membership inactiva no bloquea.
- **D5:** una Specialty inactiva conserva sus asociaciones. Omitir una opción inactiva no la
  desasocia; una desasociación explícita sí cambia la relación. Al reactivarla, la asociación
  conservada vuelve a ser operativa.
- **D6:** existe una sola fila ProfessionalCenter por Professional + Center; se reutiliza o
  reactiva conservando por defecto matrícula, duración y asociaciones.
- **D7:** rutas, queries, Actions, funciones server y RPCs revalidan ADMIN tenant. RLS limita
  lecturas por Center; los grants son mínimos. RECEPTION, PROFESSIONAL, PLATFORM_ADMIN-only, actor
  inactivo, anon y cross-center quedan denegados.
- **D8:** cada mutación de entidad existente compara `expected_updated_at` después de adquirir
  locks. El batch PC–Specialty es atómico y versiona el aggregate ProfessionalCenter. Un no-op
  conserva el token; un estado stale falla sin efectos parciales.

Tres migrations incrementales añadieron la foundation, corrigieron la monotonicidad CAS y alinearon
el contrato de email server/PostgreSQL. Las 17 migrations locales y DEV quedaron sincronizadas.
Nueve RPCs estrechas `SECURITY DEFINER`, con `search_path` fijo y `EXECUTE` limitado a
`authenticated`, concentran la autoridad de escritura; no se abrió DML tenant genérico. El trigger
CAS usa `greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond')`: cada cambio
efectivo avanza estrictamente aun dentro de una misma transacción o si una transacción antigua se
aplica después.

## Findings y remediaciones

- **R1 HIGH y R2 MEDIUM de TASK-006B — CLOSED:** se reemplazó el token basado en tiempo de
  transacción por uno monotónico real y se compartieron casos del contrato de email entre Zod y
  PostgreSQL. Regresiones de CAS, no-op y concurrencia pasaron.
- **D-R1 LOW — CLOSED:** resolve/create rechazan en servidor documentos como `---`, que
  PostgreSQL canonicaliza a vacío, y muestran un error específico sin ampliar la respuesta D2.
- **FINAL-R1 MEDIUM — CLOSED:** la UI permite crear, editar, limpiar y mostrar la descripción
  opcional de Specialty; la RPC conserva normalización a `NULL`, CAS y no-op.
- **FINAL-R2 MEDIUM — CLOSED:** se completó el E2E de edición, nombre inactivo reservado,
  stale/refresh, membership inactiva y resolución D4 vía Usuarios; el smoke humano pasó 6/6.
- El finding LOW documental del review del PR #6 se corrigió y recibió REVIEW PASS antes del merge.
  Los veredictos previos `CHANGES_REQUESTED` permanecen en `review.md` sólo como historial.

## Integración, smoke y baseline DEV

TASK-006B, TASK-006C, TASK-006D y TASK-006E obtuvieron REVIEW PASS; TASK-006F obtuvo INTEGRATION
PASS y el review final de TASK-006 obtuvo PASS. El runner DB verificó RPC/RLS/grants,
deduplicación, privacidad D2, D4, CAS/no-op, batch atómico y carreras con locks observados. El E2E
ampliado pasó 1/1 y la regresión local final 308/308; lint, typecheck, build, Prettier y guard de
secretos también pasaron.

El smoke manual humano pasó 6/6 y se registró separado de Playwright. Su cleanup se pausó hasta
confirmar ownership de los UUID exactos, luego eliminó sólo esos fixtures y revalidó el baseline
DEV. El digest antes y después fue
`e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
No se ejecutaron migrations, seeds ni resets en PROD.

## Lecciones reutilizables

- Validar desde el inicio los contratos server y PostgreSQL con los mismos casos límite.
- No asumir que ocultar datos u opciones inactivas en la UI preserva relaciones: distinguir
  omisión de desasociación explícita y probar la persistencia.
- Usar CAS monotónico real; `now()` de tiempo de transacción no garantiza progreso estricto.
- Probar las carreras con locks y estado observable, incluidos no-op y transacciones antiguas.
- Distinguir verificación automatizada de smoke humano y registrar el cleanup y baseline de ambos.
- Mantener `docs/status.md` alineado con el punto real del workflow hasta después del merge.
- Cerrar el Harness en un PR documental separado después del merge funcional.

## Cierre

- TASK-006: `COMPLETED` y archivada.
- PLAN, TASK-006B/C/D/E, TASK-006F y review final: `PASS`.
- R1/R2 de TASK-006B, D-R1, FINAL-R1 y FINAL-R2: `CLOSED`.
- PR #6: `MERGED`; squash commit `c127d3b81f73aba5c47d9ecf462529c73df79fcb`.
- DEV: baseline restaurado según la evidencia de integración; PROD: intacto.
- No hay tarea activa ni próximo trabajo iniciado.
