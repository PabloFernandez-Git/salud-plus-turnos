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
- sin doble reserva del profesional;
- no crear ni reprogramar hacia el pasado;
- cancelar preserva historia y libera el slot;
- reprogramar mantiene identidad del turno y selecciona un slot válido;
- turnos concretos usan `timestamptz`.

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

El alta de paciente puede hacerse inline durante la creación del turno.
