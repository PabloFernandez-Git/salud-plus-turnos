# Convenciones de código y naming

## Propósito

Mantener el repositorio predecible para personas y agentes.

## Idioma

```text
Código técnico
→ inglés

UI y documentación de producto
→ español
```

## Naming

```text
archivos/carpetas
→ kebab-case

funciones/variables
→ camelCase

componentes/tipos
→ PascalCase

PostgreSQL
→ snake_case
```

## Ejemplos

```text
appointment-card.tsx
create-appointment.action.ts
createAppointmentAction()
AppointmentCard
appointments
starts_at
```

## Booleanos

```text
isActive
hasAccess
canEdit
canCancel
```

## Zod

```text
createAppointmentSchema
CreateAppointmentInput
```

## Server Actions

```text
cancelAppointmentAction()
```

La lógica reutilizable puede ser:

```text
cancelAppointment()
```

## Queries

```text
getAppointmentById()
getAppointmentsForDay()
listActiveSpecialties()
```

## Domain

Usar nombres que describan reglas:

```text
calculate-available-slots.ts
appointments-overlap.ts
can-transition-appointment-status.ts
```

Evitar nombres genéricos como:

```text
utils.ts
helpers.ts
data.ts
business-logic.ts
```

cuando exista una descripción más precisa.

## Imports

```text
misma zona
→ relativo

otra área
→ @/
```

## Módulos

Exponer una API pública pequeña mediante `index.ts` cuando aporte claridad.

Evitar imports profundos a internals de otros módulos.

## Exports

Named exports por defecto.

Default exports solo cuando el framework o una convención concreta lo justifique.

## Tests

Unitarios y componentes junto al código.

E2E en:

```text
tests/e2e/
```

## SQL

Tablas en plural:

```text
appointments
professionals
center_memberships
```

Columnas:

```text
center_id
starts_at
created_at
```

## Regla central

> La consistencia es más importante que inventar nuevas convenciones para cada módulo.
