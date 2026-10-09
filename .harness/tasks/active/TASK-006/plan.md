# TASK-006 — Plan

**Estado:** `PLAN REVIEW PASS — READY FOR IMPLEMENTATION`

## Estrategia

Implementar TASK-006 como cinco checkpoints verticales y verificables, con la base de datos como
autoridad de aislamiento, deduplicación, estado y concurrencia. La UI refleja permisos y estados;
las páginas, queries y Server Actions reautorizan; RLS y RPCs estrechas aplican la barrera final.

```text
ADMIN tenant activo
↓
/centers/[centerId]/professionals | /specialties
↓
queries server-only / Server Actions delgadas
↓
RLS SELECT + RPCs tenant estrechas
↓
Professional global inmutable
└── ProfessionalCenter mutable por Center
    └── ProfessionalCenterSpecialty mutable por intención explícita
```

No se crea un documento de diseño adicional: este plan y el brief contienen el contrato suficiente
sin duplicar fuentes de verdad.

## Baseline y límites vinculantes

- Branch: `task/006-professionals-specialties`.
- Base exacta: `4760c77360fdadea6e0f2cfdc143da23cbba4e1a`, igual a `origin/main` al crearla.
- Cambio ajeno protegido: `M next-env.d.ts`, unstaged, hash observado
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Migrations actuales: 14 locales/remotas sincronizadas antes de PLAN.
- Professional global es inmutable después del alta.
- ProfessionalCenter es la configuración administrable del Center y el aggregate/version token de
  especialidades.
- Crear/vincular Professional nunca crea Auth User, `public.users` ni `center_memberships`.
- Sólo ADMIN tenant activo administra; no hay bypass PLATFORM_ADMIN.
- No se agregan lecturas TASK-006 para RECEPTION o PROFESSIONAL y no se restringen las lecturas de
  TASK-005.
- No hard delete; desasociar una Specialty marca la asociación como inactiva (`is_active = false`).
- Availability, appointments, agenda, patients, historia clínica, excepciones, booking público,
  reminders, billing y PROD quedan fuera.

## Gate antes de implementar

El plan review independiente emitió PASS. No iniciar TASK-006B hasta recibir una nueva instrucción
humana explícita de implementación. En ese momento el Implementer deberá:

1. releer `brief.md`, este plan, AGENTS y el estado actual del repositorio;
2. confirmar branch/base/diff y que `next-env.d.ts` conserva exactamente su cambio previo;
3. ejecutar `pnpm bootstrap` y health checks read-only;
4. reconfirmar las 14 migrations sincronizadas y que no apareció una migration ajena;
5. capturar el baseline DEV persistente por IDs y contenido, no sólo por conteos;
6. confirmar que PROD está fuera de alcance y que el project ref es el DEV aprobado;
7. preparar migration y tests localmente antes de cualquier `db push` a DEV;
8. aplicar cambios sólo a DEV bajo una instrucción de implementación posterior;
9. abortar fail-closed si el baseline, los grants o las policies reales difieren del contrato.

## Organización de aplicación prevista

Crear sólo las capas que cada vertical necesite:

```text
src/app/centers/[centerId]/professionals/page.tsx
src/app/centers/[centerId]/specialties/page.tsx

src/modules/professionals/
├── actions/
├── components/
├── queries/
├── schemas/
└── server/

src/modules/specialties/
├── actions/
├── components/
├── queries/
├── schemas/
└── server/
```

Las carpetas se materializan progresivamente, no vacías. `src/app/` sólo valida params, resuelve
contexto, maneja redirect/not-found y compone pantallas. La lógica de normalización de inputs,
errores, estado y persistencia vive en los módulos.

## TASK-006B — DB/API foundation

### Objetivo

Agregar exclusivamente la superficie de lectura y mutación que TASK-006 necesita, sin modificar
tablas/columnas existentes ni abrir DML genérico. Esta subfase produce una migration incremental,
tipos regenerados y suites DB, sólo durante implementación aprobada.

### RLS y grants

Mantener sin cambios las policies y grants SELECT actuales de `professionals` y
`professional_centers`, porque TASK-005 los necesita.

