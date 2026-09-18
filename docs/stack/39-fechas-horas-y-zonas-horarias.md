# 39. Fechas, horas y zonas horarias

Esta sección explica cómo pensar el tiempo dentro de Salud Plus — Gestión de Turnos.

Es importante porque "una fecha y una hora" no siempre representan el mismo tipo de dato.

---

## 39.1. Tres conceptos distintos

Vamos a separar tres casos:

```text
1. Instante absoluto
2. Horario local recurrente
3. Fecha sin hora
```

Confundirlos es una fuente frecuente de bugs.

---

## 39.2. Instante absoluto

Un turno concreto:

```text
24/09/2026 14:30
```

no está completo hasta saber en qué zona horaria fue definido.

Si el centro está en:

```text
America/Argentina/Buenos_Aires
```

entonces:

```text
24/09/2026
+
14:30
+
America/Argentina/Buenos_Aires
```

describe un instante inequívoco.

En PostgreSQL lo representamos con:

```text
timestamptz
```

Ejemplos:

```text
appointments.starts_at
appointments.ends_at
created_at
updated_at
```

### Una precisión importante sobre `timestamptz`

El nombre `timestamp with time zone` puede llevar a una conclusión equivocada.

PostgreSQL no guarda algo parecido a:

```text
2026-09-24 14:30 America/Argentina/Buenos_Aires
```

como una pareja permanente.

Lo que conserva es el **instante absoluto**.

La forma en que ese instante se muestra depende de la zona horaria utilizada al leerlo.

Por eso necesitamos además:

```text
Center.timezone
```

para saber cómo debe mostrarse la agenda del centro.

---

## 39.3. Horario local recurrente

Ahora pensemos:

```text
Todos los lunes
09:00 → 13:00
```

Esto no es un instante.

Es una regla.

El profesional no está diciendo:

> trabajo siempre a la misma hora UTC.

Está diciendo:

> trabajo de 9 a 13 según el reloj local del centro.

Por eso una disponibilidad habitual se representa conceptualmente como:

```text
weekday
start_time
end_time
```

y las horas usan:

```text
time
```

La zona horaria viene del centro.

---

## 39.4. Por qué esta diferencia importa

Supongamos un centro en Madrid.

El profesional trabaja:

```text
lunes 09:00
```

Madrid puede cambiar su offset respecto de UTC durante el año.

Si almacenáramos la regla recurrente como una hora UTC fija, podríamos terminar mostrando:

```text
08:00
```

o:

```text
10:00
```

según la época.

Eso violaría la intención original.

La regla correcta es:

```text
horario recurrente
→ tiempo local

turno concreto
→ instante absoluto
```

---

## 39.5. Fecha sin hora

Una fecha de nacimiento:

```text
24/11/1987
```

no necesita timezone.

No significa:

```text
24/11/1987 00:00 UTC
```

Solo significa una fecha del calendario.

Por eso usamos:

```text
date
```

Ejemplo:

```text
person.birth_date
```

Esto evita que una conversión de zona horaria transforme accidentalmente:

```text
24/11
```

en:

```text
23/11
```

---

## 39.6. Zona horaria IANA

Cada centro tendrá:

```text
timezone
```

con un identificador IANA.

Ejemplos:

```text
America/Argentina/Buenos_Aires
Europe/Madrid
America/New_York
America/Sao_Paulo
```

### ¿Por qué no `UTC-3`?

Porque:

```text
UTC-3
```

solo describe un offset.

No contiene información suficiente sobre cambios históricos o estacionales.

Una zona IANA representa reglas reales de una región.

Por eso preferimos:

```text
America/Argentina/Buenos_Aires
```

a:

```text
UTC-3
```

---

## 39.7. La agenda pertenece al centro

La fuente de verdad para mostrar horarios será:

```text
center.timezone
```

y no:

```text
timezone del navegador
```

Ejemplo:

```text
Centro:
Buenos Aires

Turno:
14:30

Profesional viaja a España
y abre la notebook
```

La agenda debe continuar mostrando:

