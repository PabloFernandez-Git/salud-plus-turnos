# 41. Convenciones de código y naming

Esta sección funciona como guía práctica para mantener un estilo uniforme.

---

## 41.1. Idioma

```text
Código técnico
→ inglés

UI
→ español

Documentación de producto / pedagógica
→ español
```

Ejemplo correcto:

```ts
const appointment = await getAppointmentById(id);
```

Texto visible:

```text
"Turno confirmado"
```

Evitar mezclar idiomas dentro de un mismo identificador.

---

## 41.2. Tabla rápida

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| archivo | kebab-case | `appointment-card.tsx` |
| carpeta | kebab-case | `professional-centers/` |
| variable | camelCase | `activeCenter` |
| función | camelCase | `getPatientById()` |
| componente | PascalCase | `AppointmentCard` |
| tipo | PascalCase | `AppointmentSummary` |
| booleano | pregunta/estado | `isActive`, `canEdit` |
| schema Zod | camelCase + Schema | `createAppointmentSchema` |
| Server Action | camelCase + Action | `cancelAppointmentAction` |
| tabla SQL | snake_case plural | `appointments` |
| columna SQL | snake_case | `starts_at` |

---

## 41.3. Nombres específicos

Preferir:

```text
getAppointmentsForDay
calculateAvailableSlots
canTransitionAppointmentStatus
```

Evitar:

```text
getData
process
handleStuff
utils
helpers
```

Un nombre específico reduce el contexto necesario para entender el código.

---

## 41.4. Archivos

Ejemplo:

```text
appointment-card.tsx
create-appointment.action.ts
create-appointment.schema.ts
get-appointment-by-id.ts
calculate-available-slots.ts
```

El nombre del archivo debería permitir inferir qué contiene sin abrirlo.

---

## 41.5. Componentes y tipos

```ts
AppointmentCard
PatientForm
ProfessionalCenter
AppointmentStatus
```

No usaremos:

```ts
IAppointment
TPatient
```

porque el prefijo no aporta información útil.

---

## 41.6. Booleanos

Buenos ejemplos:

```ts
isActive
isCancelled
hasAccess
hasAppointments
canEdit
canCancel
```

Esto permite escribir condiciones que se leen naturalmente:

```ts
if (canCancelAppointment) {
  ...
}
```

---

## 41.7. Zod

Schema:

```ts
createAppointmentSchema
```

Archivo:

```text
create-appointment.schema.ts
```

Tipo derivado:

```ts
type CreateAppointmentInput =
  z.infer<typeof createAppointmentSchema>;
```

Esto evita duplicar manualmente la forma del input.

---

## 41.8. Actions

Una Server Action tiene un nombre explícito:

```ts
createAppointmentAction()
cancelAppointmentAction()
```

La operación de negocio reutilizable puede llamarse:

```ts
createAppointment()
cancelAppointment()
```

La diferencia visual ayuda a saber qué capa estamos leyendo.

---

## 41.9. Queries

Ejemplos:

```ts
getAppointmentById()
getAppointmentsForDay()
getProfessionalAgenda()
listActiveSpecialties()
```

Regla orientativa:

```text
get
→ consulta concreta

list
→ conjunto de entidades
```

No es una regla matemática; su objetivo es mejorar legibilidad.

---

## 41.10. Domain

Dentro de:

```text
domain/
```

preferimos nombres que representen reglas:

```text
calculate-available-slots.ts
appointments-overlap.ts
can-transition-appointment-status.ts
```

La lógica del negocio debería poder encontrarse por su nombre.

---

## 41.11. PostgreSQL

En SQL utilizamos:

```text
snake_case
```

Tablas:

```text
appointments
patients
professionals
professional_centers
center_memberships
```

Columnas:

```text
center_id
starts_at
created_at
```

Esto genera una frontera clara:

```text
TypeScript
→ camelCase / PascalCase

PostgreSQL
→ snake_case
```

Los tipos generados por Supabase no se modifican manualmente para cambiar esa convención.

---

## 41.12. Imports

Entre áreas:

```ts
import { getPatientById } from "@/modules/patients";
```

Dentro de la misma carpeta:

```ts
import { AppointmentCard } from "./appointment-card";
```

Regla:

```text
cercanía
→ relativo

otra área
→ @/
```

---

## 41.13. API pública del módulo

Un módulo puede exponer una superficie pequeña:

```text
modules/patients/index.ts
```

Ejemplo:

```ts
export { getPatientById } from "./queries/get-patient-by-id";
```

Entonces otros módulos consumen:

```ts
import { getPatientById } from "@/modules/patients";
```

y no conocen necesariamente cómo está organizado internamente `patients`.

Esto ayuda a reducir acoplamiento.

---

## 41.14. Named exports

Preferimos:

```ts
export function AppointmentCard() {}
```

sobre:

```ts
export default function AppointmentCard() {}
```

porque el nombre exportado forma parte explícita del contrato.

Excepciones:

```text
page.tsx
layout.tsx
error.tsx
```

y otros archivos donde Next.js utilice `default export` por convención.

---

## 41.15. Tests

Unitarios y componentes:

```text
calculate-available-slots.ts
calculate-available-slots.test.ts
```

E2E:

```text
tests/e2e/
```

El nombre del test debe describir comportamiento.

Preferido:

```text
excludes slots already occupied by an appointment
```

Evitar:

```text
calls filter
```

---

## 41.16. Constantes

No toda variable `const` necesita mayúsculas.

Normal:

```ts
const patientId = ...
```

Constante global/configuración:

```ts
const DEFAULT_TIMEZONE = ...
const MAX_APPOINTMENT_NOTE_LENGTH = ...
```

---

## 41.17. Abreviaciones

Preferimos palabras completas:

```text
appointment
professional
availability
```

sobre:

```text
appt
prof
avail
```

Excepciones razonables:

```text
id
api
url
db
```

---

## 41.18. Ejemplo completo

```text
src/modules/appointments/
├── components/
│   ├── appointment-card.tsx
│   └── appointment-form.tsx
├── schemas/
│   └── create-appointment.schema.ts
├── actions/
│   ├── create-appointment.action.ts
│   └── cancel-appointment.action.ts
├── queries/
│   ├── get-appointment-by-id.ts
│   └── get-appointments-for-day.ts
├── domain/
│   ├── calculate-available-slots.ts
│   ├── calculate-available-slots.test.ts
│   └── can-transition-appointment-status.ts
└── index.ts
```

Base:

```text
appointments
├── id
├── center_id
├── patient_center_id
├── professional_center_id
├── specialty_id
├── starts_at
├── ends_at
├── status
├── created_at
└── updated_at
```

---

## 41.19. Regla mental

```text
Código
→ inglés y nombres explícitos

Archivos
→ kebab-case

TypeScript
→ camelCase / PascalCase

PostgreSQL
→ snake_case

Módulos
→ superficie pública pequeña

Tests
→ cerca del código

Exports
→ named por defecto
```

La intención no es imponer estilo por estética.

La intención es que cualquier persona o agente pueda predecir dónde está algo y cómo debería llamarse.
