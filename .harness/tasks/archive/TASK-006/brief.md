# TASK-006 — Profesionales y especialidades

**Estado:** `TASK-006 COMPLETED` · `TASK-006 FINAL REVIEW PASS` · `PR #6 MERGED`

**Squash commit:** `c127d3b81f73aba5c47d9ecf462529c73df79fcb`

## Objetivo

Habilitar, después del gate de diseño y de una instrucción explícita de implementación, la
administración tenant de:

- `Specialty`;
- `Professional`;
- `ProfessionalCenter`;
- `ProfessionalCenterSpecialty`.

La autoridad operativa será una membership `ADMIN` activa del Center activo de la ruta. El permiso
global `PLATFORM_ADMIN` no concede acceso al módulo y los roles `PROFESSIONAL` y `RECEPTION` no
administran el catálogo.

Esta instancia completa **PLAN** y actualiza el Task Brief aprobado. No autoriza implementación,
migrations, cambios en Supabase DEV, commit, push ni PR.

## Gate actual

Las decisiones D1–D8 fueron aprobadas por el humano y se incorporan como contrato vinculante en
este brief. El plan review independiente cerró sus hallazgos y emitió PASS después de incorporar la
aclaración aprobada de D2, validación/normalización PostgreSQL del email y semántica uniforme de
no-op. TASK-006 queda **READY_FOR_IMPLEMENTATION**, pero la instrucción humana actual prohíbe iniciar
implementación: no se autoriza código funcional, migrations, mutaciones DEV/PROD, commit, push ni PR.

## Baseline verificado

- Fecha del análisis: 2026-09-29.
- Branch base verificada: `main`.
- `HEAD == origin/main == 4760c77360fdadea6e0f2cfdc143da23cbba4e1a`.
- Branch de task creada desde esa base exacta: `task/006-professionals-specialties`.
- TASK-005 está cerrada y archivada; inicialmente no había tasks activas.
- `pnpm bootstrap`: PASS con Node 24.21.0, pnpm 11.26.0 y configuración DEV coherente/linkeada.
- Las 14 migrations SQL locales figuran sincronizadas con las 14 versiones remotas mediante
  `supabase migration list --linked`.
- No se consultaron ni mutaron filas de dominio en DEV y no se aplicó ninguna migration.
- El único cambio previo ajeno continúa siendo `M next-env.d.ts`.
- Hash SHA-256 observado de `next-env.d.ts` durante el análisis:
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- PROD permanece fuera de alcance.

## Contexto inspeccionado

- `AGENTS.md`, `.harness/README.md`, `docs/product.md`, `docs/status.md` y convenciones.
- Reglas de negocio, arquitectura, workflow DB y decisiones de autorización, testing, módulos,
  Server Actions y migrations/tipos.
- Documentación de `professionals`, `specialties`, `access` y `centers`.
- Briefs y diseño relevante de TASK-004 y TASK-005/B3.
- Las 14 migrations actuales, con foco en schema inicial, RLS/grants de TASK-005 y la invariante de
  membership PROFESSIONAL de B3A/B3D.
- `src/lib/supabase/database.types.ts` generado desde el schema real.
- Helpers server-side de autorización, queries/actions de Access, rutas tenant y navegación actual.
- Tests SQL, integración y E2E existentes relevantes para RLS, grants, concurrencia y cleanup DEV.

## Estado actual relevante

### Schema reutilizable tal cual

