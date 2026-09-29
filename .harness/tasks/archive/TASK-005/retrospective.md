# Retrospective — TASK-005

## Resultado

TASK-005 implementó la primera capa completa de autenticación, autorización y administración de
accesos de Salud Plus. El Integration Review final emitió `PASS`, PR #4 se integró en `main` mediante
squash merge y la tarea quedó formalmente `COMPLETED`.

- PR: `#4 — feat(auth): add authentication, center access and user administration`.
- HEAD aprobado: `0effea6885f8b76659a5fa7163e2cfee68f6af5c`.
- Squash commit: `374f039a3a11ecb696a7f764a948bbf9a75996aa`.
- Estado final: `TASK-005 COMPLETED` · `TASK-005 INTEGRATION REVIEW PASS` · `PR #4 MERGED`.
- PROD permaneció fuera de alcance.

## Objetivo y alcance implementado

La tarea conectó Supabase Auth con el modelo de usuarios y acceso por centro construido sobre el
schema de TASK-004. Quedaron implementados login, logout, recuperación y actualización de password,
refresh SSR, resolución de acceso 0/1/N, selector de centro, rutas tenant y estados sin acceso.

También se incorporaron:

- `PLATFORM_ADMIN` global y separado de los roles tenant;
- `/platform` para listar, crear, activar y desactivar Centers y provisionar su primer ADMIN;
- listado tenant de usuarios por Center;
- alta segura de usuarios nuevos o existentes;
- administración de rol, estado y asociación PROFESSIONAL de memberships;
- autorización server-side, RLS, grants mínimos y RPCs administrativas estrechas;
- tooling de bootstrap y suites unitarias, de componentes, DB, concurrencia y E2E.

## Decisiones arquitectónicas

- `PLATFORM_ADMIN` vive en `platform_admins`; no pertenece a `membership_role`, no crea una
  membership implícita y no concede acceso operativo a ningún Center.
- La identidad Auth y `public.users` mantienen responsabilidades separadas. El email proyectado se
  normaliza y Auth continúa siendo la autoridad.
- `src/app/` conserva composición y routing; autorización, provisioning y reglas importantes viven
  en `src/modules/access/`.
- Las mutaciones web usan Server Actions delgadas y delegan la lógica de producto al módulo.
- Las operaciones privilegiadas usan un cliente Admin `server-only` con `SUPABASE_SECRET_KEY`; el
  secreto no entra al navegador ni sustituye la autorización tenant normal.
- Los IDs de ruta seleccionan contexto, pero nunca otorgan autoridad.

## Auth y autorización

La autorización se revalida en servidor mediante el usuario actual, el estado del Center y la
membership vigente. Los roles `ADMIN`, `RECEPTION` y `PROFESSIONAL` pertenecen a cada relación con un
Center. RLS y helpers anti-recursión proporcionan una segunda barrera, con seis lecturas aprobadas y
sin DML tenant genérico.

La configuración DEV quedó verificada con signup público deshabilitado, password mínimo 10 y
redirects explícitos para callback y recovery. Esa configuración no se considera apta para PROD sin
los pendientes enumerados al final.

## Provisioning e idempotencia

El provisioning se diseñó como una operación reconciliable identificada por `operation_id`. El
estado durable conserva únicamente intención no secreta; el password existe sólo durante la
solicitud activa. Ante respuesta perdida o resultado ambiguo, el sistema reconcilia antes de decidir
una compensación, evitando borrar una identidad cuando la transacción pudo haber confirmado.

Las cuentas existentes se reutilizan sin cambiar password, email, perfil global ni memberships de
otros Centers. Las pruebas cubrieron retry, response-loss, doble submit, identidad existente,
compensación y concurrencia.

## Concurrencia e invariantes

Las operaciones administrativas comparten locks por Center y conservan en PostgreSQL las reglas que
no pueden depender de la UI:

- todo Center activo mantiene al menos un ADMIN activo;
- un ProfessionalCenter admite como máximo una membership PROFESSIONAL activa;
- la mutación de membership compara un snapshot esperado bajo advisory lock y row lock;
- un estado stale falla con `STALE_MEMBERSHIP_STATE` antes de mutar;
- bootstrap y provisioning son idempotentes y serializados donde corresponde.

