# TASK-007 — Pacientes · Task Brief

**Estado:** `DESIGN APPROVED — SECOND PLAN REMEDIATION COMPLETE — AWAITING INDEPENDENT RE-REVIEW — IMPLEMENTATION NOT AUTHORIZED`

## Objetivo y límites

Preparar el flujo de Recepción para encontrar un paciente de su Center, resolver por identidad documental exacta una Person global, crearla si no existe y crear, reutilizar o reactivar su único PatientCenter. Administrar sólo los datos del Center. D1–D8 quedaron aprobadas por la persona usuaria. El segundo re-review mantuvo P007-R1/R2/R3 abiertos sin findings nuevos; este brief y `plan.md` documentan la segunda remediación y esperan re-review independiente, sin autorizar implementación. Los findings originales siguen abiertos en `review.md` hasta ese re-review.

Fuera de alcance: Availability, slots, Appointments/Agenda, historia clínica, records, booking público, reminders, billing e insurance billing. Crear un paciente no crea Auth User, membership, Professional ni turno. No hay acceso ni cambios a PROD.

## Preflight y fuentes

- Antes de crear la rama: `main = origin/main = HEAD = ea620655ee9f75f903dbce2d94bf820e298b7218`; staging vacío; único cambio ` M next-env.d.ts`, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Rama creada desde ese HEAD: `task/007-patients`. `pnpm bootstrap` pasó (Node 24.21.0, pnpm 11.26.0, vínculo DEV coherente).
- Fuentes: `AGENTS.md`, `.harness/README.md`, `docs/product.md`, `docs/status.md`, `docs/modules/{patients,appointments,access}.md`, decisiones de autorización/API/testing, propuesta y pruebas de TASK-004, diseño/retrospectiva de TASK-005, brief/plan/retrospectiva y migrations de TASK-006, código y tipos generados.
- Hay 17 migrations versionadas. El CLI Supabase no estaba disponible vía `pnpm exec supabase migration list --linked` en este entorno (`supabase` no reconocido). Por ello este análisis verifica el contrato versionado y tipos generados, **no certifica el catálogo vivo de DEV**. La sincronía y baseline DEV deben reconfirmarse read-only antes de implementar. El SHA de `main` al iniciar consta en `docs/status.md`; el preflight Git exacto es la autoridad para esta rama.

## Estado real del modelo versionado

| Entidad | Datos y reglas existentes |
| --- | --- |
| `persons` | Identidad global. `id` UUID PK; `first_name`, `last_name`, `birth_date` (`date`), `nationality_code`, `document_number`, `normalized_document` generada, `created_at`, `updated_at` son NOT NULL. Sin `center_id`, teléfono, email ni `is_active`. Nombres/documento no vacíos; nacionalidad `^[A-Z]{2}$`; normalizado no vacío y NOT NULL; `UNIQUE(nationality_code, normalized_document)`. Fecha futura e ISO reconocido requieren validación de servidor: la DB sólo obliga fecha no nula y formato de dos letras. |
| `patient_centers` | Registro privado del Center. `id` UUID PK, `person_id` FK restrictiva, `center_id` FK restrictiva, `phone` NOT NULL/no vacío; `email`, `insurance_name`, `administrative_notes` NULL; `is_active` NOT NULL default true; timestamps NOT NULL. `UNIQUE(center_id, person_id)` cubre activos e inactivos; `UNIQUE(id, center_id)` soporta FK compuesta de Appointments. Sin unicidad de teléfono/email, sin validación DB de formato de email. |
| `centers` y `center_memberships` | Center tiene `is_active`; membership única por `(center_id,user_id)`, rol `ADMIN/RECEPTION/PROFESSIONAL`, `is_active`, y ProfessionalCenter obligatorio sólo para rol Professional. El helper `private.has_active_center_role` exige membership y Center activos. PLATFORM_ADMIN es independiente y no da bypass tenant. |

`private.normalize_document` hace trim, uppercase y quita whitespace, puntos y el conjunto aprobado de guiones; conserva letras, otros caracteres y ceros iniciales. `persons` y `professionals` comparten esa autoridad PostgreSQL. DNI numérico, alfanumérico, `00123`, espacios/puntos/guiones convergen según esa función; `---` o sólo separadores dan vacío y se rechazan. La unicidad final es la constraint PostgreSQL, también ante carreras. El espejo TypeScript de TASK-006 sirve sólo para validación previa y aporta el caso D-R1.

Índices relevantes: UNIQUE documental global; UNIQUE `(center_id,person_id)`; `(person_id)` y parcial `(center_id) WHERE is_active` en PatientCenter. No hay índice específico de nombre, teléfono o email. El trigger común `private.set_updated_at()` escribe `now()` en Person y PatientCenter ante cualquier UPDATE; **no garantiza token monotónico**. TASK-006 cambió exclusivamente los triggers de Specialty y ProfessionalCenter a `greatest(clock_timestamp(), old.updated_at + 1 microsecond)`. No hay version column ni RPC CAS de pacientes.