| Entidad / regla                                 | Soporte actual                                                                                                                 | Evaluación                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `professionals` separado de `users` y `persons` | Tabla global independiente, sin FK a Auth/User                                                                                 | Sirve tal cual                                           |
| Datos requeridos de Professional                | nombre, apellido, nacionalidad, documento y email `NOT NULL`; teléfono nullable                                                | Sirve tal cual                                           |
| Deduplicación Professional                      | `UNIQUE (nationality_code, normalized_document)`                                                                               | Sirve tal cual                                           |
| Normalización documental                        | columna generated mediante `private.normalize_document()`; trim, uppercase y remoción de espacios, puntos y variantes de guion | Sirve tal cual                                           |
| Nacionalidad                                    | check ISO alpha-2 uppercase                                                                                                    | Sirve tal cual                                           |
| Relación Professional-Center                    | `professional_centers`, `UNIQUE (center_id, professional_id)`                                                                  | Sirve tal cual                                           |
| Matrícula por Center                            | `professional_centers.license_number`, nullable y no única                                                                     | Sirve tal cual                                           |
| Duración habitual                               | default 30, rango 5–480, múltiplo de 5                                                                                         | Sirve tal cual                                           |
| Actividad por Center                            | `professional_centers.is_active`                                                                                               | Sirve tal cual                                           |
| Specialty por Center                            | `specialties.center_id` + `is_active`                                                                                          | Sirve tal cual                                           |
| Nombre Specialty reservado                      | índice único `(center_id, lower(btrim(name)))`, sin filtrar por `is_active`                                                    | Sirve tal cual                                           |
| Asociación PC-Specialty                         | PK `(professional_center_id, specialty_id)` + `is_active`                                                                      | Sirve tal cual                                           |
| Asociación same-center                          | FKs compuestas de la asociación hacia `(id, center_id)` de ambas entidades                                                     | Sirve tal cual                                           |
| Historia sin hard delete                        | FKs `RESTRICT`, flags `is_active` y timestamps                                                                                 | Sirve tal cual                                           |
| Membership PROFESSIONAL                         | FK compuesta same-center y check rol/vínculo                                                                                   | Sirve tal cual                                           |
| Máximo una cuenta activa por PC                 | índice UNIQUE parcial para membership `PROFESSIONAL` activa                                                                    | Sirve tal cual                                           |
| Concurrencia de memberships                     | RPC CAS actual y advisory lock común por Center                                                                                | Reutilizable; debe coordinarse con las nuevas mutaciones |

Los tipos generados reflejan las cuatro tablas, nulabilidad, defaults de insert y relaciones
compuestas anteriores. No hay drift visible entre migrations versionadas y tipos.

### RLS, grants y APIs actuales

- Las cuatro tablas tienen RLS habilitada.
- `professionals` y `professional_centers` tienen policy `SELECT` para ADMIN del Center y para el
  PROFESSIONAL vinculado a su propio contexto. `authenticated` posee `SELECT` sobre ambas.
- `specialties` y `professional_center_specialties` no tienen policies permisivas ni grants para
  `authenticated`: hoy permanecen default-deny.
- No existen grants genéricos `INSERT`, `UPDATE` o `DELETE` para `authenticated` sobre tablas de
  dominio.
- No existen RPCs tenant para crear, editar o activar/desactivar Professional,
  ProfessionalCenter, Specialty o su asociación.
- `private.has_active_center_role(center_id, roles)` ya expresa la autoridad ADMIN tenant,
  incluyendo Center activo y membership activa.
- `requireRole(centerId, ["ADMIN"])` sirve sin cambios como guard server-side de páginas, queries y
  Server Actions.
- `PLATFORM_ADMIN` sigue separado: los helpers RLS/RPC tenant no deben consultarlo como bypass.

### Rutas y navegación actuales

- `/centers/[centerId]` resuelve sesión, Center activo y membership activa.
- `/centers/[centerId]/users` es el único módulo administrativo tenant actual y exige `ADMIN` en
  página, queries y mutaciones.
- `CenterAdminNavigation` sólo muestra `Usuarios` a ADMIN.
- El patrón existente mantiene `src/app/` delgado y concentra UI, schemas, queries y acciones en el
  módulo de dominio.

## Gaps reales detectados

### Gap de acceso y API de base de datos

Aunque no falta ninguna tabla ni columna para el alcance preliminar, TASK-006 no puede implementarse
de forma segura sólo con la API actual:

1. faltan policies/grants `SELECT` para que un ADMIN pueda leer Specialty y asociaciones de su
   Center;
2. faltan RPCs estrechas para mutaciones tenant;
3. faltan reglas transaccionales para deduplicar/crear o reutilizar un Professional y crear o
   reactivar su ProfessionalCenter sin carreras;
4. faltan checks de estado para activar asociaciones sólo entre PC y Specialty activos del mismo
   Center;
5. falta una decisión y enforcement sobre desactivar un PC que tenga una membership PROFESSIONAL
   activa;
6. faltan compare-and-swap o snapshots esperados para impedir lost updates en ediciones
   concurrentes.

Esto probablemente requiere una migration incremental de **seguridad/API** (policies, grants y
funciones), pero no se detectó todavía una necesidad aprobada de cambiar tablas o columnas. La
migration no debe crearse hasta cerrar el diseño.

