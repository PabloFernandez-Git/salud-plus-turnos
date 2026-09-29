# TASK-005B3B — Implementation report

**Estado:** `COMPLETED / REVIEW PASS`

## Resultado

Se implementó el listado read-only de usuarios del Center en `/centers/[centerId]/users`. La ruta
autoriza en servidor una membership `ADMIN` activa del Center activo; el parámetro de ruta no
concede autoridad. RECEPTION, PROFESSIONAL, membership inactiva, ADMIN de otro Center y
PLATFORM_ADMIN sin ADMIN tenant no reciben la UI ni sus datos.

## Archivos y responsabilidades

- `src/app/centers/[centerId]/users/page.tsx`: parseo UUID, autorización server-side, lectura y
  manejo seguro de deny/error.
- `src/app/centers/[centerId]/users/loading.tsx`: estado de carga accesible.
- `src/modules/access/server/center-users.ts`: query server-only read-only y composición de
  memberships, User y asociación Professional.
- `src/modules/access/components/center-users-{screen,table}.tsx`: header, regreso, error, vacío y
  tabla desktop-first con overflow horizontal.
- `src/modules/access/components/center-admin-navigation.tsx` y home del Center: enlace `Usuarios`
  sólo para ADMIN.
- tests unit/component y `tests/e2e/center-users.spec.mjs`.

## Autorización y fuente de datos

La página y la query usan `requireRole(centerId, ["ADMIN"])`. Después de autorizar, la query usa el
cliente SSR del usuario para SELECT sobre `center_memberships` filtrada por el mismo `centerId`,
`users`, `professional_centers` y `professionals`. Las policies/grants existentes siguen siendo la
segunda barrera. No se agregó migration, RPC, grant, policy ni DML genérico.

## Tabla y Professional asociado

Columnas: Nombre, Email, Rol, Estado, Profesional asociado y Acciones. Los valores de dominio no se
modifican; se presentan como Administrador, Recepción y Profesional. Estado deriva de
`center_memberships.is_active`. Sin `professional_center_id` se muestra `—`. Cuando existe un
vínculo visible se muestran nombre/apellido reales, matrícula si existe y aviso si el vínculo está
inactivo. Acciones contiene únicamente `Sólo lectura` y ningún control mutable.

## Tests

- Autorización unitaria: ADMIN permitido; RECEPTION, PROFESSIONAL, inactiva, cross-center y
  PLATFORM_ADMIN-only denegados.
- Query: filtro estricto por Center, memberships activas/inactivas y asociación Professional.
- Componentes: columnas/datos/roles/estados, `—`, vínculo profesional, vacío, error y ambas
  navegaciones.
- E2E B3B: 4/4; listado ADMIN, aislamiento cross-center, denegaciones, datos/Professional y
  navegación. Fixtures con UUIDs propios, cleanup exclusivo por IDs, sin `LIKE` ni prefijos amplios;
  baseline persistente idéntico antes/después.

## Regresiones

- bootstrap, health DEV y Auth config: PASS.
- migrations: 13 locales / 13 DEV sincronizadas hasta `20260925120000`.
- schema/concurrencia, B3A invariants, Auth/RLS foundation, provisioning reconciliation y
  orchestration: PASS con cleanup.
- B1 E2E: primera corrida 8/9 por el flake preexistente documentado de `input.validity.valid`;
  repetición completa PASS 9/9, cleanup cero.
- B2 E2E: PASS 9/9, incluida la barrera B3A-F1; cleanup cero y harness quiescent.
- B3B E2E: PASS 4/4; cleanup exacto y baseline idéntico.
- format/check, lint, typecheck y unit/component: PASS; 97/97 en 16 archivos.
- build y client-bundle secret guard: PASS en copia temporal aislada; la ruta nueva compila como
  dinámica. Tres binarios nativos hardlinkeados quedaron bloqueados por Windows fuera del repo,
  igual que en B3A; no queda proceso cuyo command line apunte al temporal.
- `git diff --check`: PASS.

## Estado final

DEV permanece en 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN
activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters y 0
Specialties. PROD no se tocó. No hubo commit, push, PR ni merge. `next-env.d.ts` conserva exactamente
su diff preexistente y ajeno. B3C/B3D no se iniciaron.
