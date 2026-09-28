# TASK-005B3C — Alta y reutilización de usuarios

**Estado:** `COMPLETED / REVIEW PASS`

## Objetivo

Extender `/centers/[centerId]/users` para que una membership `ADMIN` activa del Center activo pueda
resolver un email exacto, reutilizar una identidad existente o crear una identidad nueva y crear su
membership inicial en el Center actual.

## Alcance

- acción visible **Agregar usuario** dentro de la pantalla B3B;
- resolución exacta por email mediante `admin_resolve_user_by_email`;
- reutilización de `auth.users`/`public.users` sin modificar identidad, credenciales ni accesos
  ajenos;
- creación de identidad Auth confirmada, `public.users` y membership mediante el provisioning
  idempotente existente y `admin_provision_center_user`;
- roles iniciales `ADMIN`, `RECEPTION` y `PROFESSIONAL`;
- `PROFESSIONAL` sólo con un ProfessionalCenter real, activo, libre y del mismo Center;
- operación estable ante retry, timeout, response-loss y refresh sin persistir el password;
- refresh del listado y confirmación visible después del alta.

## Fuera de alcance

- cambio posterior de rol;
- activar o desactivar memberships existentes;
- edición o reasignación de ProfessionalCenter;
- B3D y módulos de profesionales, pacientes, especialidades, disponibilidades, turnos o agenda;
- migrations, schema, RLS o grants salvo incompatibilidad técnica real demostrada;
- PROD, commit, push, PR o merge.

## Criterios de aceptación

- Sólo un `ADMIN` activo del mismo Center activo puede leer o mutar el flujo; `RECEPTION`,
  `PROFESSIONAL`, ADMIN inactivo, ADMIN de otro Center y PLATFORM_ADMIN-only son denegados en
  servidor.
- La identidad existente conserva email, password, nombre, apellido y memberships de otros
  Centers; la UI muestra únicamente identidad mínima y el estado de pertenencia al Center actual.
- Una membership ya existente en el Center no se duplica ni se reactiva/edita; se informa de forma
  clara.
- La identidad nueva exige nombre, apellido y password de al menos 10 caracteres y usa el
  provisioning reconciliable aprobado.
- `PROFESSIONAL` aparece bloqueado si no hay un ProfessionalCenter elegible y las invariantes B3A
  permanecen bajo autoridad del servidor/DB.
- El mismo `operation_id` se conserva durante retry y refresh; el password permanece sólo en
  memoria/form submit y nunca entra en storage, URL, cookie, DB de provisioning, logs o estado
  serializado.
- El submit evita dobles envíos, revalida el listado y muestra la nueva membership.
- Las pruebas focalizadas y E2E cubren altas nuevas, reutilización, autorización negativa,
  ProfessionalCenter válido/inválido, password, idempotencia, doble submit y response-loss cuando
  el harness lo permite.
- El baseline DEV persistente y las 13 migrations local/DEV permanecen intactos.

## Riesgos

- enumeración o fuga de roles/memberships globales al resolver una identidad;
- mutación accidental de una identidad existente o de accesos de otro Center;
- duplicado/huérfano Auth ante retry o pérdida de respuesta;
- persistencia accidental del password al recuperar una intención;
- confiar en la UI para autorización o elegibilidad de ProfessionalCenter;
- cleanup E2E demasiado amplio sobre el baseline DEV real.

## Impacto

- **UI:** flujo staged de alta dentro de la pantalla de Usuarios.
- **Server:** schemas, query de ProfessionalCenter elegibles, Server Actions y adaptador de
  provisioning.
- **Database:** sin cambios previstos; se reutilizan RPCs e invariantes existentes.
- **Security:** alto; Auth Admin permanece encapsulado server-only y toda operación reautoriza.
- **Testing/docs:** cobertura focalizada, E2E DEV con UUIDs propios y actualización de status/report.

## Baseline

- branch `task/005-auth-users-center-access`;
- HEAD inicial `637663cc6c297a3d6813d7cb17172f82deb04969`;
- DEV `ehllxymqyzrofydrvtzo`; PROD fuera de alcance;
- cambio previo ajeno `M next-env.d.ts`, que no se modifica, revierte, stagea ni incluye;
- 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN activa,
  2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters, 0 Specialties.