### Gap de dominio: identidad global editable

`Professional` es global y puede estar vinculado a múltiples Centers. Cambiar nombre, apellido,
nacionalidad, documento, email o teléfono desde un Center cambia el registro que ven todos los
Centers vinculados. El schema actual no modela ownership, fuente de verdad, aprobación, auditoría ni
overrides por Center. Por lo tanto, “editar profesional” no puede interpretarse de forma segura sin
una decisión explícita; no es un detalle de UI.

### Higiene de datos resoluble sin cambio estructural

- `license_number`, `description` y `phone` permiten técnicamente whitespace. La capa Zod/RPC puede
  aplicar trim y convertir vacío a `NULL`; no hace falta asumir una migration de columnas.
- `email` de Professional no es una identidad Auth ni criterio de deduplicación. Debe validarse y
  normalizarse de forma consistente tanto en Zod como dentro de PostgreSQL/RPC, de modo que una
  invocación directa no pueda insertar una identidad global con email inválido. No debe usarse para
  fusionar profesionales.
- El índice de Specialty ya implementa la unicidad aprobada e incluye filas inactivas.

## Propuesta funcional inicial

### Autorización

| Actor                                       | Listar/administrar Professionals | Listar/administrar Specialties | Leer catálogo en TASK-006                                        |
| ------------------------------------------- | -------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| ADMIN tenant activo del mismo Center activo | Sí                               | Sí                             | Sólo su Center                                                   |
| RECEPTION                                   | No                               | No                             | No se abre lectura nueva                                         |
| PROFESSIONAL                                | No                               | No                             | Conserva sólo las lecturas propias actuales; no se abre catálogo |
| PLATFORM_ADMIN sin ADMIN tenant             | No                               | No                             | No                                                               |
| PLATFORM_ADMIN + ADMIN tenant               | Sí, por la membership ADMIN      | Sí, por la membership ADMIN    | Sólo su Center                                                   |

No existe una necesidad funcional actual para ampliar lecturas a RECEPTION o PROFESSIONAL. Las
lecturas que agenda/appointments puedan requerir se diseñarán con esos módulos, no por conveniencia
en TASK-006.

### Rutas y navegación

- `/centers/[centerId]/professionals`: listado de ProfessionalCenter activos e inactivos del Center,
  identidad mínima del Professional, matrícula, duración habitual, especialidades y estado.
- `/centers/[centerId]/specialties`: listado de especialidades activas e inactivas, creación,
  edición y activación/desactivación.
- Ambas rutas, sus queries y cada Server Action usan `requireRole(centerId, ["ADMIN"])`.
- `CenterAdminNavigation` agrega enlaces `Profesionales`, `Especialidades` y conserva `Usuarios` sólo
  para ADMIN.
- La primera versión puede resolver alta/edición en paneles dentro de los listados; no se necesita
  una ruta de detalle hasta que la complejidad real lo justifique.
- No se agrega UI, ruta ni lógica de Availability.

### Especialidades

- Crear con nombre requerido, trim en servidor, descripción opcional normalizada a `NULL` e inicio
  activo.
- Editar nombre y descripción con snapshot `updated_at` esperado.
- Activar/desactivar de forma lógica; no ofrecer DELETE.
- Mapear el índice único case-insensitive + trim a un error de dominio claro, incluida la colisión
  con una especialidad inactiva.
- Si el nombre ya existe inactivo, la UX debe dirigir a reactivarlo en vez de crear otra fila.
- Al asignar a un PC, Specialty y PC deben pertenecer al Center autorizado y estar activos. Quitar
  una asignación debe seguir permitido como reducción aun si alguna entidad quedó inactiva.

### Alta y vinculación de Professional

Flujo aprobado:

1. ADMIN ingresa `nationality_code` + documento exacto y datos requeridos.
2. El servidor normaliza el documento con la misma autoridad que PostgreSQL; la DB conserva la
   autoridad final mediante la columna generated y el UNIQUE.
3. Una RPC estrecha y transaccional toma el lock del Center y resuelve la identidad exacta:
   - si no existe, crea `professionals` y `professional_centers`;
   - si existe en otro Center, reutiliza el mismo `professional_id` y crea sólo el nuevo
     `professional_centers` después de confirmación explícita;
   - si ya existe PC activo en el Center, no duplica y devuelve estado existente;
   - si existe PC inactivo en el Center, reutiliza la misma fila mediante un flujo explícito de
     reactivación, sin insertar otra.