Agregar:

| Tabla                             | Policy SELECT propuesta                                                                              | Grant                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------- |
| `specialties`                     | `specialties_select_center_admin` usando `private.has_active_center_role(center_id, ARRAY['ADMIN'])` | `SELECT` a `authenticated` |
| `professional_center_specialties` | `professional_center_specialties_select_center_admin` con la misma condición por `center_id`         | `SELECT` a `authenticated` |

Reglas:

- no policies para INSERT/UPDATE/DELETE;
- no grants DML a `authenticated`, `anon`, `PUBLIC` ni `service_role` como sustituto de API;
- `anon` continúa sin acceso de dominio;
- no ampliar las policies existentes a RECEPTION, PROFESSIONAL o PLATFORM_ADMIN;
- todo retorno de RPC se limita al Center autorizado o a la identidad mínima exacta aprobada.

### Contrato común de RPCs

Todas las RPCs públicas nuevas:

- son `SECURITY DEFINER` con `SET search_path = ''`;
- usan nombres completamente calificados;
- reciben `p_center_id` explícito, pero nunca lo consideran autorización;
- revalidan `private.has_active_center_role(p_center_id, ARRAY['ADMIN'])`;
- exigen Center activo por medio del helper existente;
- ejecutan `REVOKE ALL ... FROM PUBLIC, anon, authenticated` y luego `GRANT EXECUTE` sólo a
  `authenticated` por firma exacta;
- no son ejecutables por `anon`/`PUBLIC`;
- normalizan inputs nuevamente dentro de PostgreSQL;
- retornan sólo campos necesarios y outcomes enumerados como texto estable, sin crear un enum nuevo;
- traducen conflictos conocidos a códigos/mensajes de dominio estables;
- no reciben ni retornan User/Auth/membership salvo el check interno D4.

### RPC 1 — Resolver identidad exacta

```text
admin_resolve_professional_by_document(
  p_center_id uuid,
  p_nationality_code text,
  p_document_number text
)
```

Retorno de una fila:

```text
resolution_status text
  NOT_FOUND | NOT_LINKED | LINKED_ACTIVE | LINKED_INACTIVE
professional_id uuid nullable
first_name text nullable
last_name text nullable
professional_center_id uuid nullable
professional_center_updated_at timestamptz nullable
```

Contrato de divulgación:

- la UI muestra únicamente `first_name`, `last_name` y `resolution_status` respecto del Center
  actual;
- `professional_id`, `professional_center_id` y `professional_center_updated_at` son soporte
  técnico opaco para el flujo ADMIN autorizado y nunca se presentan como información funcional;
- la RPC nunca retorna email, teléfono, documento almacenado, `normalized_document`, otros Centers,
  matrículas o especialidades de otros Centers, Users, Auth ni memberships;
- la búsqueda permanece exacta por nacionalidad + documento, ADMIN-only, center-scoped y
  fail-closed.

Comportamiento:

1. validar ADMIN y formato de nacionalidad;
2. canonicalizar documento con `private.normalize_document()`;
3. buscar coincidencia exacta por la UNIQUE global;
4. consultar únicamente si existe PC en `p_center_id`;
5. no revelar email, teléfono, documento almacenado, `normalized_document`, otros Centers,
   matrículas o especialidades de otros Centers, memberships, Auth ni Users;
6. no adquirir locks ni mutar;
7. devolver `NOT_FOUND` con campos nulos en lugar de revelar detalles por errores distintos.

### RPC 2 — Crear Professional nuevo + ProfessionalCenter

```text
admin_create_professional_with_center(
  p_center_id uuid,
  p_first_name text,
  p_last_name text,
  p_nationality_code text,
  p_document_number text,
  p_email text,
  p_phone text,
  p_license_number text,
  p_usual_appointment_duration_minutes integer
)
```

Retorno:

```text
professional_id uuid
professional_center_id uuid
professional_center_is_active boolean
professional_center_updated_at timestamptz
outcome text = CREATED
```

Reglas:

