# TASK-009 — Appointments / Turnos — PRODUCT DECISIONS APPROVED

**Estado:** APPROVED — PLAN READY FOR REVIEW. Las decisiones de producto están cerradas; este brief y el plan no autorizan implementar antes del review independiente.

## Objetivo y preflight

Implementar posteriormente gestión de turnos del Center: búsqueda de slots, alta, consulta, reprogramación, cancelación y cambios de estado. La Agenda visual completa pertenece a TASK-010.

- `pnpm bootstrap` PASS: Node 24.21.0, pnpm 11.26.0 y vínculo Supabase DEV coherente. `git fetch --prune` PASS. Al iniciar, `HEAD = main = origin/main = f82ace0f6f2514441ea95c7c1fa39ec5591517f4`. Rama nueva `task/009-appointments` creada desde ese commit; HEAD permanece allí.
- `next-env.d.ts` histórico: `M`, unstaged, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; ajeno e intacto.
- Había cuatro archivos incidentales en `active/TASK-009` sobre visibilidad de contraseñas. Se inspeccionaron y no se adoptaron. Este `brief.md` se creó desde cero; se retiraron los `plan.md`, `implementation-report.md` y `review.md` incidentales. Tras aprobar producto se creó un `plan.md` nuevo de Appointments. TASK-010–012 permanecen intactos.
- Fuentes: README, AGENTS/Harness, producto, reglas, estado, decisiones técnicas y de tiempo, módulos Appointments/Availability/Patients/Professionals/Agenda, migrations, antecedentes TASK-004–008 y código afectado de pacientes, disponibilidad, autorización y navegación. TASK-008 verificó live DEV (20/20 migrations y catálogo de appointments sin drift material). **Esta fase no hizo una nueva introspección live**; el próximo gate debe revalidar catálogo/paridad DEV read-only.

## APPROVED / DOCUMENTED — contrato existente

- Un turno pertenece a un Center y referencia PatientCenter, ProfessionalCenter y Specialty. Paciente y vínculo profesional activos; Specialty activa y asignación activa al PC; intervalo dentro de Availability activa; no doble reserva por PC; no alta/reprogramación al pasado.
- `starts_at`/`ends_at` son instantes `timestamptz`. Availability es horario semanal local de `centers.timezone`. Slots calculados, no persistidos; intervalos `[inicio, fin)`; varias franjas por día; sin excepciones/feriados/vacaciones v1. CANCELLED preserva historia y libera slot. Reprogramar conserva `appointment.id`. Sin coordinación global del Professional entre Centers.
- Estados: `PENDING`, `CONFIRMED`, `ATTENDED`, `CANCELLED`, `NO_SHOW`. Bloquean los cuatro salvo CANCELLED. El diagrama `PENDING → CONFIRMED → ATTENDED` con ramas desde CONFIRMED a CANCELLED/NO_SHOW es conceptual e incompleto como matriz de transiciones.
- ADMIN y RECEPTION crean, confirman, reprograman, cancelan y marcan ATTENDED/NO_SHOW. PROFESSIONAL ve sólo sus turnos y marca ATTENDED/NO_SHOW. PLATFORM_ADMIN no gana acceso tenant implícito. Center y membership deben estar activos.
- La duración habitual del PC es default 30 minutos, configurable 5–480 en pasos de 5. La documentación general permite otra duración, pero la decisión específica aprobada para TASK-009 la excluye. El alta inline de paciente se menciona como posibilidad general, pero TASK-009 reutiliza el registro de TASK-007 con retorno.

## Estado real DB versionado

Fuentes principales: `20260921150000_initial_domain_schema.sql`, `20260921210000_use_explicit_appointment_blocking_statuses.sql`, `20261016160000_add_availability_foundation.sql`. TASK-004 probó la exclusión concurrente con SQLSTATE `23P01`; TASK-008 cotejó catálogo live entonces vigente. Este contrato versionado requiere revalidación live en el próximo gate.