4. El alta nueva configura matrícula y duración; el vínculo nuevo usa los defaults del PC. Las
   especialidades se guardan después mediante el único batch transaccional aprobado.
5. No crea `auth.users`, `public.users` ni `center_memberships`.

No se debe hacer un `SELECT` global abierto de profesionales. Una eventual resolución previa debe
ser exacta por nacionalidad + documento, ejecutada sólo por ADMIN ya autorizado y retornar la
información mínima aprobada para confirmar el vínculo. La UI muestra únicamente nombre, apellido y
estado respecto del Center actual. El flujo autorizado puede transportar como soporte técnico
opaco `professional_id`, `professional_center_id` cuando exista y `updated_at`/token CAS requerido;
estos valores no se muestran al ADMIN ni amplían la información funcional divulgada.

### Edición de ProfessionalCenter

- Matrícula opcional: trim y vacío → `NULL`.
- Duración habitual: integer, default 30, mínimo 5, máximo 480 y múltiplo de 5, validada por Zod y
  DB.
- Estado: activación/desactivación lógica con confirmación explícita.
- No se cambia `professional_id` ni `center_id` de una relación existente.
- Cada edición usa `expected_updated_at` bajo row lock/advisory lock para detectar estado stale.

### ProfessionalCenter ↔ Specialty

- UI de selección múltiple o checklist dentro de la administración del PC.
- Mutación batch atómica: o se confirma el conjunto completo o no se cambia nada.
- Se reutiliza una fila existente cambiando `is_active`; no se duplica ni se borra físicamente.
- Activar exige PC y Specialty activos y same-center; desactivar se permite aunque alguno esté
  inactivo.
- La RPC debe validar todos los IDs en servidor y no confiar en opciones renderizadas por la UI.
- El conjunto esperado o `updated_at` de las asociaciones debe participar en detección stale para
  evitar que dos ADMIN se sobreescriban silenciosamente.

### Interacción con memberships PROFESSIONAL

- Crear un Professional/ProfessionalCenter no crea User ni membership.
- La asociación con una cuenta se mantiene en `/users` mediante los flujos existentes.
- Reactivar un PC no debe reactivar automáticamente una membership: son conceptos separados.
- `admin_provision_center_user` y `admin_set_center_membership` ya exigen un PC activo y libre para
  crear/reactivar/cambiar una membership PROFESSIONAL.
- El nuevo flujo debe compartir el advisory lock por Center con las RPCs de memberships, de modo que
  actividad del PC y asignación de cuenta se serialicen de forma compatible.
- Al **desactivar** un PC, la RPC bloquea si encuentra una membership PROFESSIONAL activa apuntando
  a él. No modifica memberships como efecto lateral.

## RLS, grants y RPCs propuestos

Diseño aprobado, pendiente de plan review antes de implementación:

1. Agregar `SELECT` para `authenticated` sobre `specialties` y
   `professional_center_specialties`.
2. Agregar policies `SELECT` limitadas a `private.has_active_center_role(center_id,
ARRAY['ADMIN'])`; no ampliar por PLATFORM_ADMIN, RECEPTION ni PROFESSIONAL.
3. Conservar todas las tablas sin grants DML genéricos para `authenticated` y `anon`.
4. Exponer mutaciones mediante RPCs `SECURITY DEFINER` estrechas, con `search_path = ''`, nombres
   calificados, `REVOKE ALL` y `EXECUTE` sólo para `authenticated`.
5. Cada RPC revalida `auth.uid()`, ADMIN activo, Center activo, pertenencia same-center, estado,
   snapshot esperado y postcondiciones.
6. Separar al menos las responsabilidades de:
   - crear/reutilizar identidad y vincular ProfessionalCenter;
   - editar los campos locales de ProfessionalCenter;
   - activar/desactivar ProfessionalCenter;
   - crear/editar/activar Specialty;
   - reemplazar atómicamente las especialidades del ProfessionalCenter.
7. La edición de campos globales de Professional depende de D1–D3 y puede requerir una RPC separada
   o quedar fuera de esta iteración.

Los nombres, firmas y cantidad final de RPCs pertenecen al DESIGN/PLAN posterior; el brief fija sus
límites de seguridad, no una API prematura.

