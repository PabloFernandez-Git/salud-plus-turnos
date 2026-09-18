# Seeds y datos de desarrollo

## Propósito

Preparar escenarios reproducibles para desarrollar y revisar la aplicación.

## Diferencias

```text
Migration
→ cambia la estructura de PostgreSQL

Seed
→ crea datos ficticios de desarrollo

Fixture / builder
→ crea datos para un test concreto
```

## Implementación prevista

```text
scripts/seed-dev.ts
```

Comando:

```text
pnpm db:seed:dev
```

## Destino

```text
Supabase DEV
```

Nunca PROD.

El script debe verificar el destino antes de modificar datos.

## Datos

Dataset pequeño y deliberado:

```text
Centro Demo
usuarios demo
roles
profesionales
especialidades
disponibilidad
pacientes ficticios
turnos con distintos estados
```

Debe cubrir escenarios útiles de agenda.

## Auth

El script TypeScript podrá utilizar Supabase Admin para crear usuarios DEV y relacionarlos con:

```text
User
CenterMembership
Professional
```

## Idempotencia

Ejecutarlo más de una vez no debería crear duplicados evidentes.

## Seguridad

Nunca usar:

```text
datos reales
emails personales
documentos reales
credenciales productivas
```

Las contraseñas DEV pueden vivir en `.env.local`.

No deben aparecer en logs.

## Testing

```text
Seed DEV
→ desarrollo manual

Fixtures / builders
→ tests

E2E setup
→ estrategia separada futura
```

## Reset

No habrá reset destructivo remoto en la v1.

## Regla central

> Un seed construye escenarios de desarrollo reproducibles; no modifica datos reales.
