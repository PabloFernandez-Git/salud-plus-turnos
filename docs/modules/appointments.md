# Turnos

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
desde el registro pertenece a Gate C; CREATE recibe un PatientCenter autorizado.

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
reintentan: el cliente debe recargar el listado/detalle antes de otro intento. Gate C
construirá rutas y pantallas; Gate D comprobará esta integración contra DEV.
