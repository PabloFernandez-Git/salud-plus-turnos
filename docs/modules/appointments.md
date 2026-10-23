# Turnos

## TASK-022 — Lectura por paciente

`20261022120000_add_patient_appointment_history.sql` agrega `staff_list_patient_appointments` para ADMIN/RECEPTION del Center activo. Filtra por Center + PatientCenter, devuelve sólo instantes, estado, nombres de profesional/especialidad, ID de turno y `has_more`, y pagina por `(starts_at,id)` con un `p_as_of` común a ambas secciones. Futuros PENDING/CONFIRMED son próximos; turnos vencidos o terminales, incluidas cancelaciones futuras, son historial. No se lee `administrative_note` ni se concede SELECT directo. El SQL pasó ejecución y pruebas locales; la persona usuaria confirmó PASS estructural DEV con 24 migrations remotas. La integración UI y el gate funcional DEV obtuvieron PASS con fixtures sintéticos y cleanup sin residuos, según el ledger y reporte conservados localmente. Reprogramar sobrescribe el horario anterior y no genera auditoría histórica.

Un turno pertenece a un único centro y relaciona:
- PatientCenter;
- ProfessionalCenter;
- Specialty;
- starts_at;
- ends_at;
- estado;
- observación administrativa opcional.

## Estados

```text
Pending
Confirmed
Attended
Cancelled
NoShow
```

Flujo conceptual:

```text
Pending → Confirmed → Attended
              ├→ Cancelled
              └→ NoShow
```

## Reglas

- paciente activo en el centro;
- profesional activo en el centro;
- especialidad activa y habilitada para ese profesional;
- horario válido dentro de disponibilidad;
- sin doble reserva dentro del mismo ProfessionalCenter;
- no crear ni reprogramar hacia el pasado;
- cancelar preserva historia y libera el slot;
- reprogramar mantiene identidad del turno y selecciona un slot válido;
- turnos concretos usan `timestamptz`.

Bloquean horario Pending, Confirmed, Attended y NoShow. Cancelled no bloquea. Dos
ProfessionalCenter distintos pueden tener turnos simultáneos aunque pertenezcan al mismo
Professional; la coordinación global entre centros queda fuera del MVP.

## Permisos

Administrator / Reception:
- crear;
- confirmar;
- reprogramar;
- cancelar;
- marcar atendido/no-show.

Professional:
- ver únicamente sus propios turnos;
- marcar Attended / NoShow.

TASK-009 reutiliza la búsqueda y el registro de Patients (TASK-007). El retorno visual
desde el registro se implementó en Gate C; CREATE recibe un PatientCenter autorizado.

## Contrato de servidor (Gate B1)

`src/modules/appointments/` contiene validación Zod, once adaptadores RPC,
servicios y Server Actions. Las lecturas de staff y Professional usan RPCs y
proyecciones separadas; la proyección Professional contiene sólo nombre y apellido
del paciente, Specialty, horario, estado y token de actualización. No contiene nota
administrativa ni documento/contactos. Los listados usan fechas civiles del Center,
rango máximo de 31 días, página de 1–50 y cursor `(starts_at, appointment_id)`
sin conversiones de zona en JavaScript. Los catálogos de alta muestran sólo entidades
actualmente elegibles; las lecturas de turnos preservan historia inactiva.

ADMIN/RECEPTION administran; PROFESSIONAL consulta únicamente sus turnos y cambia
estado a ATTENDED/NO_SHOW. La Action obtiene el rol de la sesión mediante
`requireRole`/`requireProfessionalContext`; cada RPC reautoriza en PostgreSQL.
CREATE acepta fecha y hora civil, sin status/duración/instantes arbitrarios.
RESCHEDULE, STATUS y NOTE pasan `expected_updated_at` sin parsearlo como `Date`.
NOTE acepta texto de hasta 2.000 caracteres, cadena vacía o `NULL` para limpiar;
el adaptador acota la diferencia nullable de `database.types.ts` sin editar tipos
generados. La DB mantiene las reglas de Availability, DST, colisiones, CAS y no-op.

Las Actions devuelven `SUCCESS`, `VALIDATION_ERROR`, `BUSINESS_ERROR`, `AUTH_ERROR`,
`UNKNOWN_RESULT` o `UNEXPECTED_ERROR`. Ante red incierta durante una mutación no
reintentan: el cliente debe recargar el listado/detalle antes de otro intento. Gate D
comprobó Auth/RLS/RPC, DST y carreras en DEV con seis grupos PASS.

