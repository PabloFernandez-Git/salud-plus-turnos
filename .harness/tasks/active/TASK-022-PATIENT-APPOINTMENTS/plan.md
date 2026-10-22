# Plan y contrato propuesto — TASK-022

## Decisión de auditoría

No existe una lectura reutilizable que devuelva **todo** el historial de un `PatientCenter`. La tabla `appointments` no admite SELECT directo a `authenticated`. El detalle lee sólo por `appointment_id`; el listado administrativo acepta un rango de hasta 31 días, estado y profesional, pero no paciente. Buscar múltiples períodos y filtrar páginas en el cliente no cumple completitud ni paginación.

## RPC mínima requerida

Migration incremental nueva, sin alterar la firma de las RPC actuales:

`public.staff_list_patient_appointments(p_center_id uuid, p_patient_center_id uuid, p_section text, p_as_of timestamptz, p_cursor_starts_at timestamptz default null, p_cursor_id uuid default null, p_limit integer default 20)`.

- `STABLE SECURITY DEFINER SET search_path = ''`; revocar `PUBLIC`, `anon`, `authenticated` y `service_role`, luego conceder `EXECUTE` sólo a `authenticated`, como las RPC de Turnos actuales.
- Antes de cualquier lectura, exigir `auth.uid()` y `private.has_active_center_role(p_center_id, ARRAY['ADMIN','RECEPTION'])`; denegar con `42501/APPOINTMENT_ACCESS_DENIED` sin revelar existencia de paciente.
- Validar sección (`UPCOMING`/`HISTORY`), límite `1..50`, pareja de cursores completa, `p_as_of` y `p_patient_center_id` no nulos. Verificar `patient_centers.id = p_patient_center_id AND center_id = p_center_id`, sin exigir `is_active`; devolver vacío para ID inexistente o de otro centro. No resolver por `Person`.
- El servidor de aplicación captura **una vez** el instante UTC de apertura del panel y lo envía como `p_as_of` a ambas secciones y a todas sus páginas, incluso cuando una sección está vacía. Una recarga inicia un corte nuevo. La RPC no toma la hora del navegador.
- `UPCOMING`: `starts_at >= as_of AND status IN ('PENDING','CONFIRMED')`, orden `(starts_at, id) ASC`.
- `HISTORY`: complemento disjunto: `starts_at < as_of OR status NOT IN ('PENDING','CONFIRMED')`, orden `(starts_at, id) DESC`. Así una cancelación futura aparece en historial; también cualquier estado terminal futuro y un pendiente vencido.
- Keyset estricto en la dirección de cada sección sobre `(starts_at, id)`, `LIMIT p_limit + 1` y `has_more`. Sin `OFFSET`, `COUNT` ni límite de fechas. Si la página está vacía, `has_more=false` se infiere del resultado vacío.
- Proyección: `appointment_id`, `starts_at`, `ends_at`, `status`, `professional_first_name`, `professional_last_name`, `specialty_name`, `has_more`. No devolver `Person`, documento, contacto, `administrative_note`, datos del paciente ni IDs de otros centros.
- Joins exactos con `appointment.center_id = p_center_id`, `appointment.patient_center_id = p_patient_center_id`, `patient_center.center_id = appointment.center_id`, `professional_center.center_id = appointment.center_id`, asignación/especialidad del mismo centro. No filtrar `is_active` en los vínculos históricos.
- El `appointments_patient_center_fk` compuesto ya protege pertenencia en escritura; la RPC la vuelve a comprobar en lectura. RLS y revocación de SELECT directo permanecen vigentes.
- Reemplazar el índice actual `(patient_center_id, starts_at DESC)` con `(patient_center_id, starts_at, id)` en la migration incremental tras verificar planes. La clave compuesta soporta recorrido ASC y DESC y desempate estable; conservar el índice previo si su retiro afecta otros planes.

## Integración local posterior al contrato

1. Agregar adapter tipado y validador de respuesta con los campos exactos; servicio `server-only` con Zod y `requireRole(centerId, ['ADMIN','RECEPTION'])` antes de llamar a RPC con cliente de sesión.
2. Obtener Center timezone del contexto autorizado; formatear `starts_at`/`ends_at` con `Intl.DateTimeFormat` en esa zona y mostrar `timeZoneName: 'shortOffset'` siguiendo el patrón de `centerWallTime` de Agenda. `appointmentLocalParts` no ofrece offset y no basta para distinguir dos ocurrencias de la misma hora civil en DST. Mostrar el horario almacenado del turno, no `updated_at` ni momento de cancelación.
3. Añadir en `PatientWorkspace` dos secciones de solo lectura dentro del panel existente. Carga inicial y «Cargar más» por sección; errores independientes con reintento, vacíos claros y enlaces a `/centers/{centerId}/appointments/{appointmentId}`. El detalle vuelve a autorizar en servidor.
4. Mantener el flujo de edición y descarte del panel. `PatientWorkspace` hoy usa `detail.updatedAt` como key: no alcanza para resetear estado al cambiar de paciente. Vincular el estado de lectura a `(centerId, patientCenterId)`, reiniciar páginas/cursores/corte y descartar respuestas asíncronas tardías, incluido el modo de detalle fallido.

## Pruebas y gates

- SQL local/DEV **sólo tras autorización de aplicación**: ADMIN/RECEPTION mismo centro, PROFESSIONAL, PLATFORM_ADMIN-only, membership/Center inactivos, paciente de otro centro, UUID inexistente, PatientCenter inactivo, nombres de vínculos inactivos y prohibición de SELECT directo.
- Paginación: más de 50 turnos, empates de `starts_at`, ambas direcciones, sin duplicados/omisiones en datos estables, páginas vacías y corte fijo. Si un turno cambia de estado durante la navegación, una recarga reconstruye ambas secciones; no se promete snapshot transaccional entre solicitudes.
- Estados: pasado PENDING/CONFIRMED/ATTENDED/NO_SHOW/CANCELLED y futuro CANCELLED/ATTENDED/NO_SHOW, frontera exacta `starts_at = as_of`.
- Tiempo: render IANA, fecha local distinta de UTC y dos instantes distintos durante una hora repetida por DST con offsets visibles.
- Servicio/componente: validaciones Zod, error `42501`, error de lectura genérico, vacíos, carga incremental, detalle autorizado, cierre/descarte y 1440/390 px.
- Review independiente de SQL, autorización, aislamiento, clasificación, cursores y UI antes de cierre. No se realiza integración real ni inspección visual poblada mientras falte la RPC aplicada al entorno autorizado.

## Estado del checkpoint PostgreSQL local

La RPC y el índice propuestos están escritos en `supabase/migrations/20261022120000_add_patient_appointment_history.sql`; la prueba transaccional está en `supabase/tests/task-022-patient-appointment-history.sql`. No se aplicó la migration. El intento de iniciar PostgreSQL local aislado falló porque Docker Desktop no pudo arrancar; quedan pendientes ejecución SQL, inspección de planes y validación DEV autorizada. El criterio 13 y la UI siguen pendientes.