- trim de nombres; email normalizado con `lower(btrim(...))`; teléfono y matrícula vacíos → `NULL`;
- Zod valida email y PostgreSQL/RPC vuelve a validar explícitamente su formato y no vacío antes de
  insertar, de modo que una invocación directa por `authenticated` no pueda eludir el contrato;
- normalizar documento con la función DB existente;
- tomar advisory lock de identidad normalizada y luego advisory lock común del Center;
- reautorizar después de los locks;
- si la identidad ya existe, fallar `PROFESSIONAL_IDENTITY_ALREADY_EXISTS`; no vincular ni
  sobrescribir silenciosamente, incluso si apareció por carrera después de `NOT_FOUND`;
- insertar Professional y PC en una transacción;
- no crear asociaciones iniciales, User, Auth ni membership;
- la configuración de especialidades usa después la RPC batch, manteniendo una sola autoridad.

El split deliberado obliga a volver al flujo resolver → confirmar si otra transacción creó primero
la identidad.

### RPC 3 — Vincular, reutilizar o reactivar un Professional existente

```text
admin_link_professional_to_center(
  p_center_id uuid,
  p_professional_id uuid,
  p_nationality_code text,
  p_document_number text,
  p_expected_professional_center_updated_at timestamptz
)
```

`p_expected_professional_center_updated_at` es nullable: `NULL` representa el snapshot
`NOT_LINKED`; un PC inactivo exige el token retornado por resolución.

Retorno:

```text
professional_id uuid
professional_center_id uuid
professional_center_is_active boolean
professional_center_updated_at timestamptz
outcome text
  CREATED_LINK | REACTIVATED | REUSED_ACTIVE
```

Reglas:

- sólo se llama después de confirmación explícita del ADMIN;
- verificar que `professional_id` coincide exactamente con nacionalidad/documento normalizados;
- tomar lock de identidad, lock común del Center y luego `FOR UPDATE` del PC si existe;
- si no hay PC y el expected es `NULL`, crear uno con matrícula `NULL`, duración 30 y activo;
- si el PC está activo, reutilizarlo sin mutar Professional ni configuración y retornar
  `REUSED_ACTIVE`;
- si está inactivo, exigir CAS exacto y reactivar la misma fila;
- reactivar preserva matrícula, duración y todas las asociaciones;
- si apareció un PC inactivo después del snapshot `NOT_LINKED`, fallar stale antes de reactivarlo;
- nunca actualizar el Professional global.

### RPC 4 — Editar configuración de ProfessionalCenter

```text
admin_update_professional_center(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_updated_at timestamptz,
  p_license_number text,
  p_usual_appointment_duration_minutes integer
)
```

Retorno:

```text
professional_center_id uuid
license_number text nullable
usual_appointment_duration_minutes integer
is_active boolean
updated_at timestamptz
```

Tomar lock del Center, luego fila `FOR UPDATE`, comparar CAS null-safe y recién entonces actualizar.
No aceptar campos de Professional, `professional_id` ni `center_id` como mutables.

### RPC 5 — Activar/desactivar ProfessionalCenter

```text
admin_set_professional_center_active(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_updated_at timestamptz,
  p_is_active boolean
)
```

Reglas:

- Center lock → PC `FOR UPDATE` → CAS;
- si se pide desactivar, comprobar bajo el mismo lock que no exista
  `center_memberships.role = 'PROFESSIONAL' AND is_active` apuntando al PC;
- si existe, fallar `PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP` sin mutar;
- memberships inactivas no bloquean;
- activar/reutilizar no modifica memberships, configuración ni asociaciones;
- no-op exacto puede retornar el estado actual sin tocar `updated_at`; la UI no debe enviarlo como
  una edición.

El advisory lock común serializa esta regla con `admin_provision_center_user` y
`admin_set_center_membership`, que ya usan el mismo lock por Center.

### RPC 6 — Crear Specialty

```text
admin_create_specialty(
  p_center_id uuid,
  p_name text,
  p_description text
)
```

