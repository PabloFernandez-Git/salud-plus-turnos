# Fechas, horas y zonas horarias

## Propósito

Referencia rápida sobre cómo debe manejarse el tiempo dentro de Salud Plus — Gestión de Turnos.

## Regla principal

> Hora local para describir reglas; instante absoluto para describir eventos reales; `date` para fechas que no tienen hora.

## Centro

Cada centro tiene:

```text
timezone
```

como zona IANA.

MVP:

```text
America/Argentina/Buenos_Aires
```

## Turnos

```text
starts_at → timestamptz
ends_at   → timestamptz
```

Representan instantes absolutos.

La UI los muestra usando `center.timezone`.

## Disponibilidad recurrente

```text
weekday
start_time → time
end_time   → time
```

Representa horario local habitual del centro, no un instante UTC.

## Fechas sin hora

```text
birth_date → date
```

No deben modelarse como timestamps.

## Auditoría

```text
created_at → timestamptz
updated_at → timestamptz
```

## Conversión

```text
fecha local
+
hora local
+
center.timezone
↓
validación en servidor
↓
instante absoluto
```

No utilizar offsets manuales como `hora - 3`.

## Agenda

La agenda se muestra en la zona del centro activo, no en la zona automática del dispositivo del usuario.

## Horario de verano

Las zonas IANA permiten representar cambios de offset.

Si una hora local futura resulta inexistente o ambigua, debe detectarse explícitamente; nunca corregirse silenciosamente mediante offsets manuales.

## Cambio de timezone

Con turnos existentes, cambiar el timezone del centro es una operación sensible.

En el MVP puede restringirse el cambio una vez que exista actividad.

## Modelo mental

```text
Disponibilidad
→ regla local

Turno
→ instante absoluto

Fecha de nacimiento
→ fecha pura

Centro
→ define la zona con la que se interpreta y muestra la agenda
```
