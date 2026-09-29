# TASK-005B3D — Implementation report

**Estado:** `COMPLETED / REVIEW PASS`

## Resultado

Se extendió `/centers/[centerId]/users` con una acción **Administrar** por membership. Un ADMIN activo
del mismo Center puede cambiar rol, activar/desactivar acceso y seleccionar o reasignar
`ProfessionalCenter` para `PROFESSIONAL`. Nombre, apellido y email se muestran como identidad global
de solo lectura; Auth, password, PLATFORM_ADMIN y memberships de otros Centers no se editan.

Se reutiliza exclusivamente `admin_set_center_membership` y las garantías B3A existentes. La
remediación B3D-R1 agregó una migration incremental mínima que reemplaza la firma de esa misma RPC
para recibir el snapshot esperado; no agregó RPCs paralelas, RLS ni grants amplios.

## Flujo UI

El panel inline muestra usuario, email, rol, estado y asociación profesional relevantes al Center.
Los cambios pasan por **Revisar cambios** y una confirmación explícita que identifica usuario,
acción y nuevo rol cuando corresponde. La UI anticipa el único ADMIN evidente, ausencia de PC
elegible, PC actual inactivo/ocupado y no-op, pero nunca reemplaza la decisión server/DB.

No hay actualización optimista. La Server Action devuelve el estado persistido de la RPC,
`revalidatePath` refresca el listado y `router.refresh()` vuelve a leer datos. Una self-demotion
exitosa navega al inicio del Center; una self-deactivation navega al selector, evitando depender de
permisos ADMIN ya perdidos.

## Server, autorización y stale state

- `centerMembershipManagementSchema` valida UUIDs, roles, estado, vínculo profesional y cambios.
- `performUpdateCenterMembershipAction` autoriza antes de interpretar la mutación completa, mapea
  errores de dominio y retorna sólo el estado persistido necesario.
- `setCenterMembership` vuelve a exigir ADMIN activo, resuelve la membership por
  `(membership_id, center_id)` y conserva un precheck de rol/estado/PC para feedback rápido. Ese
  precheck es sólo UX y no constituye la autoridad stale.
- La única firma de `admin_set_center_membership` recibe también `expected_role`,
  `expected_is_active` y `expected_professional_center_id`. Tras el advisory lock del Center, la
  autorización interna y el `SELECT ... FOR UPDATE` de la membership, compara los tres campos con
  `IS DISTINCT FROM`; un mismatch aborta antes de invariantes/UPDATE con
  `P0001 / STALE_MEMBERSHIP_STATE`.
- La capa server mapea ese contrato DB al error recuperable `STALE`, que ya muestra que el acceso
  cambió y solicita recargar/reintentar. La RPC conserva autoridad final frente a concurrencia,
  último ADMIN, PC cross-center/inactivo/ocupado y postcondición tenant.

RECEPTION, PROFESSIONAL, ADMIN inactivo, ADMIN de otro Center y PLATFORM_ADMIN-only quedan
denegados. Un `membership_id` aislado de otro Center devuelve not-found controlado antes de la RPC.

## Rol, estado y self-admin

Se cubren `ADMIN ↔ RECEPTION`, `ADMIN ↔ PROFESSIONAL` y `RECEPTION ↔ PROFESSIONAL`. Cambiar a un rol
no profesional envía PC nulo. Desactivar conserva Auth, User, membership, password y demás accesos;
reactivar reutiliza la misma fila.

La UI bloquea el último ADMIN evidente y la RPC mantiene la postcondición concurrente. Self-admin no
tiene prohibición especial: con otro ADMIN activo puede degradarse o desactivarse; sin él, DB rechaza.

## PROFESSIONAL

La query de administración carga ProfessionalCenters activos del mismo Center y marca qué
membership activa los ocupa. Cada panel ofrece sólo libres o el PC ocupado por sí mismo. No muestra
cross-center, inactivos ni ocupados por otra membership; la RPC/índice parcial resisten payloads
manipulados y carreras.

Una desactivación pura de PROFESSIONAL conserva PC y se permite con PC luego inactivo. Reactivación,
cambio hacia PROFESSIONAL o cambio de PC revalida asociación activa/libre/same-center. Con el
baseline real de cero ProfessionalCenters, el rol queda bloqueado con explicación; no se crearon
datos profesionales reales.

## Tests y regresiones

- focalizados server/query/component: PASS 38/38 en 5 archivos;
- suite unitaria/componentes completa: PASS 168/168 en 23 archivos;
- B3D E2E DEV: PASS 6/6, incluido cambio de PC, PC propio, último ADMIN UI+RPC, self-admin,
  autorización negativa, identidad/otro Center intactos y PROFESSIONAL inactivo;
- B3C E2E: PASS 9/9; B3B E2E: PASS 4/4; B1 E2E: PASS 9/9; B2 E2E: PASS 9/9;
- B3A invariants: PASS con carrera determinística de dos ADMIN y de dos memberships por el mismo PC;
- stale DB atómico: PASS con dos sesiones coordinadas por advisory lock. La ganadora cambia
  `RECEPTION/activo/NULL` a `PROFESSIONAL/inactivo/UUID`; la operación bloqueada conserva el snapshot
  anterior, recibe `STALE_MEMBERSHIP_STATE` y no sobrescribe el estado confirmado;
- Auth/RLS/grants, provisioning reconciliation/orchestration, schema/concurrencia, bootstrap
  preflight, DEV health y Auth config: PASS;
- bootstrap, format check, lint, typecheck, build, client-bundle secret guard y unit tests: PASS.

El build y el guard corrieron en una copia temporal aislada para preservar el cambio preexistente de
`next-env.d.ts`. Windows impidió borrar tres binarios nativos hard-linked de esa copia temporal
(`next-swc`, `tailwindcss-oxide`, `lightningcss`), aun después de un reintento; no existe residuo en el
checkout ni en DEV.

## E2E, cleanup y baseline

El E2E B3D crea Auth users, Centers, memberships, Professionals y ProfessionalCenters temporales con
UUIDs exactos y los elimina sólo por esos UUIDs. No usa `LIKE`, prefijos de borrado ni el usuario
baseline. Cada corrida, incluidos intentos fallidos del harness, confirmó cleanup y baseline
persistente idéntico.

Estado DEV final: 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN
activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters y 0
Specialties.

Las 14 migrations local/DEV están sincronizadas hasta `20260928120000`. PROD no se tocó. No hubo
commit, push, PR, merge ni squash. TASK-005 no se cerró ni archivó.

## Diff y cambio ajeno

El diff B3D agrega UI/Server Actions/queries/tests/docs, el script E2E y la migration incremental
`20260928120000_make_membership_stale_check_atomic.sql`; las migrations históricas permanecen
intactas. `next-env.d.ts` conserva exactamente su diff preexistente ajeno contra
`a8f3378c09ee452fcddf6faf5b5591a0ebee7807`; no fue editado, revertido, stageado ni incluido por
B3D.

## Remediación B3D-R1

La causa era una ventana TOCTOU: el precheck server leía A sin compartir transacción con la RPC, por
lo que otra transacción podía confirmar A→B antes de que la primera RPC escribiera C. La firma previa
de cinco argumentos fue eliminada para impedir un bypass; la nueva firma de ocho argumentos añade
los tres campos esperados al contrato existente. El orden de locks no cambió: advisory lock común del
Center → autorización → row lock de la membership → compare expected/current → invariantes → update
→ postcondición último ADMIN. El catálogo y el harness verifican que la firma anterior ya no existe.