Retorna `specialty_id`, `name`, `description`, `is_active`, `updated_at`. Nombre se trimea;
descripción vacía → `NULL`; inicia activa. Capturar la colisión del índice único y devolver
`SPECIALTY_NAME_ALREADY_EXISTS`, que también cubre una fila inactiva reservando el nombre.

### RPC 7 — Editar Specialty

```text
admin_update_specialty(
  p_center_id uuid,
  p_specialty_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_description text
)
```

Center lock → Specialty `FOR UPDATE` → CAS. Permite editar activa o inactiva. La colisión de rename
usa el mismo error estable y no cambia asociaciones.

### RPC 8 — Activar/desactivar Specialty

```text
admin_set_specialty_active(
  p_center_id uuid,
  p_specialty_id uuid,
  p_expected_updated_at timestamptz,
  p_is_active boolean
)
```

Center lock → Specialty `FOR UPDATE` → CAS. Desactivar/activar sólo cambia Specialty; no toca
`professional_center_specialties`. La operatividad efectiva requiere Specialty, PC y asociación
activos.

### RPC 9 — Batch explícito ProfessionalCenter ↔ Specialty

```text
admin_update_professional_center_specialties(
  p_center_id uuid,
  p_professional_center_id uuid,
  p_expected_professional_center_updated_at timestamptz,
  p_activate_specialty_ids uuid[],
  p_deactivate_specialty_ids uuid[]
)
```

Retorno:

```text
professional_center_id uuid
professional_center_updated_at timestamptz
activated_count integer
deactivated_count integer
```

El contrato es **delta explícito**, no “reemplazar el conjunto completo”:

- ambas listas son requeridas, pueden ser vacías pero no contener NULL, duplicados ni intersección;
- ambas vacías fallan `NO_SPECIALTY_CHANGES`;
- Center lock → PC `FOR UPDATE` → CAS → Specialties ordenadas por UUID `FOR UPDATE`;
- activar exige PC activo y cada Specialty activa/same-center;
- activar inserta la fila faltante o cambia `is_active` a true;
- desactivar exige una asociación existente same-center y cambia `is_active` a false; nunca DELETE;
- desactivar se permite si PC o Specialty están inactivos, porque reduce configuración;
- una asociación con Specialty inactiva que no aparece en ninguno de los deltas permanece intacta;
- toda modificación efectiva toca `professional_centers.updated_at` en la misma transacción;
- el `updated_at` retornado reemplaza el token del aggregate en la UI;
- cualquier validación fallida revierte todo el batch.

La UI debe mostrar en una sección retenida las asociaciones existentes cuya Specialty esté inactiva,
con estado no operativo y una acción inequívoca **Desasociar**. No se incluyen implícitamente en
`p_deactivate_specialty_ids` al guardar otras opciones.

### Locks y orden global

Orden obligatorio para evitar deadlocks:

1. validación barata y autorización preliminar;
2. para create/link: advisory lock de identidad
   `salud-plus:professional-identity:<nationality>:<normalized-document>`;
3. advisory lock existente `salud-plus:center:<center-id>`;
4. reautorización bajo lock;
5. fila aggregate (`professional_centers` o `specialties`) `FOR UPDATE`;
6. filas hijas ordenadas por UUID cuando corresponda;
7. validación/CAS;
8. mutación y postcondiciones.

RPCs sin identidad global comienzan en el lock del Center. Ninguna nueva RPC toma primero una fila y
después el advisory lock. Las carreras con memberships quedan serializadas por el lock de Center ya
compartido con TASK-005.

### CAS con `updated_at`

- Comparar `current.updated_at IS DISTINCT FROM p_expected_updated_at` bajo row lock.
- Fallar antes de cualquier mutación con el error específico de la entidad.
- La UI no hace actualización optimista: consume el estado retornado y revalida desde servidor.
- El batch usa `professional_centers.updated_at` como token de todo el aggregate de configuración.
- Durante B se prueba que cada mutación real produce un token distinto y que una segunda escritura
  con el token anterior falla.
- Sólo si esa prueba demuestra una colisión real no evitable con el trigger/timestamp actual se
  escala al humano para considerar una columna `version`; no se agrega preventivamente.

### Semántica uniforme de no-op