## UI y flujos (Gate C aprobado)

- `/centers/[centerId]/appointments` muestra próximos turnos por defecto, 31 días civiles del Center, filtros de fecha/estado y ProfessionalCenter para staff, cursor SQL intacto, históricos cancelados y estados vacío/error. La presentación usa `centers.timezone` y no supone que la fecha UTC coincide con la local. ADMIN/RECEPTION consultan la RPC administrativa; PROFESSIONAL usa su RPC mínima. `CenterNavigation` muestra Turnos a los tres roles.
- `/appointments/new` conduce Paciente → Specialty → profesional → fecha → slot de PostgreSQL → nota opcional → resumen → CREATE. El selector sólo usa catálogos activos y `staff_search_appointment_slots`; no genera candidatos en JS. La lectura vigente de Availability de TASK-008 distingue ausencia de franjas y día con franjas sin slots libres. CREATE no hace reserva optimista, bloquea doble submit y navega al detalle tras éxito confirmado.
- Desde la ausencia de un paciente se abre el registro existente de TASK-007 mediante la intención fija `from=appointment`. Crear, vincular, reactivar o elegir un PatientCenter activo vuelve a `/appointments/new?patientCenterId=<uuid>`. El servidor vuelve a comprobar Center, rol y actividad antes de preseleccionar, y el SQL revalida al crear. Parámetros `returnTo` externos o arbitrarios se descartan; la URL no contiene documento ni identidad personal.
- `/appointments/[appointmentId]` muestra datos/nota/acciones de staff o sólo la proyección Professional. PENDING/CONFIRMED permiten transiciones según la matriz aprobada; terminales no muestran controles. Reprogramar conserva paciente/estado/nota y usa nuevo catálogo/slot actual. Un turno futuro fuera de Availability actual muestra advertencia informativa sin mutación automática; los históricos con vínculos inactivos conservan lectura.
- Nota administrativa: texto, cadena vacía y NULL se distinguen; máximo 2.000 puntos de código. El CAS textual de detalle se transmite sin parseo ni redondeo. STATUS, RESCHEDULE y NOTE actualizan el token del resultado; stale y `UNKNOWN_RESULT` exigen recarga/reconciliación antes de reintentar. Los errores se traducen a mensajes públicos sin SQL crudo.
- La RPC aprobada de listado admite fecha, status y ProfessionalCenter, pero **no** PatientCenter. El plan mencionó un posible filtro por paciente; Gate C no inventa un parámetro ni filtra páginas en React. La búsqueda de Patients se usa en el alta. El selector del filtro de profesional muestra vínculos activos de TASK-008; un profesional histórico inactivo sigue visible en filas de turnos, aunque no figura en ese selector.
- Las pruebas Gate C son unitarias y de componentes con mocks. Gate D acreditó Auth/RLS/RPC, DST, carreras y tres escenarios Playwright sobre DEV con cleanup verificado. La Agenda visual, calendario diario/semanal/mensual y React Big Calendar siguen en TASK-010.

## Remediación Gate C aprobada

El alta mantiene el bloqueo tras SUCCESS mientras navega. Si CREATE queda sin
resultado confirmado, guarda la propuesta de la sesión antes de enviar la Action,
consulta de manera acotada la fecha y el ProfessionalCenter propuestos y compara
el detalle tenant con PatientCenter, Specialty e instantes. Un resultado ausente o
una lectura fallida permanecen indeterminados y no habilitan otro CREATE.

La migration incremental `20261019170000_add_appointment_slot_civil_time.sql`
agrega fecha y horas civiles PostgreSQL al resultado de slots. Crear y reprogramar
envían literalmente la hora civil ofrecida por SQL; el cliente no la deriva del
instante mediante ICU. El usuario aplicó la migration autorizada a DEV; Gate D
verificó 23 migrations, contrato POST y la integración real.
Patients conserva sólo la intención canónica `from=appointment` en su navegación
interna. La advertencia de Availability omite CANCELLED e informa cuando una
lectura falla; la búsqueda de pacientes descarta respuestas obsoletas.

## Refinamiento visual TASK-023

Crear turno permanece como página con el flujo y operaciones aprobados. Búsqueda, nota y selectores recibieron foco visible y estados visuales consistentes; los botones principales reutilizan el estilo compartido de encabezado. La auditoría detallada está en el expediente activo de TASK-023.
