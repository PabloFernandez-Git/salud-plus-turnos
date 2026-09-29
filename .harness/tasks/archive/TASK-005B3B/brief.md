# TASK-005B3B — Listado de usuarios del Center

**Estado:** `COMPLETED / REVIEW PASS`

## Objetivo

Implementar la primera UI tenant de B3 en `/centers/[centerId]/users`, exclusivamente de lectura y
accesible sólo para una membership `ADMIN` activa del Center activo correspondiente.

## Baseline

- Commit base: `f1682f97228763bbb9f35f22c1529fac197729fa`.
- Branch: `task/005-auth-users-center-access`.
- Supabase DEV: `ehllxymqyzrofydrvtzo`; PROD fuera de alcance.
- TASK-005B3A: `COMPLETED / REVIEW PASS`.
- Trece migrations locales y DEV sincronizadas; B3B no prevé cambios DB.
- El único cambio preexistente es `next-env.d.ts`; no se modifica, revierte, stagea ni incluye.
- Baseline DEV persistente protegido: 1 Auth User, 1 User, 1 PLATFORM_ADMIN, 1 Center activo, 1
  membership ADMIN activa, 2 provisioning operations `SUCCEEDED` y 0 Professional,
  ProfessionalCenter y Specialty.

## Alcance

- Ruta `/centers/[centerId]/users`.
- Autorización server-side mediante `requireRole(centerId, ["ADMIN"])`.
- Query server-only sobre `center_memberships`, `users`, `professional_centers` y `professionals`,
  usando exclusivamente SELECT, RLS y grants existentes.
- Tabla con Nombre, Email, Rol, Estado, Profesional asociado y Acciones sin mutaciones.
- Estado vacío, error de lectura, loading y overflow horizontal razonable.
- Navegación simple Center → Usuarios sólo para ADMIN y Usuarios → Center.
- Tests de autorización, aislamiento, representación de datos/profesional, estados y navegación.
- E2E DEV con UUIDs de la corrida, cleanup exacto por IDs y comparación del baseline persistente.

## Criterios de aceptación

- [x] ADMIN activo del Center abre la ruta y sólo ve memberships de ese Center.
- [x] RECEPTION, PROFESSIONAL, membership inactiva, ADMIN de otro Center y PLATFORM_ADMIN sin ADMIN
      tenant quedan denegados server-side.
- [x] El `centerId` de la ruta nunca se toma como autoridad.
- [x] Nombre, email, rol humano, estado y asociación profesional se representan correctamente.
- [x] Sin vínculo profesional se muestra `—`; con vínculo permitido se muestra información mínima
      real sin inventar datos.
- [x] El estado vacío y el error de lectura son explícitos.
- [x] Existe navegación Center → Usuarios sólo para ADMIN y Usuarios → Center.
- [x] No se agregan DML, grants, RPCs ni migrations.
- [x] DEV termina idéntico al baseline y `next-env.d.ts` conserva exactamente su diff previo.
- [x] Regresiones solicitadas, build aislado, secret guard y `git diff --check` pasan.

## Riesgos y mitigaciones

- **Fuga cross-center:** filtrar por el Center autorizado y conservar RLS como segunda barrera.
- **PLATFORM_ADMIN convertido en autoridad tenant:** autorizar sólo por `CenterMembership.ADMIN`.
- **Autorización sólo visual:** proteger la ruta y la query en servidor; el link es sólo UX.
- **Lectura parcial/inconsistente:** fallar de forma segura si las relaciones requeridas no son
  visibles; no renderizar información inventada.
- **Contaminación de DEV:** fixtures temporales con IDs registrados y cleanup exacto, sin `LIKE`,
  prefijos ni borrado amplio.
- **Cambio ajeno en `next-env.d.ts`:** no editarlo y ejecutar build/guard en copia aislada.

## Fuera de alcance

Alta o reutilización de identidades, cambio de rol, activar/desactivar, edición de
ProfessionalCenter, password, identidad global, B3C, B3D, pacientes, especialidades,
disponibilidad, turnos, agenda, PROD, commit, push, PR y merge.
