# TASK-008 — Availability / Disponibilidad de profesionales

**Estado:** IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT REVIEW. Plan review PASS en review.md; la persona usuaria autorizó implementar TASK-008 y continuar tras recuperar Docker. La evidencia está en implementation-report.md.

## Objetivo

Administrar la disponibilidad semanal habitual de un ProfessionalCenter dentro de su Center: varias franjas por día sin solapamiento, alta, edición de horas y retiro lógico. Mostrar y editar en la misma pantalla la duración habitual del turno, usando el campo existente en ProfessionalCenter. Las reglas recurrentes son horas locales de centers.timezone y usan intervalos [inicio, fin).

## Preflight y alcance de esta fase

- TASK-008 se inició desde cero el 2026-10-16. Rama task/008-availability, HEAD = main = origin/main = 6e5e4f46fe7871966557ee1822ac08e2575ac22b. pnpm bootstrap PASS con Node 24.21.0, pnpm 11.26.0 y vínculo DEV coherente.
- next-env.d.ts es un cambio histórico ajeno: M, sin stage, SHA-256 0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC. Debe quedar intacto.
- Los seis archivos no trackeados que ocupaban antes TASK-008 eran del loader de UI; fueron inspeccionados y retirados sin usarlos como decisiones. Los archivos preexistentes bajo TASK-009 a TASK-012 son ajenos y permanecen intactos.
- Se leyeron Harness, producto, reglas de negocio, estado, decisiones de autorización/testing/tiempo/arquitectura, módulos Professionals/Availability/Appointments, conocimiento y precedentes TASK-006/007, migrations, tipos generados, código de Professionals, Authorization, navegación, tests y scripts DEV relevantes.
- Esta fase sólo actualiza brief.md, crea plan.md y actualiza docs/status.md. No modifica src, migrations, tipos, tests funcionales, package.json ni DEV; sin commit, push o PR.

## Decisiones de producto — APPROVED

| # | Contrato aprobado |
| --- | --- |
| 1. Ver | ADMIN y RECEPTION ven disponibilidad de todos los ProfessionalCenter del Center activo. PROFESSIONAL ve sólo la de su ProfessionalCenter vinculado. PLATFORM_ADMIN no obtiene acceso tenant implícito; una membership tenant válida conserva su rol propio. |
| 2. Modificar | ADMIN y RECEPTION pueden modificar. PROFESSIONAL no puede en MVP. PLATFORM_ADMIN no puede por privilegio global. |
| 3. Ubicación | Página/subruta propia del ProfessionalCenter, conceptualmente /centers/[centerId]/professionals/[professionalCenterId]/availability; acción “Disponibilidad” desde Profesionales. Ruta exacta y accesos adicionales según convenciones reales en plan.md. |
| 4. Alta | Secciones Lunes–Domingo, cada una con “Agregar horario”, “Hora desde”, “Hora hasta” y guardado explícito. Varias franjas no superpuestas el mismo día. |
| 5. Edición | Inline: Editar → horas editables → Guardar/Cancelar. Sin modal, drawer ni actualización optimista. |
| 6. Quitar | La acción visible “Quitar horario” establece is_active=false. No DELETE físico. No se listan inactivos ni se ofrece reactivación o administración histórica en TASK-008; si se necesita otra franja, se crea una nueva. |
| 7. Turnos futuros | Cambiar disponibilidad no mueve, cancela ni elimina appointments. Si tras el cambio quedan turnos futuros fuera de la disponibilidad habitual, se conserva todo y se muestra advertencia comprensible. Su resolución corresponde a TASK-009/Agenda. |
| 8. Duración habitual | Editable directamente en Availability, 5–480 minutos en múltiplos de 5, default 30. El dato único es professional_centers.usual_appointment_duration_minutes. La edición existente en Profesionales puede seguir, sobre el mismo campo. |
| 9. Timezone | Las horas son locales de centers.timezone, visible discretamente. 13:00 no pertenece a 09:00–13:00. La conversión fecha+hora+zona a instante y DST para appointments pertenece a TASK-009. |
| 10. Vacíos y móvil | Siete secciones verticales, sin tabla horizontal. Cada día vacío muestra “Sin disponibilidad” y la acción para agregar si el rol edita. Si la semana entera está vacía, estado introductorio adicional sin ocultar días. Operable en móvil sin scroll horizontal. |

Matriz aprobada:

| Rol | Ver | Modificar |
| --- | --- | --- |
| ADMIN | Todos los ProfessionalCenter del Center | Sí |
| RECEPTION | Todos los ProfessionalCenter del Center | Sí |
| PROFESSIONAL | Sólo su ProfessionalCenter | No |
| PLATFORM_ADMIN sin membership tenant | No | No |

Siempre aplican Center activo, membership activa, ProfessionalCenter del mismo Center y vínculo activo cuando corresponda.

## Criterios de aceptación

