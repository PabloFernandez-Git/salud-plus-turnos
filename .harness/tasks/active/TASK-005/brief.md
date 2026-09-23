# TASK-005 — Auth, usuarios y acceso a centros

**Estado:** `TASK-005A COMPLETED` · `TASK-005B READY_FOR_IMPLEMENTATION`

## Objetivo

Implementar, después de este gate documental, la primera capa funcional de autenticación y
autorización del producto sobre el schema de TASK-004. El alcance aprobado coordina Supabase Auth,
`public.users`, administración global mediante `platform_admins`, memberships por centro, contexto
PROFESSIONAL, autorización server-side, RLS, grants mínimos y una UI funcional mínima.

```text
Supabase Auth
↓
public.users
├── platform_admins → administración global en /platform
└── center_memberships → operación tenant en /centers/[centerId]/...
```

PLATFORM_ADMIN y los roles de centro son contextos independientes. `PLATFORM_ADMIN` no se agrega a
`membership_role`, no concede acceso operativo a tenants y no crea automáticamente memberships.

## Gate humano

Las decisiones humanas de Auth/acceso fueron aprobadas y la propuesta revisada incorpora el cambio
de bootstrap por centro a PLATFORM_ADMIN + `/platform`. No quedan entradas
`REQUIRES_HUMAN_DECISION` abiertas.

El gate autorizó TASK-005A y esa foundation obtuvo review PASS. El checkpoint actual autoriza iniciar
TASK-005B siguiendo el Plan; no autoriza por sí solo ejecutar el bootstrap persistente del primer
PLATFORM_ADMIN, tocar PROD, hacer push, abrir PR o mergear. Antes de cualquier cambio remoto de Fase
B seguirá siendo obligatorio revalidar DEV y el diff. PROD permanece fuera de alcance.

## Decisiones aprobadas incorporadas

- Sólo `SUPABASE_SECRET_KEY` moderna, server-only y en cliente administrativo `supabase-js`
  separado, sin persistencia, refresh ni detección de URL.
- Usuarios creados administrativamente quedan con email confirmado; no existe signup público.
- Recovery se implementa en TASK-005 con SMTP de desarrollo de Supabase y redirects concretos en
  DEV; custom SMTP es requisito previo a PROD, no de esta tarea.
- `public.users.email` será `text NOT NULL`, lowercase y `UNIQUE`; Auth sigue siendo la autoridad.
- No hay trigger sobre `auth.users` ni cambio de email en TASK-005.
- Cuentas existentes se reutilizan sin cambiar credenciales, email, nombre global ni otros accesos.
- Centro activo representado por `/centers/[centerId]/...`; el ID nunca autoriza.
- No hay escrituras genéricas a users/memberships; se usan RPCs estrechas.
- ADMIN/PROFESSIONAL reciben sólo las lecturas de Professional/ProfessionalCenter necesarias para
  resolver el vínculo; RECEPTION no.
- `platform_admins` modela el rol global, separado del enum y de las memberships.
- Único bootstrap excepcional: primer Auth user + `public.users` + `platform_admins`.
- `/platform` lista/crea/activa/desactiva centros y provisiona el primer ADMIN.
- Todo centro activo conserva al menos un ADMIN activo mediante operación concurrentemente segura.
- Desactivar un centro preserva memberships pero bloquea toda operación tenant.
- Contraseña mínima 10 en Zod/servidor y Supabase Auth, sin reglas compositivas artificiales ni
  cambio obligatorio en primer login.

## Contexto leído e inspeccionado

- `AGENTS.md`, Harness, startup y task loop.
- Producto, reglas, arquitectura, módulos access/centers/professionals y decisiones de Auth,
  autorización, PostgreSQL, seguridad, entornos, migrations y testing.
- Retrospectivas/reviews de TASK-003 y TASK-004.
- Tres migrations de TASK-004, tipos generados y clientes Supabase actuales.
- Baseline remoto de grants/RLS y documentación oficial vigente de Supabase.

## Estado inicial y baseline conservado

- Branch inicial verificada: `main`.
- `main == origin/main == 7bf1aa3d50b31d7ce420c805af60fe5b9c2ce01d`.
- Working tree inicial limpio; branch actual `task/005-auth-users-center-access`.
- `pnpm bootstrap`: PASS.
- Supabase DEV aprobado: `ehllxymqyzrofydrvtzo`, `sa-east-1`.
- Health check DEV de sólo lectura: PASS.
- Catálogo DEV: RLS 11/11, policies 0, grants de tabla `anon`/`authenticated` 0 y helpers propios
  `SECURITY DEFINER` 0.
