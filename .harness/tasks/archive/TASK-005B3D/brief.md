# TASK-005B3D — Administración de memberships

**Estado:** `COMPLETED / REVIEW PASS`

## Objetivo

Extender `/centers/[centerId]/users` para que una membership `ADMIN` activa del Center activo pueda
administrar memberships existentes del mismo Center: cambiar rol, activar/desactivar acceso y
seleccionar o cambiar `ProfessionalCenter` cuando el rol sea `PROFESSIONAL`.

## Alcance

- acción **Administrar** en cada fila del listado existente;
- panel de edición limitado a identidad de solo lectura y estado tenant del Center actual;
- transiciones entre `ADMIN`, `RECEPTION` y `PROFESSIONAL`;
- activación y desactivación lógica reutilizando la misma membership;
- asociación `ProfessionalCenter` real, activa, libre y same-center para toda transición activa a
  `PROFESSIONAL`;
- desactivación pura de una membership `PROFESSIONAL` aun cuando su asociación haya quedado inactiva;
- confirmación explícita para cambio de rol, activación y desactivación;
- refresh desde servidor después de éxito, sin estado optimista;
- errores claros de autorización, stale/concurrencia, último ADMIN y ProfessionalCenter inválido u
  ocupado.

## Fuera de alcance

- crear identidades, memberships, Professionals o ProfessionalCenters;
- editar nombre, apellido, email, password, Auth, PLATFORM_ADMIN o memberships de otros Centers;
- eliminar físicamente datos;
- agregar RPCs, migrations, RLS o grants salvo incompatibilidad técnica real demostrada;
- módulos Profesionales, especialidades, pacientes, disponibilidad, turnos o agenda;
- PROD, commit, push, PR, merge o cierre/archivo de TASK-005.

## Criterios de aceptación

- Cada lectura y mutación reautoriza en servidor `ADMIN` activo del mismo Center activo; RECEPTION,
  PROFESSIONAL, ADMIN inactivo, ADMIN de otro Center y PLATFORM_ADMIN-only quedan denegados.
- La mutación valida `centerId` + `membershipId`; no confía en el rol/estado del navegador y la RPC
  `admin_set_center_membership` sigue siendo autoridad final.
- Se preserva concurrentemente al menos un ADMIN activo por Center, incluido self-admin.
- Desactivar conserva Auth, User, membership y accesos a otros Centers; reactivar reutiliza la fila.
- El rol PROFESSIONAL queda bloqueado sin asociación elegible. El mismo PC actual no se considera
  ocupado por sí mismo; cross-center, inactivo u ocupado por otra membership activa se rechazan.
- La desactivación pura PROFESSIONAL con PC luego inactivo se permite; reactivación/cambio vuelve a
  validar asociación activa.
- Después de éxito se revalida la ruta y la UI muestra el estado persistido real. Si el actor pierde
  autorización por self-demotion/desactivación, la respuesta no depende de una lectura posterior
  privilegiada y la navegación degrada de forma segura.
- Las pruebas cubren transiciones, autorización, aislamiento, identidad, último ADMIN, self-admin,
  ProfessionalCenter y concurrencia B3A; E2E usa UUIDs exactos y cleanup exacto sin baseline real.
- DEV queda idéntico antes/después y permanecen 14 migrations sincronizadas, incluida la migration
  CAS incremental aprobada por B3D-R1.

## Riesgos

- confiar en datos de fila o campos enviados por cliente para determinar Center/estado actual;
- convertir una pérdida legítima de permisos por self-admin en falso error después del commit;
- ocultar carreras con estado optimista o mensajes genéricos;
- omitir el PC actual de una membership al calcular opciones válidas;
- romper la excepción de desactivación pura PROFESSIONAL;
- cleanup E2E amplio que afecte el baseline persistente.

## Impacto

- **UI:** panel de administración por membership y confirmaciones explícitas.
- **Server:** schema/estado B3D, query de opciones por membership y Server Action delgada.
- **Database:** B3D-R1 demostró una ventana TOCTOU y requirió una migration incremental mínima para
  reemplazar la firma de `admin_set_center_membership` por su contrato CAS atómico.
- **Security:** alto; autorización tenant, pertenencia al Center y mensajes de error controlados.
- **Testing/docs:** unit/component/integration, E2E DEV, regresiones y documentación de acceso/estado.

## Baseline

- branch `task/005-auth-users-center-access`;
- HEAD inicial `a8f3378c09ee452fcddf6faf5b5591a0ebee7807`;
- DEV `ehllxymqyzrofydrvtzo`; PROD fuera de alcance;
- cambio previo ajeno `M next-env.d.ts`, que no se modifica, revierte, stagea ni incluye;
- 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN activa,
  2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters, 0 Specialties;
- 13 migrations local/DEV sincronizadas hasta `20260925120000`.