- Si una operación válida no cambia ningún valor persistido, retorna el estado actual sin ejecutar
  un `UPDATE` artificial y sin avanzar `updated_at` ni el token CAS.
- RPC 4 y RPC 7 comparan primero los valores normalizados; si coinciden, retornan la fila actual.
- RPC 5 y RPC 8 hacen lo mismo cuando `is_active` ya tiene el valor solicitado.
- RPC 9 cuenta sólo transiciones efectivas. Una lista no vacía cuyos IDs ya están en el estado
  solicitado es un no-op válido: retorna conteos cero y conserva el token del PC. Ambas listas
  vacías continúan fallando `NO_SPECIALTY_CHANGES` porque no expresan intención.
- La validación, autorización, pertenencia, estado y CAS se ejecutan igualmente antes de resolver
  un no-op; no se usa esta semántica para aceptar IDs inválidos, cross-center o snapshots stale.
- Tests DB verifican que no-op y mutación efectiva se distingan en RPCs 4, 5, 7, 8 y 9.

### Errores estables

Las RPCs usan SQLSTATE coherentes y mensajes tokenizados; la aplicación mapea ambos y nunca muestra
texto SQL crudo.

| Token                                       | Situación                                               | SQLSTATE previsto |
| ------------------------------------------- | ------------------------------------------------------- | ----------------- |
| `CENTER_ADMINISTRATION_DENIED`              | actor no ADMIN activo / Center inactivo                 | `42501`           |
| `RESOURCE_NOT_FOUND`                        | ID inexistente, ajeno o cross-center                    | `P0002`           |
| `PROFESSIONAL_IDENTITY_ALREADY_EXISTS`      | create encontró identidad global                        | `P0001`           |
| `PROFESSIONAL_IDENTITY_MISMATCH`            | id no coincide con documento/nacionalidad confirmados   | `P0001`           |
| `STALE_PROFESSIONAL_CENTER_STATE`           | CAS PC falló                                            | `P0001`           |
| `PROFESSIONAL_CENTER_HAS_ACTIVE_MEMBERSHIP` | D4 bloquea desactivación                                | `P0001`           |
| `STALE_SPECIALTY_STATE`                     | CAS Specialty falló                                     | `P0001`           |
| `SPECIALTY_NAME_ALREADY_EXISTS`             | create/rename colisiona, activa o inactiva              | `P0001`           |
| `PROFESSIONAL_CENTER_NOT_ACTIVE`            | batch intenta activar sobre PC inactivo                 | `P0001`           |
| `SPECIALTY_NOT_ACTIVE`                      | batch intenta activar Specialty inactiva                | `P0001`           |
| `INVALID_SPECIALTY_BATCH`                   | arrays nulos, duplicados, intersectados o IDs inválidos | `22023`           |
| `NO_SPECIALTY_CHANGES`                      | batch sin intención                                     | `22023`           |

Errores inesperados producen un mensaje genérico y obligan a recargar/reconciliar. No se distingue
“existe en otro Center” de “no encontrado” para IDs manipulados.

### Verificación de TASK-006B

1. Migration transaccional nueva; no editar las 14 aplicadas.
2. Tests de catálogo exacto de policies/grants/firmas/`prosecdef`/`search_path`.
3. Tests de cada invariante y error estable.
4. Test directo de RPC 2 con email inválido y variantes con whitespace/case para probar validación
   y normalización PostgreSQL además de Zod.
5. Pruebas concurrentes deterministas con locks observados, sin sleeps como mecanismo de éxito.
6. Aplicación sólo a DEV después del gate de implementación.
7. Regenerar `database.types.ts` desde DEV y revisar exclusivamente el diff esperado.
8. Ejecutar schema/Auth/B3A/B3D y demás regresiones DB relevantes.
9. Review independiente Database/RLS y Security antes de iniciar C.

## TASK-006C — Specialties

### Alcance