1. ADMIN y RECEPTION pueden encontrar un ProfessionalCenter activo, consultar sus siete días, crear varias franjas válidas en un día, editar horas inline, retirar lógicamente una franja y editar la duración habitual. PROFESSIONAL sólo consulta la propia; no recibe mutaciones.
2. La aplicación y PostgreSQL rechazan actor sin rol, Center/membership inactivos, vínculo ajeno o inactivo, horarios inválidos y franjas activas superpuestas. Un PLATFORM_ADMIN sin membership tenant carece de acceso. No se exponen filas inactivas por la interfaz de Availability.
3. PostgreSQL conserva GiST como garantía final de no solapamiento, incluso ante concurrencia. La edición/retiro detecta conflictos stale con un token fiable y exige recarga, sin sobrescribir silenciosamente.
4. Cambiar franjas no modifica appointments. Tras un guardado que deja turnos futuros fuera del horario semanal, la UI muestra advertencia sin revelar datos de pacientes o turnos.
5. La duración conserva default, límites y paso; ambas pantallas editan el mismo ProfessionalCenter. La RPC nueva para RECEPTION sólo puede modificar ese campo, nunca la matrícula.
6. La UI usa hora local del Center, [inicio, fin), estado vacío completo, responsive sin scroll horizontal, labels, foco, teclado y feedback accesible. Los mensajes de error no revelan SQL, constraints ni existencia de datos ajenos.
7. Gates DB/RLS, RPC, autorización, acciones, componentes, integración y smoke focalizado pasan antes de pedir review de implementación. Fixtures DEV, si se usan, tienen ownership y cleanup exactos.

## Contrato DB versionado e impacto aprobado

- La migration inicial define availabilities con id UUID; professional_center_id y center_id obligatorios; weekday smallint 1–7; start_time/end_time time without time zone; is_active true por defecto; created_at/updated_at timestamptz. La FK compuesta (professional_center_id, center_id) referencia ProfessionalCenter del mismo Center. CHECK weekday 1–7 e inicio < fin. GiST excluye solapamiento activo por ProfessionalCenter y día usando intervalo [inicio, fin); admite franjas contiguas.
- Hay índices de (professional_center_id, center_id), parcial (professional_center_id, weekday) para activos y el índice de exclusión. El trigger de availabilities.updated_at usa now(); el de ProfessionalCenter ya usa avance monotónico.
- ProfessionalCenter tiene duración NOT NULL default 30, rango 5–480, múltiplo de 5. Appointments usa timestamptz y FK a ProfessionalCenter, sin FK a Availability. El schema no persiste slots.
- RLS de availabilities está habilitada pero no hay grants/policies/RPC para authenticated. **DB BLOCKER RESUELTO COMO DECISIÓN DE DISEÑO:** se aprueba una migration incremental con SELECT tenant bajo RLS y mutaciones por RPCs estrechas. No usar service role, DML genérico cliente ni bypass de RLS. La migration no actualizará ni eliminará datos existentes ni cambiará appointments.
- Para no ampliar el acceso de RECEPTION a columnas personales completas de Professional, una consulta RPC mínima devolverá sólo contexto de disponibilidad (ID, nombre, duración, estado/token) con el mismo alcance de roles. La tabla availabilities se leerá mediante SELECT y RLS.
- La RPC existente admin_update_professional_center no sirve para la nueva edición RECEPTION: exige ADMIN y acepta matrícula además de duración. El plan incorpora una RPC nueva limitada a duración para ADMIN/RECEPTION, sobre el mismo campo, con el token monotónico ya existente; no se crea otra fuente de verdad.

## Seguridad, concurrencia y errores

- Lecturas internas mediante queries del módulo y cliente Supabase de sesión; mutaciones web mediante Server Actions delgadas. Zod valida UUID, weekday ISO (1=Lunes, 7=Domingo), horas HH:MM en precisión de minuto y duración. La DB vuelve a validar rol y pertenencia.
- Las franjas activas sólo se leen bajo RLS para Center/membership activos; PROFESSIONAL sólo su vínculo activo. Las RPCs validan auth.uid(), ADMIN/RECEPTION, Center/membership activos y ProfessionalCenter activo del mismo Center. PLATFORM_ADMIN no obtiene bypass.
- GiST protege overlaps concurrentes. Update/deactivate comparan expected_updated_at bajo lock; se planifica hacer monotónico el trigger de Availability en la misma migration para que el token sea fiable. No se replica el CAS complejo de Patients.
- Error mapping: intervalo inválido, overlap, ProfessionalCenter inactivo, Center ajeno, rol insuficiente, stale y fallo inesperado. Cross-center se responde sin revelar si el recurso existe. Professional no tiene un is_active global; “profesional inactivo” se refiere al vínculo con el Center.

## Riesgos y fuera de alcance

Riesgos: grants o policies demasiado amplios; revelar identidad profesional a RECEPTION; carreras entre cambios de vínculo y Availability; falsos negativos de stale; advertencia de turnos futuros al convertir instantes a hora local; posible timezone inválido preexistente (centers.timezone sólo comprueba texto no vacío); horas de 24:00/cruce de medianoche no representables en una sola franja. Reactivar un ProfessionalCenter vuelve operativas sus franjas que seguían activas; TASK-008 no altera esa reactivación y la UI permitirá revisarlas. El plan define mitigaciones y gates. Horas de la UI: HH:MM 00:00–23:59; inicio < fin; sin cruce de día.

Fuera de TASK-008: creación/reprogramación/cancelación de turnos, slot generator, agenda, resolución de turnos fuera de horario, excepciones, feriados, licencias, bloqueos extraordinarios, DST de appointments, lista/reactivación de franjas inactivas y administración histórica.

## Gate siguiente

Review independiente de la implementación y su evidencia. El plan review previo fue PASS; el detalle histórico de esa fase permanece en plan.md y review.md.
