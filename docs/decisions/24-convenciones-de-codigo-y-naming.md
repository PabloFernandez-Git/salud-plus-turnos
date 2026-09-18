# 24. Convenciones de código y naming

## Decisión aprobada

El proyecto utilizará convenciones simples y consistentes para que el repositorio sea fácil de navegar tanto para personas como para agentes.

La regla general será:

```text
Código técnico
→ inglés

UI y documentación de producto
→ español

Archivos y carpetas
→ kebab-case

Funciones y variables
→ camelCase

Componentes y tipos
→ PascalCase

PostgreSQL
→ snake_case
```

## Idioma

Los identificadores técnicos del código estarán en inglés.

Ejemplos:

```text
createAppointment
getPatientById
calculateAvailableSlots
AppointmentForm
ProfessionalCenter
```

Los textos visibles al usuario y la documentación pedagógica o de producto podrán permanecer en español.

Se evitarán mezclas como:

```text
crearAppointment
obtenerPatient
turnoStatus
```

## Archivos y carpetas

Se utilizará `kebab-case`.

Ejemplos:

```text
appointment-card.tsx
create-appointment.action.ts
get-patient-by-id.ts
calculate-available-slots.ts
professional-center.ts
```

## Variables y funciones

Se utilizará `camelCase`.

Ejemplos:

```ts
const activeCenter = ...
const appointmentId = ...

function getPatientById() {}
function calculateAvailableSlots() {}
```

Los nombres deberán expresar intención y evitar genéricos como:

```text
getData
processInfo
utils
helpers
```

cuando exista un nombre más específico.

## Componentes y tipos

Se utilizará `PascalCase`.

Ejemplos:

```text
AppointmentCard
AppointmentForm
Patient
AppointmentSummary
ProfessionalCenter
```

No se utilizarán prefijos artificiales como:

```text
IAppointment
TPatient
```

## Booleanos

Los booleanos deberán leerse como preguntas o estados claros.

Ejemplos:

```text
isActive
isCancelled
hasAppointments
hasAccess
canEdit
canCancel
```

## Zod

Los schemas utilizarán el sufijo `Schema`.

Ejemplos:

```text
createAppointmentSchema
updatePatientSchema
cancelAppointmentSchema
```

Archivo:

```text
create-appointment.schema.ts
```

Cuando corresponda, los tipos se inferirán desde Zod:

```ts
type CreateAppointmentInput =
  z.infer<typeof createAppointmentSchema>;
```

## Server Actions

Los adaptadores de Server Actions utilizarán el sufijo `Action`.

Ejemplos:

```text
createAppointmentAction
cancelAppointmentAction
rescheduleAppointmentAction
```

Archivos:

```text
create-appointment.action.ts
cancel-appointment.action.ts
```

Esto permite distinguir:

```text
cancelAppointmentAction
→ adaptador Next.js

cancelAppointment
→ lógica reutilizable del módulo
```

## Queries

Las lecturas usarán verbos explícitos.

Ejemplos:

```text
getAppointmentById
getAppointmentsForDay
getProfessionalAgenda
listActiveSpecialties
```

Convención orientativa:

```text
get...
→ entidad o consulta concreta

list...
→ colección
```

## Dominio

Los archivos de `domain/` deberán describir la regla concreta.

Ejemplos:

```text
calculate-available-slots.ts
can-transition-appointment-status.ts
appointments-overlap.ts
```

Se evitarán archivos genéricos como:

```text
utils.ts
helpers.ts
business-logic.ts
```

salvo que exista una razón real y acotada.

## PostgreSQL

Las tablas y columnas utilizarán `snake_case`.

Tablas, preferentemente en plural:

```text
centers
persons
appointments
specialties
professionals
center_memberships
professional_centers
patient_centers
```

Columnas:

```text
center_id
professional_id
starts_at
ends_at
created_at
updated_at
```

Foreign keys:

```text
<entity>_id
```

Los tipos generados automáticamente por Supabase conservarán naturalmente los nombres provenientes del esquema y no se editarán manualmente.

## Imports

Se utilizará el alias `@/` para imports entre áreas distintas del proyecto.

Ejemplo:

```ts
import { createClient } from "@/lib/supabase/server";
import { getPatientById } from "@/modules/patients";
```

Dentro de una misma zona pequeña podrán usarse imports relativos:

```ts
import { AppointmentCard } from "./appointment-card";
```

Regla:

```text
misma zona / cercanía
→ relativo

otra área del proyecto
→ @/
```

## API pública de los módulos

Los módulos podrán exponer una API pública pequeña mediante `index.ts`.

Ejemplo:

```ts
export { getPatientById } from "./queries/get-patient-by-id";
export type { PatientSummary } from "./types/patient-summary";
```

Otros módulos deberán preferir:

```ts
import { getPatientById } from "@/modules/patients";
```

en lugar de imports profundos a detalles internos.

Los `index.ts` no deberán convertirse en barrels que exporten indiscriminadamente todo el módulo.

## Exports

Para código propio se preferirán **named exports**.

Ejemplo:

```ts
export function AppointmentCard() {}
```

Los `default exports` se reservarán para casos donde Next.js los requiera o espere, por ejemplo:

```text
page.tsx
layout.tsx
error.tsx
```

## Tests

Los tests unitarios y de componentes vivirán junto al código.

Ejemplo:

```text
calculate-available-slots.ts
calculate-available-slots.test.ts
```

Los E2E seguirán separados:

```text
tests/e2e/
```

Los tests deberán describir comportamiento y no detalles internos de implementación.

## Constantes

Las variables normales usarán `camelCase`.

El estilo `UPPER_SNAKE_CASE` se reservará para constantes globales o de configuración realmente inmutables y significativas.

Ejemplos:

```text
MAX_APPOINTMENT_NOTE_LENGTH
DEFAULT_TIMEZONE
```

## Abreviaciones

Se evitarán abreviaciones innecesarias.

Preferido:

```text
appointment
professional
availability
```

Evitar:

```text
appt
prof
avail
```

Se aceptan abreviaturas ampliamente reconocidas:

```text
id
url
api
db
```

## Relación con el harness

Estas convenciones deberán formar parte del contexto operativo del harness.

El Reviewer deberá verificar que:

- los nombres respeten las convenciones;
- no aparezcan archivos genéricos innecesarios;
- los módulos no expongan detalles internos arbitrariamente;
- los tests estén ubicados y nombrados consistentemente.

## Regla final

> La consistencia es más importante que inventar nuevas convenciones para cada módulo.

## Estado

**Aprobado**
