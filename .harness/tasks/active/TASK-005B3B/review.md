# TASK-005B3B — Review independiente

**Veredicto:** `TASK-005B3B REVIEW PASS`

**Baseline revisado:** `f1682f97228763bbb9f35f22c1529fac197729fa`
**Branch:** `task/005-auth-users-center-access`
**Proyecto DEV:** `ehllxymqyzrofydrvtzo`
**Fecha:** 2026-09-28

## Findings

No se encontraron findings bloqueantes, altos, medios ni bajos dentro del alcance de B3B.

## Diff y alcance

El diff funcional contiene únicamente el listado tenant read-only de usuarios, navegación mínima,
componentes/UI, query server-only, tests y documentación/reportes de B3B. No contiene alta o
reutilización de identidades, passwords, cambio de rol, activación/desactivación de memberships,
edición de ProfessionalCenter, B3C, B3D, pacientes, agenda, turnos, disponibilidad ni
especialidades.

`next-env.d.ts` se separó expresamente del diff B3B. Conserva el cambio preexistente de imports
`.next/types/...` a `.next/dev/types/...`; no fue editado, revertido, stageado ni incluido por este
review. El build se ejecutó en una copia aislada y el hash del archivo en el checkout permaneció
idéntico.

## Autorización y aislamiento

- La página y `listCenterUsers` reautorizan mediante `requireRole(centerId, ["ADMIN"])` usando el
  cliente SSR del usuario.
- El `centerId` de la URL se valida como UUID y expresa sólo intención de navegación. No existen
  query params, Client Components ni chequeos de PLATFORM_ADMIN que amplíen autoridad tenant.
- ADMIN activo del Center queda permitido. RECEPTION, PROFESSIONAL, membership inactiva, ADMIN de
  otro Center y PLATFORM_ADMIN sin ADMIN tenant quedan denegados server-side; las URLs manuales
  continúan protegidas.
- La lectura de `center_memberships` filtra explícitamente por el Center autorizado. Los IDs de User
  se derivan sólo de esas filas. Los ProfessionalCenter se filtran por el mismo Center y por IDs
  derivados; los Professional se resuelven sólo desde esos vínculos ya acotados.
- La FK compuesta `(professional_center_id, center_id)` impide asociaciones cross-center y RLS/grants
  permanecen como segunda barrera efectiva. Las suites reales de Auth/RLS y B3B E2E pasaron.
- No existe service-role/admin client, bypass RLS, DML, lectura global de identities ni exposición de
  errores de relaciones. Una relación no visible produce un error genérico y la UI muestra un
  mensaje seguro.

## Datos, Professional y UX

- Nombre, email, rol y estado provienen respectivamente de `users` y de la membership del Center
  actual. La traducción Administrador/Recepción/Profesional es sólo presentacional.
- Sin `professional_center_id` se muestra `—`. Con vínculo se muestra únicamente nombre/apellido,
  matrícula opcional y estado inactivo del vínculo. No se consultan documento, email, teléfono,
  especialidades ni otros campos del Professional.
- `Acciones` contiene sólo `Sólo lectura`, sin botones, formularios, Actions ni mutaciones ocultas.
- Center → Usuarios se muestra sólo a ADMIN y Usuarios → Center existe en la pantalla. El ocultamiento
  del enlace no reemplaza el guard server-side.
- Título, contexto del Center, loading, error, empty state y overflow horizontal de la tabla son
  explícitos y coherentes con el shell tenant existente.
- Con el baseline real de DEV (0 Professionals y 0 ProfessionalCenters), el ADMIN persistente se
  representa con `—`.

## Tests y E2E auditados

Los 23 tests focalizados cubren autorización por rol/estado/Center, representación de identidad,
rol, estado, Professional, vacío/error y ambas navegaciones. Los mocks verifican filtros y
composición, mientras que los 4 E2E ejercitan la propiedad de autorización/RLS contra DEV real, por
lo que la frontera crítica no depende sólo de mocks.

Los 4 E2E usan `randomUUID()`/namespace propio por corrida y cleanup exacto por arrays de UUID. No
usan `LIKE`, prefijos amplios, borrados globales ni los datos persistentes como fixtures mutables. El
runner aborta antes de crear fixtures si el baseline no coincide, compara el snapshot completo al
final y exige residuo cero. B2 volvió a confirmar el hardening B3A-F1 y dejó el harness quiescent.

## DB y verificaciones

- 13 migrations locales / 13 DEV sincronizadas hasta `20260925120000`.
- Cero archivos nuevos o modificados bajo `supabase/migrations`; sin cambios de schema, RLS, grants,
  RPCs ni tipos generados.
- Baseline DEV verificado antes y después: 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center
  activo, 1 membership ADMIN activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals, 0
  ProfessionalCenters y 0 Specialties.
- `pnpm bootstrap`: PASS.
- DEV health y migration sync: PASS.
- Tests focalizados: PASS 23/23.
- Suite completa: PASS 97/97 en 16 archivos.
- B3B E2E: PASS 4/4, cleanup exacto y snapshot idéntico.
- B1 E2E: PASS 9/9, cleanup cero.
- B2 E2E: PASS 9/9, barrera tardía/cleanup y harness quiescent confirmados.
- B3A invariants, Auth/RLS foundation y schema/concurrencia: PASS con cleanup.
- format check, lint, typecheck y `git diff --check`: PASS.
- Build aislado y client-bundle secret guard: PASS; la ruta B3B compila dinámica.

El build dejó fuera del repositorio una copia temporal parcialmente bloqueada por el binario nativo
`next-swc` en Windows, comportamiento ambiental ya conocido. No existe proceso externo cuyo command
line apunte a esa copia; no afecta el checkout, DEV ni el veredicto.

## Documentación y límites

`brief.md`, `implementation-report.md`, `docs/modules/access.md` y `docs/status.md` describen
correctamente la implementación revisada y no alteran findings históricos. Este PASS aprueba sólo
B3B. No inicia B3C/B3D, no agrega mutaciones y no implica commit, push, PR, merge ni acceso a PROD.
