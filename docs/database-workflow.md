# Flujo de base de datos

## Propósito

Este documento es una referencia pedagógica rápida sobre cómo evolucionaremos PostgreSQL en Salud Plus — Gestión de Turnos.

## Modelo mental

```text
PostgreSQL
→ almacena y protege los datos

Migrations SQL
→ describen cada cambio estructural

Git
→ conserva la historia

Supabase DEV
→ lugar donde probamos primero

database.types.ts
→ refleja el esquema en TypeScript

Zod
→ valida inputs en runtime

Supabase PROD
→ recibe únicamente cambios ya revisados
```

## Flujo normal

```text
Necesidad de producto
↓
Diseñar cambio de datos
↓
Crear migration SQL
↓
Versionar en Git
↓
Aplicar en DEV
↓
Regenerar database.types.ts
↓
Actualizar aplicación
↓
Tests + typecheck + review
↓
Aplicación controlada a PROD
```

## Reglas esenciales

1. Los cambios estructurales deben existir como migrations en Git.
2. No editar migrations que ya fueron aplicadas y compartidas; crear una nueva.
3. DEV es el primer destino de los cambios.
4. Los agentes no aplican migrations automáticamente a PROD.
5. `database.types.ts` es generado y no se edita manualmente.
6. Los tipos generados no reemplazan Zod.
7. No necesitamos Supabase Local para comenzar; podrá incorporarse más adelante.

## ¿Por qué?

Porque queremos que la base de datos sea tan reproducible y revisable como el código de la aplicación.