## Riesgos de concurrencia

- Dos Centers crean simultáneamente el mismo Professional normalizado: el UNIQUE global decide un
  ganador; el perdedor debe releer y pedir/requerir confirmación para vincular, nunca sobreescribir.
- Dos ADMIN del mismo Center vinculan el mismo Professional: `UNIQUE (center_id, professional_id)`
  y el lock del Center impiden duplicado; se retorna estado idempotente o conflicto claro.
- Creación/renombre concurrente de Specialty equivalente: el índice único es la autoridad final.
- Ediciones simultáneas de PC, Specialty o asociaciones: CAS con `expected_updated_at`/snapshot y row
  locks; no last-write-wins silencioso.
- Desactivar PC mientras otra transacción asigna una membership PROFESSIONAL: lock común por Center
  y regla D4 atómica.
- Activar una asociación mientras se desactiva PC o Specialty: lock/validación transaccional y
  postcondición de estado.
- Batch de especialidades parcial: una sola transacción, sin loops de Server Actions independientes.
- Los mensajes de conflicto deben ser de dominio y no filtrar datos de otros Centers.

## Estrategia de testing

### Unitarios y componentes

- Zod: campos requeridos, ISO alpha-2, email, documento, trim/nullables y duración 5–480/múltiplo 5.
- Mapeo de filas a modelos de pantalla y estados activo/inactivo.
- Listados, vacío, error, formularios, confirmaciones y mensajes de conflicto/stale.
- Navegación visible sólo para ADMIN, sin considerarla una barrera de seguridad.
- Server Actions reautorizan y validan FormData manipulado.

### Integración DB/RLS/grants

- `anon`, sin sesión, sin membership, membership inactiva y Center inactivo: deny.
- ADMIN A lee/muta sólo A; ADMIN B no accede a A.
- RECEPTION, PROFESSIONAL y PLATFORM_ADMIN-only no administran ni reciben las nuevas lecturas.
- DML directo permanece denegado; sólo las firmas RPC aprobadas tienen `EXECUTE`.
- Dedupe por documento con espacios, puntos, guiones y case; Person sigue independiente.
- Professional existente se vincula a otro Center sin duplicar ni modificar automáticamente la
  identidad global.
- Carrera de alta global y carrera same-center deterministas, observando locks reales.
- Specialty case-insensitive + trim, nombre inactivo reservado, rename collision y carrera.
- PC duration/checks, reactivación de fila existente y regla D4.
- Asociación cross-center rechazada; activación con entidades inactivas rechazada; desactivación
  reductiva permitida; batch atómico y stale detectado.
- Regresiones de `admin_provision_center_user`, `admin_set_center_membership`, último ADMIN y máximo
  una membership PROFESSIONAL activa.

### E2E DEV futuro

- ADMIN crea/edita/inactiva/reactiva Specialty.
- ADMIN crea Professional sin User, configura PC y especialidades, y lo lista.
- Reutilización multi-Center según el diseño aprobado.
- RECEPTION, PROFESSIONAL, ADMIN ajeno y PLATFORM_ADMIN-only reciben deny/not-found seguro.
- La pantalla `/users` consume los nuevos PCs elegibles sin regresiones.
- Fixtures con UUIDs exactos, baseline persistente capturado y cleanup exacto en `finally`; nunca
  borrar datos persistentes ni usar prefijos amplios.

No se ejecutan estos tests ni se crean fixtures durante PLAN.

## Propuesta de subfases

1. **TASK-006B — Foundation DB/API**
   - migration incremental únicamente si el diseño la confirma;
   - policies/grants/RPCs estrechas, concurrencia y suites SQL;
   - regeneración/verificación de tipos desde DEV después de autorización.
2. **TASK-006C — Especialidades**
   - módulo, ruta, navegación, queries, Server Actions, UI y tests focalizados.
3. **TASK-006D — Profesionales y ProfessionalCenter**
   - resolución/alta/vinculación, edición local, actividad y tests de dedupe/multi-Center.
4. **TASK-006E — Asignación de especialidades**
   - edición batch atómica PC-Specialty y regresiones de estado/concurrencia.
5. **TASK-006F — Integración y cierre**
   - E2E DEV, regresiones Access, verificación Security/Database/UI, documentación permanente,
     review final y sólo después cierre/retrospectiva.