1. Crear módulo `specialties` con schemas Zod para UUIDs, nombre, descripción, estado y CAS.
2. Query server-only que exige ADMIN y lista activas/inactivas del Center, ordenadas por nombre.
3. Server Actions delgadas para crear, editar y activar/desactivar mediante RPCs 6–8.
4. Ruta `/centers/[centerId]/specialties` con guard ADMIN server-side.
5. Tabla/cards con nombre, descripción, estado, `updated_at` interno y acciones explícitas.
6. Formularios accesibles, confirmación de estado, mensajes para nombre reservado y stale.
7. Revalidar la ruta después de éxito; sin estado optimista.
8. Agregar enlace ADMIN en navegación tenant sin exponerlo a otros roles.

### Verificación

- unit tests de normalización/validación y mapping de errores;
- component tests de vacío, lista, create/edit, active/inactive, confirmación, pending y stale;
- tests server-side de reautorización y FormData manipulado;
- integración RLS/RPC positiva y negativa, unicidad case-insensitive + trim e inactiva reservada;
- E2E focalizado de ciclo completo y acceso denegado;
- review funcional/UI/Security antes de D.

## TASK-006D — Professionals / ProfessionalCenter

### Alcance

1. Crear schemas de resolución, alta global, confirmación de vínculo, edición local, CAS y estado.
2. Query server-only ADMIN que lista PC activos/inactivos del Center y la identidad global visible
   por las policies existentes.
3. Implementar flujo staged:
   - nacionalidad + documento;
   - `NOT_FOUND` → formulario de datos globales + configuración local → RPC 2;
   - existente → nombre/apellido + estado local mínimo → confirmación explícita → RPC 3;
   - `LINKED_ACTIVE` → reutilizar/navegar a administrar;
   - `LINKED_INACTIVE` → confirmar reactivación preservando configuración.
4. No ofrecer controles de edición para ningún campo global después del alta.
5. Panel local para matrícula, duración y estado mediante RPCs 4–5.
6. Ante D4, mostrar enlace a `/centers/[centerId]/users` y no cambiar la membership.
7. Ruta `/centers/[centerId]/professionals`, estados vacío/error/loading y navegación ADMIN.
8. Refresh server-side después de éxito, sin optimismo.

### Verificación

- Professional global creado exactamente una vez y separado de Person/User/Auth;
- resolución exacta y retorno mínimo sin datos cross-center;
- confirmación requerida para link/reactivation;
- carrera NOT_FOUND→create obliga a resolver/confirmar, no auto-link;
- multi-Center reutiliza `professional_id` y crea un PC por Center;
- reactivación conserva matrícula, duración y asociaciones;
- campos globales no tienen action/RPC de actualización;
- duration, matrícula nullable, stale y D4 cubiertos;
- regresión de listado/alta/edición de `/users` con PCs activos/libres;
- review funcional/Security antes de E.

## TASK-006E — ProfessionalCenter ↔ Specialty

### Alcance

1. Extender la query de profesionales para cargar asociaciones activas/inactivas y Specialties del
   Center sin N+1 innecesario.
2. Presentar tres estados claros:
   - opciones activas asignables;
   - asociaciones activas operativas;
   - asociaciones retenidas pero no operativas porque Specialty o PC está inactivo.
3. Construir deltas explícitos `activate`/`deactivate`; nunca inferir desasociación por ausencia de
   una opción inactiva.
4. Acción **Desasociar** explícita para una asociación retenida; persiste `is_active=false`.
5. Ejecutar una sola RPC 9 por submit y reemplazar el token PC por el retornado.
6. Mostrar stale y exigir recarga/revisión; no mezclar silenciosamente configuraciones concurrentes.

### Verificación

- same-center y estados activos para asociación nueva;
- cross-center/IDs manipulados rechazados;
- Specialty inactiva no asignable y no operativa;
- desactivar Specialty conserva filas/flags de asociación;
- reactivar Specialty restaura disponibilidad de asociaciones conservadas;
- editar otra opción no toca asociaciones inactivas omitidas;
- desasociación explícita es la única que cambia a false;
- batch all-or-nothing, CAS aggregate y token PC actualizado;
- carreras batch/batch, batch/PC status y batch/Specialty status deterministas;
- review Database/UI antes de F.

