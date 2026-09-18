# 22. Fechas, horas y zonas horarias

## Decisión aprobada

El sistema distinguirá explícitamente entre:

```text
reglas de horario local
→ disponibilidad recurrente

instantes absolutos
→ turnos concretos y auditoría

fechas sin hora
→ fecha de nacimiento y datos equivalentes
```

La idea central es:

> Guardamos una hora local cuando describimos una regla de horario; guardamos un instante absoluto cuando describimos algo que realmente ocurrió o va a ocurrir.

## Zona horaria del centro

Cada `Center` tendrá una zona horaria propia utilizando un identificador IANA.

Ejemplo inicial:

```text
America/Argentina/Buenos_Aires
```

Otros ejemplos válidos:

```text
Europe/Madrid
America/New_York
America/Sao_Paulo
```

No se almacenarán offsets fijos como:

```text
UTC-3
GMT-3
```

como representación principal de la zona horaria, porque un offset no describe correctamente las reglas históricas o estacionales de una región.

Para el MVP, el valor por defecto será:

```text
America/Argentina/Buenos_Aires
```

## Turnos concretos

Los turnos representan momentos concretos.

Por eso se almacenarán como:

```text
appointments.starts_at → timestamptz
appointments.ends_at   → timestamptz
```

En PostgreSQL, `timestamptz` representa un instante absoluto.

Importante:

> `timestamptz` no conserva por sí mismo el nombre original de la zona horaria.

Por eso el centro mantiene separadamente su campo `timezone`.

Ejemplo:

```text
Paciente elige:
24/09/2026 14:30

Centro:
America/Argentina/Buenos_Aires

↓ conversión

instante absoluto almacenado en starts_at
```

Al mostrarlo:

```text
starts_at
+
center.timezone
↓
24/09/2026 14:30
```

## Disponibilidad recurrente

La disponibilidad habitual no representa un instante concreto.

Representa una regla local del tipo:

```text
lunes
09:00 → 13:00
```

Por eso se almacenará conceptualmente como:

```text
weekday
start_time → time
end_time   → time
```

La zona utilizada para interpretar esas horas será la del centro.

Ejemplo:

```text
lunes 09:00–13:00
+
America/Argentina/Buenos_Aires
+
fecha concreta
↓
slots reales de ese día
```

## Fechas sin hora

Datos como fecha de nacimiento se almacenarán como:

```text
date
```

Ejemplo:

```text
person.birth_date → date
```

No se usarán timestamps para datos cuya semántica sea únicamente una fecha.

Esto evita conversiones de timezone capaces de desplazar accidentalmente el día.

## Timestamps técnicos

Campos de auditoría utilizarán:

```text
created_at → timestamptz
updated_at → timestamptz
```

porque representan instantes reales.

## Presentación en la interfaz

La agenda se mostrará siempre utilizando la zona horaria del **centro activo**.

No se utilizará automáticamente la zona horaria del navegador o del dispositivo del usuario como fuente de verdad.

Ejemplo:

```text
Centro
→ America/Argentina/Buenos_Aires

Profesional abre la aplicación desde Madrid

Agenda
→ sigue mostrando horario de Buenos Aires
```

Esto evita que un mismo turno cambie visualmente de hora dependiendo de dónde esté físicamente el usuario.

## Conversión y validación

Las conversiones críticas entre:

```text
fecha local
+
hora local
+
zona IANA
↔
instante absoluto
```

serán validadas del lado servidor.

La UI puede ayudar a presentar o anticipar resultados, pero el servidor será la autoridad antes de persistir un turno.

No se utilizarán conversiones manuales como:

```text
hora - 3
hora + 5
```

para representar zonas horarias.

## Horario de verano y cambios de offset

Aunque Buenos Aires no utiliza actualmente horario de verano, el modelo debe estar preparado para centros en zonas que sí cambian de offset.

Por eso se usan zonas IANA y no offsets fijos.

Cuando en el futuro se soporte un centro en una zona donde una hora local pueda:

```text
no existir
```

o:

```text
ocurrir dos veces
```

esa ambigüedad deberá detectarse explícitamente.

Nunca se corregirá silenciosamente una hora local inválida mediante sumas o restas manuales.

La política de UX exacta para esos casos podrá definirse cuando aparezca la necesidad real.

## Cambio de timezone del centro

Cambiar la zona horaria de un centro con actividad existente será una operación sensible.

Los turnos ya creados representan instantes absolutos y no deben reinterpretarse silenciosamente.

Para el MVP podrá restringirse el cambio de timezone una vez que el centro tenga turnos, en lugar de intentar realizar una migración temporal compleja.

## Cálculo de disponibilidad

El flujo conceptual será:

```text
fecha solicitada
↓
día de semana
↓
disponibilidad habitual local
↓
timezone del centro
↓
generación de slots concretos
↓
comparación con turnos existentes
↓
slots disponibles
```

Ejemplo:

```text
lunes
09:00–12:00
duración: 30 min

↓

09:00
09:30
10:00
10:30
11:00
11:30
```

Antes de crear un turno, cada slot se transforma en un instante absoluto válido.

## Resumen de tipos

```text
Center.timezone
→ zona IANA

Appointment.starts_at
→ timestamptz

Appointment.ends_at
→ timestamptz

Availability.start_time
→ time

Availability.end_time
→ time

Person.birth_date
→ date

created_at / updated_at
→ timestamptz
```

## Estado

**Aprobado**
