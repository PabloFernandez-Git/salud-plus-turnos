# Disponibilidad

Pertenece a `ProfessionalCenter`.

## MVP

- horario semanal recurrente;
- duración habitual de turno por ProfessionalCenter;
- múltiples franjas el mismo día;
- sin excepciones/vacaciones/feriados en v1.

Ejemplo:

```text
Lunes 08:00–12:00
Lunes 16:00–20:00
```

Reglas:
- inicio < fin;
- no solapar franjas del mismo día;
- el final de un slot debe quedar dentro de la franja;
- profesional-centro inactivo no ofrece disponibilidad;
- cancelar un turno libera el slot;
- cambiar horario habitual no modifica/cancela automáticamente turnos futuros existentes.

Los slots se calculan, no se persisten:

```text
horario habitual
- turnos que bloquean
= disponibilidad
```

Las reglas recurrentes usan hora local del centro.