## TASK-006F — Integration / E2E / Review

### Integración funcional

1. Consolidar navegación ADMIN: `Profesionales`, `Especialidades`, `Usuarios`.
2. Verificar enlaces de D4 hacia Usuarios y consumo de ProfessionalCenters elegibles por TASK-005.
3. Revisar que no aparezcan imports cruzados profundos ni lógica de producto en `src/app/`.
4. Actualizar sólo documentación permanente afectada:
   - `docs/modules/professionals.md`;
   - `docs/modules/specialties.md`;
   - `docs/modules/access.md` si D4/consumo lo requiere;
   - `docs/architecture.md` o `docs/technical-decisions.md` sólo si emerge una decisión transversal;
   - `docs/status.md` al completar/review pass, no como diario.

### E2E y smoke manual

E2E DEV mínimo:

1. ADMIN crea, edita, desactiva y reactiva Specialty; nombre inactivo continúa reservado.
2. ADMIN crea Professional nuevo y confirma que no cambian Auth/User/membership.
3. Segundo Center resuelve y vincula la misma identidad sin ver datos ajenos.
4. PC inactivo se reactiva preservando matrícula/duración/asociaciones.
5. PC con membership PROFESSIONAL activa no se puede desactivar; tras desactivar la membership en
   Usuarios sí puede hacerlo.
6. Asociación activa, Specialty inactiva, reactivación y desasociación explícita.
7. RECEPTION, PROFESSIONAL, membership inactiva, ADMIN de otro Center y PLATFORM_ADMIN-only quedan
   denegados.
8. Refresh y stale muestran estado persistido real.

Smoke manual posterior a suites:

- navegación y responsive básico de ambos listados;
- labels, foco, errores y confirmaciones;
- flujo staged completo nuevo/existente/inactivo;
- enlace seguro hacia Usuarios para D4;
- ninguna opción de editar identidad global;
- ninguna UI de Availability.

### Calidad y review final

1. Ejecutar format check, lint, typecheck, unit/component, build y secret guard.
2. Ejecutar suites schema/Auth/RLS/B3A/B3B/B3C/B3D relevantes.
3. Ejecutar tests DB TASK-006 y E2E focalizados con un worker contra DEV.
4. Auditar policies, grants, firmas y migration sync reales al final.
5. Comparar baseline DEV exacto antes/después.
6. Crear `implementation-report.md` sólo al finalizar implementación/verificación.
7. Review independiente Database/RLS, Security, UI/funcional y E2E.
8. Corregir findings, repetir verificación y no cerrar sin PASS.
9. Sólo después actualizar status, crear retrospectiva y archivar según Harness.

## Estrategia de testing transversal

### Unit y component

- schemas Zod, normalizaciones no secretas y nullables;
- validación/normalización PostgreSQL de email ante invocación RPC directa;
- state machines del staged flow;
- mapping exhaustivo de outcomes/errores estables;
- componentes desde comportamiento del usuario, no detalles internos;
- navegación por rol, estados loading/empty/error/pending/success/stale;
- invariantes visuales D1–D8.

### DB invariants

- UNIQUE profesional normalizado global y PC por Center;
- duración 5–480/múltiplo 5;
- Specialty unique por Center ignorando case/trim y reservada inactiva;
- FKs same-center de asociaciones;
- máximo una membership PROFESSIONAL activa por PC;
- bloqueo D4 en RPC bajo concurrencia;
- inmutabilidad global por ausencia de grants/RPCs de update y DML directo denegado;
- asociaciones preservadas al cambiar estado de Specialty/PC.

### RLS/grants

- conjunto exacto de policies y grants, no sólo presencia de los nuevos;
- `anon`/PUBLIC deny;
- DML directo deny para authenticated;
- EXECUTE sólo en firmas aprobadas;
- ADMIN A sólo Center A;
- RECEPTION/PROFESSIONAL/PLATFORM_ADMIN-only sin nuevas lecturas;
- lecturas previas de TASK-005 siguen pasando.

### Concurrencia

Usar dos conexiones reales, barreras/advisory locks observables y watchdog sólo para fallar/limpiar:

