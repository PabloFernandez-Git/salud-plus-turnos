# TASK-005B3C — Implementation report

**Estado:** `COMPLETED / REVIEW PASS`

## Resultado

Se extendió `/centers/[centerId]/users` con un flujo staged **Agregar usuario** exclusivo para una
membership `ADMIN` activa del mismo Center activo. El flujo resuelve el email exacto, reutiliza una
identidad existente sin mutarla o crea una identidad nueva mediante el provisioning aprobado, y
crea únicamente la membership inicial del Center actual.

No se implementaron cambios posteriores de rol/estado, reactivación, edición o reasignación de
ProfessionalCenter ni B3D. No hubo cambios de schema, migrations, RLS, grants, tipos generados o
RPCs.

## Archivos y responsabilidades

- `src/app/centers/[centerId]/users/page.tsx`: autorización ADMIN, listado y carga de
  ProfessionalCenters elegibles.
- `src/modules/access/server/center-users.ts`: listado B3B y query server-only de asociaciones
  Professional activas, libres y del mismo Center.
- `src/modules/access/server/center-user-actions.ts`: resolución exacta, reautorización,
  canonicalización de identidad y adaptación segura al provisioning existente.
- `src/modules/access/actions/center-user-actions.ts`: Server Actions delgadas y revalidación de la
  ruta tenant exacta.
- `src/modules/access/schemas/center-user-provisioning.ts` y
  `src/modules/access/domain/center-user-action-state.ts`: contratos Zod y estados explícitos del
  flujo.
- `src/modules/access/components/add-center-user-panel.tsx` y
  `use-center-user-operation-intent.ts`: UI staged, bloqueo sin ProfessionalCenter, latch de submit
  y recuperación fail-closed de intención no secreta.
- `tests/e2e/center-user-provisioning.spec.mjs`: autorización, altas, reutilización, invariantes
  Professional, idempotencia, response-loss y cleanup exacto.

## Identidad y membership

`admin_resolve_user_by_email` se invoca sólo después de `requireRole(centerId, ["ADMIN"])`. La UI
recibe únicamente ID, email, nombre/apellido y si ya pertenece al Center actual; no recibe roles,
memberships de otros Centers ni estado de PLATFORM_ADMIN.

En una identidad existente, el submit vuelve a resolverla en servidor y reemplaza los campos del
cliente por los datos canónicos. No cambia email, password, nombre, apellido ni memberships de
otros Centers. Una membership activa o inactiva ya existente en el mismo Center produce una
respuesta terminal clara, sin duplicar, reactivar, editar o cambiar rol.

En una identidad nueva se exigen nombre, apellido, email exacto y password de al menos 10
caracteres. La orquestación reutiliza `provisionCenterUser` y `admin_provision_center_user` para
Auth confirmado → `public.users` → `center_memberships`, con reconciliación y compensación ya
aprobadas.

## Professional

La opción `PROFESSIONAL` queda deshabilitada cuando no existe una asociación elegible. Sólo se
ofrecen ProfessionalCenters del mismo Center, activos y sin otra membership PROFESSIONAL activa.
Las validaciones y locks B3A permanecen como autoridad frente a manipulación, asociaciones
cross-center, inactivas, ocupadas o carreras. No se crean Professionals ni ProfessionalCenters
ficticios.

## Idempotencia y password

Cada intento conserva un UUID `operation_id` estable ante retry, timeout, response-loss y refresh.
El snapshot de recuperación queda acotado por actor y Center, contiene sólo metadata no secreta y
se valida fail-closed; una intención inválida exige abandono explícito. El doble submit se bloquea
sincrónicamente y el latch se libera en `finally`, incluso si dos respuestas de validación son
estructuralmente iguales.

El password existe sólo en el input y durante el submit. No entra en session/local storage, URL,
cookies, IndexedDB, logs, snapshot, hash de intención ni DB de provisioning. Después de refresh se
solicita nuevamente sólo si Auth todavía debe crearse.

## Corrección B3C-R1 — lifecycle del password

El finding medio del Reviewer se corrigió en el wrapper cliente de provisioning. Al finalizar cada
intento, un único bloque `finally` borra `initialPassword` del `FormData`, vacía inmediatamente el
input y reemplaza `values.initialPassword` por `""`; luego libera el latch. Esto ocurre ante éxito,
error funcional, resultado ambiguo y excepción/timeout de transporte. No se copia el secreto a otro
state, ref, snapshot o log.

Una excepción de transporte se convierte en estado ambiguo `same-operation`: la intención durable
no secreta y su `operation_id` se conservan, pero el password no. El retry de reconciliación se envía
con password vacío; si el backend confirma una operación ya completada, termina sin solicitarlo. Si
Auth todavía necesita crearse, el servidor devuelve el error de campo existente y la UI solicita
que el usuario ingrese una contraseña nueva sin cambiar la operación.

## Tests y regresiones

- focalizados B3C después de B3C-R1: PASS 51/51 en 6 archivos;
- suite unitaria/componentes completa final: PASS 141/141 en 20 archivos;
- B3C E2E DEV: PASS 9/9, incluidos doble submit, retry con el mismo operation ID, response-loss,
  snapshot inválido, identidad no mutada y ProfessionalCenter válido/inválido;
- B3B E2E: PASS 4/4; B1 E2E: PASS 9/9; B2 E2E: PASS 9/9;
- B3A invariants, Auth foundation, provisioning reconciliation, provisioning orchestration,
  schema/concurrencia, catálogo/grants/RLS y bootstrap preflight: PASS con cleanup;
- DEV health y Auth config: PASS;
- bootstrap, format check, lint, typecheck y `git diff --check`: PASS;
- build y client-bundle secret guard: PASS en una copia temporal aislada; la ruta de usuarios
  compila dinámica y no contiene centinelas de secretos.

Las regresiones nuevas demuestran limpieza después de éxito, error funcional, excepción/timeout y
resultado ambiguo. También prueban que el retry conserva el mismo `operation_id`, no conserva el
password y mantiene el snapshot durable libre del secreto.

Los E2E usan UUIDs propios y borrado por IDs exactos. No usan `LIKE`, prefijos amplios ni el usuario
persistente como fixture mutable. El temporal de build quedó fuera del repositorio con tres
familias de binarios nativos bloqueadas por Windows (`next-swc`, `tailwindcss-oxide` y
`lightningcss`), sin impacto en el checkout ni en DEV.

## Estado final

DEV conserva 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN
activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters y 0
Specialties. Las 13 migrations locales/DEV están sincronizadas hasta `20260925120000`. PROD no se
tocó. No hubo commit, push, PR ni merge. `next-env.d.ts` conserva exactamente su diff preexistente
y ajeno.