- No se modificó DEV ni PROD durante el diseño.

## Alcance funcional aprobado

- Login, logout, sesión SSR/refresh, cambio y recuperación de contraseña.
- Selección/redirección de centro y estado sin acceso.
- `/platform` funcional mínimo, sólo PLATFORM_ADMIN.
- Alta de Center + primer ADMIN, activación/desactivación y tabla con contadores agregados.
- Administración mínima de usuarios/memberships por ADMIN del centro.
- Perfil 1:1 Auth/User, email proyectado y reutilización multi-centro.
- Contexto PROFESSIONAL propio.
- Policies/grants mínimos y RPCs/helpers estrechos.
- Bootstrap one-shot del primer PLATFORM_ADMIN.
- Pruebas unitarias, integración Auth/RLS y E2E de los flujos críticos.

## Criterios de aceptación del diseño

- [x] Modelo Auth/Platform/Center completo y sin mezclar permisos globales/tenant.
- [x] Contrato exacto de secret key y cliente administrativo definido.
- [x] Recovery DEV, password policy y email confirmado definidos.
- [x] Email proyectado, cuenta existente, fallo parcial y compensación definidos.
- [x] Bootstrap del primer PLATFORM_ADMIN definido sin crear la cuenta.
- [x] Alcance funcional y datos/contadores de `/platform` definidos.
- [x] Invariante del último ADMIN diseñada con protección concurrente.
- [x] API server-side con `requirePlatformAdmin()` y helpers tenant separados.
- [x] Tabla por tabla: operaciones, grants, policies/helpers/RPCs responsables.
- [x] Tablas operativas permanecen cerradas; contadores se obtienen por RPC agregada.
- [x] UI mínima y tests positivos/negativos definidos.
- [x] Documentación permanente alineada con PLATFORM_ADMIN.
- [x] No quedan decisiones humanas pendientes.
- [x] No se implementó ni se modificó Supabase.

## Impactos

- Security: **sí, alto** — Auth, secret key, password recovery y funciones privilegiadas.
- Authorization: **sí, alto** — separación global/tenant, revocación y ownership profesional.
- Database: **sí, alto** — nueva tabla, columna, constraints, helpers, RPCs, policies y grants.
- UI: **sí, funcional** — Auth, selector, sin acceso, `/platform` y usuarios del centro.
- Documentation: **sí** — tarea y contrato permanente actualizados.
- Testing: **sí, alto** — Auth temporal, RLS, concurrencia y compensación.
- Production: **fuera de alcance**.

## Riesgos principales

- Confundir PLATFORM_ADMIN con un bypass general de tenant.
- Recursión RLS o fuga indirecta desde entidades globales.
- Exposición/uso accidental de `SUPABASE_SECRET_KEY` fuera del cliente administrativo.
- Altas parciales entre Auth y PostgreSQL.
- Carrera al degradar/desactivar el último ADMIN.
- Centro reactivado sin ADMIN activo.
- Drift de email entre Auth y la proyección.
- Contadores implementados descargando datos operativos o ampliando SELECT innecesariamente.
- Recovery DEV aceptada erróneamente como configuración apta para PROD.

## Fuera de alcance

- Gestión de PLATFORM_ADMIN adicionales o recuperación extraordinaria desde plataforma.
- Cambio de email.
- CRUD completo de centros o profesionales.
- Acceso operativo global a pacientes, Person, PatientCenter, agenda, appointments, notas o
  disponibilidad.
- Escrituras sobre Professional/ProfessionalCenter.
- Signup público, OAuth, SSO, 2FA, magic links e invitaciones.
- Custom SMTP de PROD y rate limiting definitivo.
- Seeds permanentes, reset remoto y cualquier operación contra PROD.

## Condición de salida

TASK-005A quedó `COMPLETED` después de `TASK-005A REVIEW PASS` y del cierre de ambos findings. Este
checkpoint no cierra ni archiva TASK-005. TASK-005B queda `READY_FOR_IMPLEMENTATION` para completar
la UI y los flujos web pendientes, con revalidación de destino/branch/diff y su propia verificación y
review antes del cierre integral. El bootstrap persistente del primer PLATFORM_ADMIN sigue sujeto a
autorización humana adicional explícita.