- create/create de misma identidad en distintos Centers;
- create/link después de snapshot NOT_FOUND;
- link/link en mismo Center;
- edit/edit PC con mismo token;
- deactivate PC vs activar/asignar membership PROFESSIONAL;
- specialty create/rename equivalentes;
- specialty state vs batch;
- batch/batch con mismo token;
- batch vs update/status PC.

En cada carrera se afirma estado final, ganador/perdedor, error estable y ausencia de efectos
parciales.

### Ownership y cleanup DEV

Reutilizar y endurecer las lecciones de TASK-005:

1. capturar baseline completo antes de fixtures;
2. generar `runId` y UUIDs explícitos para cada Auth/User/Center/membership/Professional/PC/Specialty;
3. registrar ownership de cada fila al crearla; no inferirlo por email, nombre, prefijo o `LIKE`;
4. cleanup en orden FK inverso y exclusivamente por IDs poseídos;
5. no borrar nunca Center/User/PLATFORM_ADMIN/operations persistentes del baseline;
6. si setup queda parcial, limpiar sólo IDs confirmados como propios;
7. si ownership o baseline es ambiguo, fallar y preservar datos en vez de hacer cleanup amplio;
8. ejecutar cleanup en `finally`, verificar cero fixtures propias y comparar baseline exacto;
9. no usar reset, seed global ni truncate;
10. documentar cualquier residuo sin intentar “arreglarlo” destructivamente.

Los tests SQL que puedan ejecutarse dentro de una transacción usan rollback. Los escenarios HTTP,
Auth y concurrencia que requieran commit usan ownership exacto y cleanup externo fail-closed.

## Archivos previstos durante implementación

- una o más migrations incrementales nuevas bajo `supabase/migrations/`, sólo si plan review pasa;
- suite SQL TASK-006 y runner de integración/concurrencia bajo `supabase/tests/` y `scripts/`;
- tipos generados `src/lib/supabase/database.types.ts`;
- módulos `src/modules/professionals/` y `src/modules/specialties/`;
- rutas tenant y navegación ADMIN;
- tests junto al código y E2E en `tests/e2e/`;
- documentación permanente y artefactos Harness sólo en sus fases correspondientes.

No se editarán migrations ya aplicadas ni se crearán capas vacías.

## Decisiones restantes

No quedan decisiones humanas bloqueantes conocidas. El plan fija estas interpretaciones técnicas del
contrato aprobado:

- “desasociar” es inactivación explícita de la fila, no DELETE físico;
- create y link son RPCs separadas para preservar la confirmación explícita ante carreras;
- link nuevo usa defaults PC (`license_number = NULL`, duración 30) y luego permite edición local;
- el batch usa deltas explícitos, no reemplazo total;
- no se agrega `version` salvo evidencia reproducible de insuficiencia de `updated_at`;
- los no-op válidos conservan `updated_at`/token CAS y el batch cuenta sólo cambios efectivos.

Si el plan review rechaza alguna de estas interpretaciones, se actualizan brief/plan antes de
implementar. Hallar drift real de schema/DEV o insuficiencia concreta de CAS también reabre el gate.

## Gates

- `TASK-006 ANALYZE COMPLETE` — completado.
- `TASK-006 DESIGN APPROVED D1–D8` — completado.
- `TASK-006 PLAN COMPLETE` — completado.
- `TASK-006 PLAN REVIEW PASS` — completado.
- `TASK-006B READY_FOR_IMPLEMENTATION` — completado; implementación no iniciada.
- `TASK-006B REVIEW PASS` — pendiente.
- `TASK-006C REVIEW PASS` — pendiente.
- `TASK-006D REVIEW PASS` — pendiente.
- `TASK-006E REVIEW PASS` — pendiente.
- `TASK-006F INTEGRATION REVIEW PASS` — pendiente.
- `TASK-006 COMPLETED` — pendiente.

No hacer commit, push, PR, merge ni mutar DEV/PROD en esta instancia.

**TASK-006 PLAN REVIEW PASS — READY FOR IMPLEMENTATION**
