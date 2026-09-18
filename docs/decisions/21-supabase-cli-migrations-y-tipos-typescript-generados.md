# 21. Supabase CLI, migrations y tipos TypeScript generados

## Decisión aprobada

**Supabase CLI será la herramienta oficial para gestionar la evolución versionada de PostgreSQL y generar los tipos TypeScript derivados del esquema de la base.**

La regla principal será:

> Todo cambio estructural relevante de la base de datos debe quedar representado por una migration SQL versionada en Git antes de considerarse parte del producto.

## ¿Qué problema resuelve?

Sin migrations, una base puede evolucionar mediante cambios manuales realizados desde un panel gráfico.

Eso genera preguntas difíciles de responder:

- ¿qué cambió?;
- ¿cuándo cambió?;
- ¿por qué?;
- ¿DEV y PROD tienen realmente el mismo esquema?;
- ¿cómo recreamos la base desde cero?;
- ¿cómo revisa otro desarrollador o agente el cambio?

Las migrations convierten la evolución de PostgreSQL en parte explícita del código fuente.

## Supabase CLI

Supabase CLI será la herramienta de terminal que conectará el repositorio con nuestro flujo de trabajo de Supabase.

En este proyecto la utilizaremos principalmente para:

- trabajar con migrations;
- aplicar cambios controlados al entorno DEV;
- mantener sincronizado el esquema;
- generar tipos TypeScript desde PostgreSQL.

Adoptar Supabase CLI **no implica** que debamos utilizar Supabase Local desde el primer día.

## Migrations SQL

Las migrations vivirán versionadas en:

```text
supabase/
└── migrations/
```

Ejemplo conceptual:

```text
20260918103000_create_appointments.sql
20260918111500_add_status_to_appointments.sql
```

Una migration podrá contener, según corresponda:

```text
CREATE TABLE
ALTER TABLE
FOREIGN KEY
UNIQUE
CHECK
INDEX
RLS
POLICY
FUNCTION
TRIGGER
```

La intención es que la historia del esquema pueda reconstruirse leyendo y aplicando estos archivos en orden.

### Regla sobre migrations ya aplicadas

Una migration que ya fue aplicada y compartida no deberá editarse para "corregir el pasado".

Si necesitamos modificar algo, se crea una nueva migration.

```text
migration aplicada
↓
aparece un nuevo cambio
↓
nueva migration
```

Esto preserva una historia reproducible.

## Flujo DEV → PROD

El flujo esperado será:

```text
crear migration SQL
↓
versionarla en Git
↓
aplicarla en Supabase DEV
↓
probar aplicación y reglas
↓
regenerar tipos TypeScript
↓
review + CI
↓
aplicar a Supabase PROD de forma controlada
```

No se copiarán manualmente cambios de esquema desde DEV hacia PROD.

## Protección de producción

Los agentes podrán preparar migrations y trabajar contra DEV cuando la tarea lo requiera.

**No podrán aplicar migrations automáticamente a PROD.**

Los cambios de producción requerirán una acción explícita y controlada una vez revisados.

Esto reduce el riesgo de ejecutar por accidente un cambio destructivo en la base real.

## Tipos TypeScript generados

Supabase generará un archivo TypeScript a partir del esquema real de PostgreSQL.

Ubicación prevista:

```text
src/lib/supabase/database.types.ts
```

Este archivo será generado, no mantenido manualmente.

Permitirá que TypeScript conozca:

- tablas;
- columnas;
- tipos;
- nulabilidad;
- relaciones representadas por el esquema generado.

## ¿Por qué versionar el archivo generado?

`database.types.ts` quedará en Git.

Esto permite:

- utilizar los tipos en CI sin tener que conectarse a Supabase durante cada chequeo;
- revisar en un diff qué cambió en el contrato de datos;
- permitir que Codex y otros agentes inspeccionen el esquema tipado;
- detectar código incompatible después de una migration.

Se utilizará un script del proyecto, conceptualmente:

```text
npm run db:types
```

para regenerarlo.

## Los tipos generados no reemplazan Zod

Cada herramienta cumple una función diferente:

```text
PostgreSQL / migrations
→ estructura e integridad persistente

Tipos generados de Supabase
→ representación TypeScript del esquema de DB

Zod
→ validación de inputs en tiempo de ejecución

Tipos de dominio
→ conceptos propios del negocio cuando sean necesarios
```

No se duplicarán tipos manualmente si pueden inferirse de forma segura desde Zod o desde el esquema generado.

## Relación con el Agent Harness

Cuando una tarea tenga impacto en base de datos, el Task Brief deberá marcarlo explícitamente.

Flujo esperado:

```text
Orchestrator
↓
detecta Database impact

Implementer
↓
crea migration
↓
aplica en DEV
↓
regenera database.types.ts
↓
actualiza código/tests

Reviewer
↓
revisa SQL
↓
revisa constraints/RLS
↓
revisa tipos generados
↓
verifica que PROD no haya sido modificado automáticamente
```

Para cambios delicados podrán intervenir especialistas de Database/RLS o Security.

## Estado

**Aprobado**