Los checkpoints pueden mantenerse dentro de TASK-006 o recibir briefs hijos si la implementación
resulta suficientemente grande; esa decisión corresponde al PLAN aprobado.

## Decisiones de diseño aprobadas

### D1 — Professional global inmutable

Después del alta, TASK-006 no permite modificar `first_name`, `last_name`, `nationality_code`,
`document_number`/`normalized_document`, `email` ni `phone`, aunque el Professional esté vinculado a
un solo Center. No hay overrides por Center ni editabilidad temporal. Una futura corrección global
explícita queda fuera. Sólo se administran campos de `ProfessionalCenter`.

### D2 — Resolución exacta y divulgación mínima

La resolución usa exclusivamente `nationality_code + document_number` y la normalización canónica
de PostgreSQL. Sólo un ADMIN tenant ya autorizado puede ejecutarla. Si existe, retorna únicamente
como información visible `first_name`, `last_name` y el estado respecto del Center actual: no
vinculado, vinculado activo o vinculado inactivo. El flujo autorizado puede recibir como datos
técnicos opacos `professional_id`, `professional_center_id` cuando exista y `updated_at`/token CAS
requerido para vincular, reutilizar o reactivar de forma segura. Estos IDs/tokens no se muestran al
ADMIN ni amplían la información funcional divulgada.

La RPC nunca retorna email, teléfono, documento almacenado, `normalized_document`, otros Centers,
matrículas o especialidades de otros Centers, Users, Auth ni memberships. La búsqueda permanece
exacta por nacionalidad + documento, ADMIN-only, center-scoped y fail-closed. La coincidencia nunca
vincula automáticamente: exige confirmación explícita **Vincular profesional al centro**.

### D3 — Clave documental inmutable

`nationality_code` y documento permanecen inmutables después del alta y continúan siendo la clave
de deduplicación. TASK-006 no implementa corrección documental.

### D4 — Desactivación bloqueada por membership activa

Si una `center_membership` `PROFESSIONAL` activa apunta al ProfessionalCenter, la desactivación se
bloquea en PostgreSQL/RPC. No se desactiva la membership como efecto lateral. Una membership
inactiva no bloquea. El ADMIN debe administrar primero el acceso desde `/users`. Reactivar el PC no
reactiva memberships.

### D5 — Specialty inactiva conserva asociaciones

Desactivar Specialty no elimina ni desactiva automáticamente asociaciones existentes. Mientras
esté inactiva no admite asociaciones nuevas y no es operativa. Al reactivarse, las asociaciones
conservadas vuelven a estar disponibles. La UI y la mutación batch distinguen omisión de intención
explícita de desasociar; una opción inactiva no visible entre las opciones activas nunca se elimina
accidentalmente.

### D6 — ProfessionalCenter único y reutilizable

La combinación Professional + Center conserva una sola fila. Si está activa se reutiliza; si está
inactiva se reactiva la misma fila. La reactivación preserva por defecto matrícula, duración y
asociaciones, y nunca modifica el Professional global ni crea/reactiva User o membership.

### D7 — Autorización ADMIN-only

Sólo ADMIN tenant activo administra Specialties, Professionals del Center, ProfessionalCenter y sus
asociaciones. TASK-006 no agrega permisos a RECEPTION, PROFESSIONAL ni PLATFORM_ADMIN-only y tampoco
elimina las lecturas mínimas existentes de TASK-005.

### D8 — CAS y versión del aggregate

Las mutaciones de entidades existentes reciben `expected_updated_at`, adquieren lock, releen y
comparan antes de mutar; un snapshot stale falla con error estable. El batch PC-Specialty es
transaccional y toca `professional_centers.updated_at` en la misma transacción, por lo que el PC es
el token de versión del aggregate tenant. No se agrega columna `version` sin evidencia concreta en
PLAN/implementación de que `updated_at` sea insuficiente.

Una operación válida que no produce ningún cambio efectivo retorna el estado actual sin avanzar
artificialmente `updated_at` ni el token CAS. Esta semántica aplica de forma uniforme a edición,
activación/desactivación y deltas de asociaciones; las pruebas distinguen intención no vacía de
mutación efectiva.

## Criterios de aceptación preliminares

- [ ] Sólo ADMIN activo del Center activo lista y administra el módulo.
- [ ] PLATFORM_ADMIN-only, RECEPTION, PROFESSIONAL, actor inactivo y actor cross-center quedan
      denegados server-side y por DB.