```text
14:30 Buenos Aires
```

porque ese es el horario operativo del centro.

No queremos que el mismo turno cambie visualmente solo porque el usuario viajó.

---

## 39.8. Cómo se crea un turno

Flujo conceptual:

```text
Usuario selecciona:
24/09/2026
14:30
↓
Sistema conoce:
America/Argentina/Buenos_Aires
↓
Servidor interpreta ese horario local
↓
lo convierte a un instante absoluto
↓
PostgreSQL guarda starts_at
```

Cuando se vuelve a mostrar:

```text
starts_at
+
center.timezone
↓
24/09/2026 14:30
```

---

## 39.9. Cómo se genera disponibilidad

Supongamos:

```text
lunes
09:00–12:00

duración habitual:
30 minutos
```

La regla recurrente genera:

```text
09:00
09:30
10:00
10:30
11:00
11:30
```

Pero esos todavía son horarios locales.

Para una fecha concreta:

```text
lunes 28/09/2026
```

el sistema combina:

```text
28/09/2026
+
cada hora local
+
timezone del centro
```

y obtiene slots concretos que pueden compararse con los turnos existentes.

---

## 39.10. Qué significa "guardar en UTC"

En conversación informal suele decirse:

> guardar los turnos en UTC.

La idea práctica es correcta: queremos persistir un instante absoluto independiente de la zona desde la que luego se visualice.

En PostgreSQL utilizaremos:

```text
timestamptz
```

y dejaremos que PostgreSQL represente correctamente ese instante.

No vamos a hacer conversiones manuales antes de escribir strings "UTC" por nuestra cuenta.

---

## 39.11. Horario de verano

Buenos Aires no utiliza actualmente horario de verano, pero otras zonas sí.

En un cambio de horario pueden existir situaciones extrañas:

```text
una hora local que nunca ocurre
```

o:

```text
una hora local que ocurre dos veces
```

Por ejemplo, una región puede adelantar el reloj y saltar directamente de una hora a otra.

Por eso está prohibido resolver zonas horarias con lógica como:

```ts
hour - 3
```

o:

```ts
hour + offset
```

Usaremos herramientas que entiendan zonas IANA.

Si en el futuro soportamos centros en zonas con estas transiciones, los horarios ambiguos o inexistentes deben detectarse explícitamente y no corregirse en silencio.

---

## 39.12. Servidor como autoridad

La interfaz puede:

```text
mostrar horarios
formatear fechas
ayudar al usuario
```

pero antes de persistir un turno:

```text
fecha
+
hora
+
timezone
```

deben validarse en servidor.

Esto evita depender del reloj o configuración local del navegador como fuente de verdad.

---

## 39.13. Cambio de timezone del centro

Supongamos:

```text
Centro:
America/Argentina/Buenos_Aires
```

tiene cientos de turnos.

Después alguien cambia:

```text
timezone → Europe/Madrid
```

Los turnos existentes no deben desplazarse ni reinterpretarse automáticamente.

Representan instantes reales ya definidos.

Por eso cambiar el timezone de un centro con actividad será una operación sensible.

Para el MVP es razonable impedir ese cambio una vez que haya turnos y resolver una eventual migración compleja solo cuando exista una necesidad real.

---

## 39.14. Tabla mental rápida

| Concepto | Ejemplo | PostgreSQL |
| --- | --- | --- |
| Turno concreto | 24/09/2026 14:30 en Buenos Aires | `timestamptz` |
| Fin de turno | 24/09/2026 15:00 | `timestamptz` |
| Horario habitual | lunes 09:00 | `time` + día de semana |
| Fecha de nacimiento | 24/11/1987 | `date` |
| Creación de registro | instante exacto | `timestamptz` |
| Zona del centro | Buenos Aires | identificador IANA |

---

## 39.15. Regla que conviene recordar

> **Hora local para describir reglas; instante absoluto para describir eventos reales; `date` para fechas que no tienen hora.**

Con esta separación evitamos que la lógica temporal del sistema dependa accidentalmente de la computadora desde la que se abre la aplicación.