RLS está habilitada en ambas tablas. La migration inicial revocó acceso de `anon` y `authenticated`; ninguna migration posterior añade policy SELECT, grant ni RPC de Person/PatientCenter. No hay DML genérico ni API de pacientes. Los tipos `src/lib/supabase/database.types.ts` reflejan esos campos y nulabilidad; no otorgan permisos por sí mismos. Appointments ya tiene FK `(patient_center_id, center_id)` a PatientCenter, pero aún no se usa el módulo Turnos.

## Gaps demostrados

1. **Acceso/API:** faltan lecturas tenant bajo RLS, grants SELECT pertinentes y RPCs estrechas para resolve exacto, create+link transaccional, link/reactivation y mutaciones de PatientCenter. El diseño aprobado requiere una migration incremental de seguridad/API; no faltan tablas, columnas de producto ni constraints de deduplicación.
2. **CAS:** D6 requiere reemplazar el trigger de PatientCenter por versión monotónica. Person no necesita CAS de edición en TASK-007 porque D2 mantiene inmutables sus campos después del alta.
3. **Servidor/UI:** no existe módulo ni ruta de pacientes. Faltan validación Zod, autorización por operación, queries, Actions delgadas, estados y errores de UX, tests.
4. **Búsqueda:** el índice documental cubre resolve exacto; nombres/teléfono/email no tienen índice dedicado. No proponer índice adicional hasta fijar consultas y medir volumen/plan.

## Contrato funcional aprobado — D1–D8

1. En `/centers/[centerId]/patients`, ADMIN y RECEPTION activos de Center activo ven sólo PatientCenters del propio Center, incluidos inactivos mediante filtro. El listado tenant muestra nombre/apellido, documento, nacimiento, teléfono, email opcional, cobertura opcional, estado y acción. Notas sólo en el panel de administración, no en la tabla. En móvil priorizar nombre, teléfono y estado; detalles secundarios en panel.
2. Búsqueda tenant sólo entre PatientCenters vinculados: documento exacto normalizado o coincidencia textual literal de nombre/apellido, teléfono o email dentro del Center. Una única query opcional (`NULL`/vacía → listado paginado), estado allowlisted `ACTIVE/INACTIVE/ALL`, límite default 25 y rango `1..50`, offset acotado; Zod y RPC aplican las mismas cotas y rechazan parámetros inválidos sin clamp. Sin directorio global ni búsqueda parcial de documento global. Si no hay resultados, **no** iniciar resolve automáticamente; no usar un `SELECT persons` global.
3. Alta staged explícita: nacionalidad + documento + fecha de nacimiento ingresada → resolve exacto autorizado. Si no hay Person, pedir/validar nombres y datos de Center y crear Person+PatientCenter atómicamente. Si existe, la DB compara nacimiento; un mismatch impide link/reactivation y no muta nada ni revela la fecha almacenada. Una coincidencia exige confirmación explícita antes de vincular/reactivar. Un fallo de unicidad concurrente obliga a resolver de nuevo; no autocorregir ni enlazar una fila inesperada.
4. Si ya existe PatientCenter activo del Center, abrirlo sin duplicar ni sobrescribir. Si está inactivo, ofrecer reactivación explícita de la misma fila tras verificar nacimiento de nuevo, preservando teléfono/email/cobertura/notas; cualquier edición será posterior y explícita. No revelar existencia ni datos de otros Centers.
5. Administración posterior edita sólo teléfono, email, cobertura y notas del Center, y activa/desactiva la relación. La clave documental, nombre, apellido y nacimiento globales se muestran de solo lectura; corrección de identidad global queda fuera de TASK-007. La baja es lógica; no hard delete.

## Autorización actual y propuesta

Hoy nadie por la API `authenticated` puede leer o mutar Persons/PatientCenters; el permiso ADMIN de TASK-006 se limita a otros módulos. D1 autoriza a ADMIN y RECEPTION activos para listar, buscar dentro del Center, resolver documento exacto, crear, vincular, editar, activar/desactivar y leer/escribir notas **exclusivamente administrativas** del Center. PROFESSIONAL no recibe lectura futura anticipada en TASK-007. PLATFORM_ADMIN-only, membership o Center inactivo, cross-center y `anon` quedan denegados. UI, página, query, Action y RPC revalidan; ocultar acciones no basta. Ningún grant DML genérico.

D4 aprueba SELECT de PatientCenter a ADMIN/RECEPTION limitado por `center_id`/rol activo y SELECT de Person sólo si existe un PatientCenter visible en un Center con ese rol, sin policy global. El resolve de una Person **no vinculada** es una RPC exacta separada y de respuesta mínima. El review independiente debe comprobar las policies y grants exactos del plan.