- [ ] Crear Professional no crea Auth User, `public.users` ni membership.
- [ ] Dedupe usa exclusivamente nacionalidad + documento normalizado bajo autoridad DB.
- [ ] Professional existente puede vincularse a otro Center sin duplicarse ni sobrescribirse.
- [ ] PC existente en el mismo Center se reutiliza/reactiva, no se duplica.
- [ ] Matrícula opcional y duración habitual cumplen el contrato aprobado.
- [ ] Specialty es única por Center con case-insensitive + trim, incluso inactiva.
- [ ] No hay hard delete; actividad e historia se preservan.
- [ ] Asociación PC-Specialty siempre es same-center y su mutación batch es atómica.
- [ ] No hay lost updates silenciosos ni dos identidades/relaciones creadas por carrera.
- [ ] Memberships PROFESSIONAL mantienen la invariante B3A y la política D4 aprobada.
- [ ] No se introducen Availability, agenda, appointments, patients ni datos PROD.
- [ ] Suites unitarias, componentes, SQL/RLS/concurrencia, E2E y regresiones relevantes pasan.
- [ ] Review independiente Database/RLS, Security y funcional emite PASS antes del cierre.

Los checks permanecen abiertos porque no hubo implementación ni verificación funcional en esta
fase.

## Impactos

- **Database:** medio/alto — no se prevén tablas nuevas, pero sí una probable migration de
  policies/grants/RPCs e invariantes transaccionales.
- **Security/Authorization:** alto — identidad global multi-Center, aislamiento tenant y API
  `SECURITY DEFINER`.
- **Application:** alto — dos módulos/rutas administrativas y coordinación con Access.
- **UI:** medio/alto — listados, formularios, estados, conflictos y confirmaciones.
- **Testing:** alto — RLS, grants, dedupe, multi-Center, membership y concurrencia real.
- **Documentation:** medio — modules professionals/specialties/access, architecture/status y
  decisiones según el diseño aprobado.
- **Production:** fuera de alcance.

## Riesgos técnicos y de seguridad

- Efecto cross-tenant al editar una identidad Professional global.
- Enumeración o filtración de profesionales de otros Centers mediante búsqueda amplia o errores.
- Confundir Professional con User y crear acceso/Auth implícito.
- Confiar en IDs, opciones UI o `PLATFORM_ADMIN` como autorización tenant.
- Abrir DML genérico o policies demasiado amplias para simplificar formularios.
- Carrera de deduplicación global o reactivación same-center.
- Membership activa vinculada a un PC inactivo.
- Asignaciones efectivamente inválidas por estados inconsistentes.
- Lost updates entre dos ADMIN.
- Cleanup E2E que afecte el baseline persistente de DEV.
- Introducir Availability por proximidad del modelo.

## Fuera de alcance

- Availability, disponibilidad semanal, vacaciones y excepciones.
- Agenda, appointments y public booking.
- Patients, Person/PatientCenter e historia clínica.
- Reminders, billing y reportes avanzados.
- Crear o modificar Auth users, `public.users` o memberships como efecto del alta profesional.
- Gestión de PLATFORM_ADMIN.
- Hard delete de Professional, PC, Specialty o asociaciones.
- PROD, migrations PROD, seeds permanentes, reset, commit, push, PR o merge.

## Archivos de esta fase

- Creado: `.harness/tasks/active/TASK-006/brief.md`.
- Creado: `.harness/tasks/active/TASK-006/plan.md`.
- No se crean `implementation-report.md`, `review.md` ni `retrospective.md` en PLAN.
- No se modifica documentación permanente hasta la implementación aprobada.

## Estimación inicial

**Complejidad: alta. Estimación: 7–11 jornadas de ingeniería**, incluyendo review del plan,
foundation transaccional, dos verticales UI, asignaciones, pruebas de concurrencia, E2E DEV y cierre
documental. No incluye una futura corrección de identidad global ni overrides por Center.

## Condición de salida de PLAN

ANALYZE, las decisiones D1–D8 y el plan review independiente están completos. `plan.md` define las
subfases, contratos DB/API, concurrencia y verificación. TASK-006 está lista para implementación,
pero no se inició implementación ni se mutó DEV/PROD por instrucción humana explícita.

**TASK-006 PLAN REVIEW PASS — READY FOR IMPLEMENTATION**