## Findings importantes y correcciones

- `B3C-R1 — CLOSED`: cada intento elimina el password de `FormData`, DOM y estado React en `finally`,
  preservando sólo intención no secreta y el mismo `operation_id`.
- `B3D-R1 — CLOSED`: la RPC de membership incorporó compare-and-set atómico con expected role,
  estado y ProfessionalCenter bajo los locks existentes.
- `IR-1 — CLOSED`: el re-review confirmó el lifecycle completo del password B2 en éxito, error,
  excepción, timeout y response-loss.
- `IR-2 — CLOSED`: B1 eliminó discovery y cleanup por `LIKE`/prefijos; ownership, borrado y probes
  usan UUIDs exactos y baseline fail-closed.
- `IR-3 — CLOSED`: la evidencia manual B3B/B3C/B3D quedó persistida con permisos, invariantes,
  cleanup y baseline restaurado.

## Testing y smoke tests manuales

La evidencia final incluyó 172/172 tests unitarios/componentes, B1 9/9, B2 9/9, B3C 9/9, B3D 6/6,
suites de Auth/RLS/grants, schema, provisioning, reconciliación y concurrencia, además de format,
lint, typecheck, build y guard del bundle cliente. Las catorce migrations locales y DEV quedaron
sincronizadas y los tipos regenerados no mostraron drift.

Los smokes manuales confirmaron:

- login, `/platform`, creación del Center inicial, acceso tenant, refresh y logout;
- listado ADMIN y navegación Center ↔ Users;
- provisioning RECEPTION, límites de autorización y rechazo de duplicados;
- protección del último ADMIN;
- transiciones de rol y estado;
- guard PROFESSIONAL sin ProfessionalCenter;
- cleanup exacto y restauración del baseline DEV.

## Integration Review, PR y merge

El Integration Review cerró `IR-1`, `IR-2` e `IR-3` sin regresiones nuevas y emitió
`TASK-005 INTEGRATION REVIEW PASS`. El guard previo al merge confirmó el HEAD aprobado, CI `verify`
en verde, PR no draft, base `main`, mergeable y sin review threads ni requested changes.

PR #4 se integró sólo mediante squash merge. El árbol del squash coincide exactamente con el árbol
del HEAD aprobado y `next-env.d.ts` no formó parte del commit. Las branches TASK-005 remota y local
fueron eliminadas después de verificar la integración.

## Lecciones reutilizables

- Separar autoridad global y tenant evita convertir administración de plataforma en bypass de datos.
- Una operación distribuida Auth + PostgreSQL necesita identidad idempotente, estados reconciliables
  y compensación posterior a evidencia, no borrado optimista.
- Los secretos efímeros deben limpiarse en una barrera de finalización común; la intención durable no
  debe contenerlos.
- Los tests remotos deben registrar ownership exacto por UUID, fallar cerrados ante un baseline
  inesperado y demostrar cleanup por igualdad completa.
- Las carreras relevantes se prueban observando locks/estado real y gates determinísticos, no con
  sleeps.
- Un snapshot CAS validado dentro del mismo lock evita que una confirmación de UI aplique sobre estado
  stale.
- El cierre documental debe ocurrir después del merge y en un follow-up separado cuando el PR de
  producto ya fue integrado.

## Pendientes pre-PROD

Estos puntos siguen abiertos y no se consideran completados por TASK-005:

- configurar custom SMTP para recovery/email;
- definir y aplicar rate limiting para exposición pública;
- habilitar leaked-password protection de Auth.

## Cierre

- TASK-005: `COMPLETED`.
- Integration Review: `PASS`.
- Findings B3C-R1, B3D-R1, IR-1, IR-2 e IR-3: `CLOSED`.
- PR #4: `MERGED`.
- Squash commit: `374f039a3a11ecb696a7f764a948bbf9a75996aa`.
- PROD: intacto y fuera de alcance.
- TASK-006: no iniciada.