| Columna | Tipo | Nulo | Default |
| --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()`; PK |
| `center_id`, `patient_center_id`, `professional_center_id`, `specialty_id` | `uuid` | no | — |
| `starts_at`, `ends_at` | `timestamptz` | no | — |
| `status` | `public.appointment_status` | no | `PENDING` |
| `administrative_note` | `text` | sí | NULL |
| `created_at`, `updated_at` | `timestamptz` | no | `now()` |

- FKs compuestas: `(patient_center_id, center_id) → patient_centers(id, center_id)`; `(professional_center_id, center_id) → professional_centers(id, center_id)`; `(professional_center_id, specialty_id) → professional_center_specialties(professional_center_id, specialty_id)`. Todas `ON UPDATE/DELETE RESTRICT`. La asociación PC–Specialty tiene FKs compuestas con Center, por lo que la cadena impide mezclar Centers. No hay FK directa Appointment→Center ni FK a Availability.
- CHECK `appointments_time_order (starts_at < ends_at)`. Sin CHECK de duración, pasado, zona, actividad de entidades, disponibilidad o transiciones. Las FKs prueban relación histórica, **no `is_active`**.
- `appointments_no_blocking_overlap`: `EXCLUDE USING gist (professional_center_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status IN (PENDING, CONFIRMED, ATTENDED, NO_SHOW)`. Es la garantía final de concurrencia; CANCELLED no participa; intervalos contiguos son válidos. Un estado nuevo no bloquearía automáticamente.
- Índices adicionales: `(center_id, starts_at)`, `(professional_center_id, starts_at)`, `(professional_center_id, specialty_id)`, `(patient_center_id, starts_at DESC)`, `(center_id, status, starts_at)`; además PK y GiST.
- Trigger `appointments_set_updated_at BEFORE UPDATE` usa `private.set_updated_at()` y asigna `now()`. **No es monotónico**, a diferencia de PatientCenter/Availability/PC. `updated_at` por sí solo aún no es token CAS fiable cuando dos updates pueden compartir timestamp.
- RLS habilitado en `appointments`; la migration inicial revoca todo a `anon, authenticated`. Ninguna migration posterior añade policy, grant de tabla ni RPC pública de lectura, slots, alta, transición o reprogramación de turnos. `private.has_future_appointments_outside_availability(uuid, uuid)` es la única función que lee Appointment: `SECURITY DEFINER`, retorna un booleano a RPCs de Availability y no concede EXECUTE a esos roles. No habilita gestión de turnos.
- Dependencias de acceso: PatientCenters/Persons tienen SELECT tenant y RPCs de Patient para ADMIN/RECEPTION, no PROFESSIONAL. Specialties/asignaciones tienen SELECT directo sólo ADMIN; PC directo para ADMIN o Profesional propio. RECEPTION obtiene contexto mínimo de PC por `staff_list_availability_professional_centers`, pero no catálogo de Specialty/asignaciones. Availability tiene SELECT tenant activo y RPCs de administración; su helper de advertencia no genera slots. `centers.timezone` sólo tiene CHECK de texto no vacío y default `America/Argentina/Buenos_Aires`, sin CHECK IANA.

**DB BLOCKER:** se necesita una migration incremental para acceso tenant mínimo y operaciones atómicas autorizadas. Ni service role, ni bypass tenant, ni DML genérico cliente son soluciones aceptables. El plan propone policies, grants, lecturas/RPCs y firmas conceptuales sujetos a review; no se cambia DB en esta fase.

## Dependencias y frontera TASK-009 / TASK-010

- TASK-007 ofrece búsqueda tenant y resolve/create/link/reactivate de PatientCenter con confirmación, control de identidad y CAS. Reutilizar sus servicios/RPCs sin duplicar Person ni exponer directorio global. PROFESSIONAL no recibe acceso general a pacientes.
- TASK-008 ofrece Availability semanal activa, duración habitual, contexto mínimo para RECEPTION y advertencia de turnos futuros fuera de franja. Cambiar franjas no mueve turnos. TASK-009 debe hacer visible su situación y permitir una resolución aprobada.
- TASK-009 requiere slots concretos y UI funcional de Turnos. TASK-010 recibe día/semana/mes, React Big Calendar, columnas profesionales, interacción en calendario y presentación de Agenda. `docs/modules/availability.md` y textos históricos de TASK-008 llaman “Agenda (TASK-009)” a slots/resolución: referencia numérica obsoleta frente a la frontera solicitada. No incorporar el calendario a TASK-009 por esa frase.

## APPROVED — decisiones de producto TASK-009

1. **Estado y transiciones.** Todo turno nuevo comienza `PENDING`, sin selector de estado. Se permiten exactamente `PENDING → CONFIRMED | ATTENDED | NO_SHOW | CANCELLED` y `CONFIRMED → ATTENDED | NO_SHOW | CANCELLED`. `ATTENDED`, `NO_SHOW` y `CANCELLED` son terminales en el MVP; no se revierte `CONFIRMED → PENDING` ni se corrigen terminales en esta tarea. No se agrega un requisito temporal para marcar asistencia/ausencia que la matriz aprobada no incluyó.
2. **Reprogramación.** Sólo `PENDING` o `CONFIRMED`. Conserva `appointment.id`, `patient_center_id` y status; puede cambiar fecha, hora, ProfessionalCenter y Specialty dentro del mismo Center. El destino debe estar activo, tener Specialty activa/asignada y Availability válida. La transacción revalida todo; un turno futuro que quedó fuera de Availability por un cambio de franja conserva historia y sólo puede moverse a un slot ahora válido.
3. **Duración y slots.** No hay duración personalizada en TASK-009. `ends_at` se deriva exclusivamente de `professional_centers.usual_appointment_duration_minutes` vigente. Los candidatos se alinean desde el inicio de **cada** franja de Availability, avanzando por una duración completa; no hay slots parciales ni offsets arbitrarios. Intervalos `[start,end)`; `CANCELLED` libera, `PENDING/CONFIRMED/ATTENDED/NO_SHOW` bloquean. Buscar slots es una fotografía: create/reschedule revalidan y GiST arbitra finalmente.
4. **Autoridad y zona.** PostgreSQL es autoridad para Availability, zona IANA, actividad/asignación, validez de slot y concurrencia; TypeScript valida forma, adapta errores y coordina UI. `timestamptz` guarda instantes. Se omiten horas locales inexistentes y ambiguas por DST, incluidos candidatos cuyo intervalo cruza una discontinuidad local incompatible con duración/alineación. No se asume Argentina para todos los Centers.
5. **Paciente.** Buscar mediante TASK-007. Si no se encuentra, abrir su flujo de registro existente y volver a Crear turno con el `PatientCenter` resultante preseleccionado. No duplicar formulario ni contrato Person/Patient; retorno interno acotado al mismo Center.
6. **Privacidad.** PROFESSIONAL sólo lee sus turnos y sólo nombre, apellido, fecha/hora, Specialty y status; no recibe documento, nacionalidad, teléfono, email ni notas administrativas de PatientCenter o Appointment. `administrative_note` pertenece al Appointment, es opcional y sólo ADMIN/RECEPTION la ven/editan. No es nota clínica.
7. **Permisos.** ADMIN/RECEPTION ven turnos del Center y propios, crean, reprograman, confirman, cancelan, marcan ATTENDED/NO_SHOW y ven/editan la nota. PROFESSIONAL ve sólo propios y marca ATTENDED/NO_SHOW sólo propios. PLATFORM_ADMIN no tiene acceso tenant implícito; Center o membership inactivos y cross-center denegados.
8. **Rutas y UX.** Listado funcional `/centers/[centerId]/appointments`, alta `/new`, detalle/acciones `/[appointmentId]`, con reprogramación desde el detalle o subflujo coherente. Alta: Paciente → Specialty → Profesional → fecha → slot → nota administrativa opcional → resumen → crear. Mostrar duración habitual sin edición; resumen con paciente, Specialty, profesional, fecha e inicio/fin. Sin reserva optimista.

## Criterios de aceptación

- ADMIN/RECEPTION pueden buscar slots válidos, crear un turno `PENDING`, listar/ver, reprogramar conservando identidad/paciente/status, transicionar según matriz y editar nota; PROFESSIONAL sólo ve la proyección mínima de sus turnos y marca ATTENDED/NO_SHOW propios.
- La DB impide cross-center, inactivos, asignación inválida, pasado, DST inválido/ambiguo, slot fuera de franja/no alineado y doble reserva, incluso con requests manipulados y carreras. `updated_at` de Appointment debe ser CAS monotónico antes de habilitar mutaciones.
- La búsqueda da candidatos enteros por franja y duración vigente. Revalidación atómica y error recuperable cuando la lista queda stale. Cancelar conserva el turno y libera su intervalo.
- El listado abre upcoming por defecto, con filtros acotados de fecha/rango, estado y ProfessionalCenter; búsqueda de paciente reutiliza el contexto tenant de TASK-007 cuando aporte al flujo, sin directorio nuevo para PROFESSIONAL. La UI contempla vacíos, errores, móvil, teclado, foco y recarga tras stale.
- El retorno desde registrar paciente no admite URL arbitraria ni otro Center; un `patientCenterId` retornado se reautoriza antes de preseleccionarse. Ninguna información sensible de paciente/nota llega a la proyección PROFESSIONAL.

## Frontera TASK-009 / TASK-010 y exclusiones

TASK-009 entrega turnos operables en un **listado**, slots y acciones. TASK-010 entrega Agenda visual día/semana/mes, React Big Calendar, columnas por profesional e interacción de calendario. Fuera de TASK-009: drag & drop, duración personalizada, corrección/reversión de estados terminales, excepciones de Availability, feriados/licencias, coordinación del mismo Professional entre Centers, reserva pública, recordatorios, pagos, historia clínica y notifications. Las menciones históricas “Agenda (TASK-009)” en Availability describen dependencia funcional antigua; no trasladan el calendario a TASK-009.

## Riesgos e impacto

- **DB/security:** hoy no existen policy/grant/RPC de Appointment para authenticated. Se requiere migration incremental. Las FKs prueban relación histórica, no actividad; la GiST prueba overlap, no autorización, Availability, DST ni transición.
- **CAS:** trigger actual `private.set_updated_at()` usa `now()` y puede repetir token. Migration debe cambiar sólo el trigger de Appointment a uno monotónico compatible con la foundation existente; revisar semántica de no-op.
- **Tiempo:** `centers.timezone` sólo exige texto no vacío. Preflight inventaría zonas y contrato SQL valida identificador IANA antes de convertir. DST y intervalos que cruzan cambios de offset exigen tests específicos.
- **Carreras:** create/create, create/reschedule, reschedule/reschedule, cancel/create y status/note simultáneos. Locks locales y CAS deben evitar lost update; GiST es garantía final de exclusión. Cambios de Availability/duración/entidades necesitan orden de locks compatible con TASK-006–008.
- **Privacidad:** abrir SELECT directo de Appointment a PROFESSIONAL filtraría filas pero expondría columnas sensibles; usar proyección DB separada. Un resultado de red incierto tras create requiere reconciliar antes de reintentar.
- **Lectura histórica y elegibilidad actual:** desactivar ProfessionalCenter o Specialty no elimina, oculta ni invalida un Appointment existente. ADMIN/RECEPTION leen sus turnos mediante una proyección DB específica de Appointment que incluye las relaciones históricas inactivas sin ampliar su SELECT general de Professional/Specialty; PROFESSIONAL usa otra proyección mínima propia, sin nota ni documentos/contactos. Sólo create/reschedule y sus catálogos exigen PatientCenter, ProfessionalCenter y Specialty activos y asignación vigente.
- **Costo temporal:** slot search opera para un Center, un ProfessionalCenter, una Specialty y un `local_date`. La validación temporal compartida con create/reschedule debe tener trabajo acotado por fecha y por candidato; queda excluida la enumeración por segundos o de rangos de días.
- **Impacto esperado posterior al review:** una migration nueva, tipos DB generados, módulo Appointments, rutas delgadas, adaptación acotada de retorno en Patients y navegación, tests nuevos; documentación de módulo/arquitectura/status al cierre. Verificadores históricos sólo si estrictamente necesario, con justificación y regresión. En esta fase sólo cambian brief, plan y status.

## Decisiones abiertas y siguiente gate

**Decisiones materiales abiertas: ninguna.** Límites técnicos de input, firma exacta de RPC y forma del panel de reprogramación se fijan en el plan/review sin alterar el contrato de producto. Siguiente gate: review independiente de brief y plan; después, Gate A DB/security con preflight DEV read-only y migration local/shadow. Esta fase no implementa, no crea migrations/tests, no consulta ni modifica Supabase DEV, y no hace commit/push/PR.

**TASK-009 PLAN READY FOR INDEPENDENT REVIEW.**