## Riesgos e impacto

- **Privacidad alta:** el documento exacto permite probar existencia global; restringir por rol/Center, mínimo retorno, confirmación, auditoría y límites de abuso antes de exposición pública. El resolve no revela Centros ni datos de contacto. La prohibición de un directorio y de búsqueda global parcial no puede impedir matemáticamente la enumeración mediante intentos exactos repetidos; esta limitación requiere control operativo y review.
- **Identidad alta:** editar globales desde un Center afecta otros Centers y puede invalidar dedupe; posponer corrección global.
- **Concurrencia media/alta:** altas simultáneas, reactivación y edición deben preservar UNIQUE y CAS sin pérdida silenciosa; los triggers actuales no bastan como token CAS fiable.
- **Integración futura:** Turnos usará `patient_center_id` y `center_id` compuestos, y debe validar PatientCenter activo al reservar. TASK-007 deja identificador estable, estado y lookup tenant; no implementa reservas.

## Remediación de PLAN REVIEW, pendiente de re-review

- **P007-R1 — búsqueda:** `staff_search_patient_centers` no acepta `kind` ni filtros/campos arbitrarios. Una consulta literal tenant combina documento exacto canónico, nombre/apellido case-insensitive, teléfono con edge trim e email lowercase; `%`/`_` son datos. Query NULL o vacía tras `PATIENT_EDGE_WHITESPACE` (incluidos TAB/LF/CRLF solos) → listado paginado. RPC y Zod validan query `<=100` después de ese trim, estado `ACTIVE/INACTIVE/ALL`, limit 1..50 (default 25) y offset 0..10000 (default 0); NULL explícito en limit/offset o rango inválido falla. Orden determinista.
- **P007-R2 — contratos:** `PATIENT_EDGE_WHITESPACE` es exactamente TAB, LF, VT, FF, CR y SPACE en bordes, con helper TypeScript y helper SQL privado; no se equiparan `String.trim()` y `btrim()` implícito. Se aplica antes de validar nombre, documento, teléfono, email opcional, cobertura, notas y query. Teléfono sólo whitespace → inválido; email/cobertura/notas sólo whitespace → NULL. Nacionalidad ISO reconocida usa conjunto compartido; email no vacío reutiliza contrato/matriz TASK-006. Límites simétricos: nombres 100, documento recortado 100, teléfono 50, email 320, cobertura 160, notas 4000 y query 100; sin truncamiento. Matriz de trim TS/SQL obligatoria, incluida TAB interna preservada por el helper.
- **P007-R3 — fecha:** una primitiva privada `center_local_date_at(timezone, instant)` calcula `(instant AT TIME ZONE timezone)::date`; la RPC productiva le pasa timezone del Center autorizado y `statement_timestamp()`, nunca un instante del cliente. Nacimiento posterior se rechaza con cero Person/PatientCenter. Tests deterministas del helper usan `2026-10-14T02:59:59Z` y `2026-10-14T03:00:00Z` para el borde de Buenos Aires; tests RPC reales prueban hoy/mañana y cero estado parcial. No se añade CHECK dependiente del reloj.
- **Riesgo aceptado MVP:** intentos exactos repetidos pueden inferir existencia global mediante resolve y create/error; la respuesta mínima y autorización reducen exposición. **PRE-PROD obligatorio:** abuso/rate limiting y monitoreo de ambas vías antes de producción pública. D3/D8 no cambian.
- `review.md` conserva P007-R1/R2/R3 MEDIUM como historial abierto. Esta remediación documental no emite PASS ni cierra findings.

## Criterios de aceptación preliminares

- [x] Decisiones D1–D8 de `plan.md` aprobadas explícitamente; segunda remediación de P007-R1/R2/R3 documentada y pendiente de re-review independiente.
- [ ] Matriz de roles, Center activo, membership activa, cross-center y anon probada en servidor y DB.
- [ ] Dedupe documental y única relación Person–Center preservadas con carreras; sin divulgación de otros Centers.
- [ ] Alta, reutilización, reactivación y edición tenant atómicas, CAS y no-op según decisión aprobada; mismatch de nacimiento bloquea link/reactivation sin mutación.
- [ ] Listado y búsqueda útiles para Recepción, email visible cuando existe, notas fuera de tabla.
- [ ] E2E, SQL/RLS/RPC, regresiones, baseline/cleanup DEV y review independiente PASS antes de cerrar.

**Gate:** `DESIGN APPROVED — SECOND PLAN REMEDIATION COMPLETE — AWAITING INDEPENDENT RE-REVIEW — IMPLEMENTATION NOT AUTHORIZED`.
