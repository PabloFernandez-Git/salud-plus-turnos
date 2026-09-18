# 38. Supabase CLI, migrations y tipos generados

Esta sección explica el flujo de base de datos con suficiente detalle como para poder retomarlo más adelante aunque no recordemos las decisiones originales.

---

## 38.1. Idea fundamental: la base también es código

Cuando desarrollamos una aplicación, no solo cambia TypeScript.

También cambia la estructura de PostgreSQL:

```text
nuevas tablas
nuevas columnas
relaciones
constraints
índices
RLS
funciones
```

Si esos cambios se realizan únicamente desde un panel gráfico, la base queda separada de la historia del proyecto.

Queremos lo contrario:

```text
Código de aplicación
+
Cambios de base
+
Tests
+
Documentación
↓
Git
```

Por eso usamos migrations.

---

## 38.2. ¿Qué es una migration?

Una migration es un archivo SQL que describe un cambio concreto en la base.

Supongamos que tenemos:

```sql
CREATE TABLE specialties (
  id uuid PRIMARY KEY,
  name text NOT NULL
);
```

Y después decidimos que una especialidad puede estar activa o inactiva.

En lugar de entrar a Supabase y agregar la columna manualmente sin dejar rastro, creamos una nueva migration:

```text
supabase/
└── migrations/
    └── 20260918111500_add_active_to_specialties.sql
```

con algo conceptualmente parecido a:

```sql
ALTER TABLE specialties
ADD COLUMN active boolean NOT NULL DEFAULT true;
```

Ese archivo se guarda en Git.

Ahora podemos saber exactamente:

```text
qué cambió
+
cuándo
+
cómo recrearlo
```

---

## 38.3. ¿Por qué esto es mejor que modificar DEV y PROD manualmente?

Imaginemos este flujo:

```text
DEV
→ agregamos una columna desde el dashboard

dos semanas después

PROD
→ intentamos recordar qué habíamos cambiado
```

Es fácil olvidar:

```text
una constraint
un índice
una policy RLS
un default
una función
```

Con migrations:

```text
Git
↓
migrations
↓
DEV
↓
validación
↓
PROD
```

DEV y PROD evolucionan utilizando la misma historia versionada.

---

## 38.4. ¿Qué es Supabase CLI?

CLI significa **Command Line Interface**.

Supabase CLI es la herramienta que nos permite trabajar con Supabase desde la terminal y desde el repositorio.

En nuestro proyecto la utilizaremos sobre todo para:

```text
crear/administrar migrations
aplicar migrations a DEV
generar tipos TypeScript
trabajar de forma reproducible con el esquema
```

Esto no significa que abandonemos el dashboard de Supabase.

El dashboard puede ser útil para inspeccionar datos, logs o configuración.

La diferencia es que:

> **los cambios estructurales que definen el producto deben quedar versionados en el repositorio.**

---

## 38.5. ¿Qué puede contener una migration?

Mucho más que crear tablas.

Por ejemplo:

```text
CREATE TABLE
→ crear una tabla

ALTER TABLE
→ modificar una tabla

FOREIGN KEY
→ expresar relaciones

UNIQUE
→ impedir duplicados

CHECK
→ imponer reglas simples de integridad

INDEX
→ mejorar búsquedas concretas

RLS / POLICY
→ proteger acceso a filas

FUNCTION
→ lógica PostgreSQL cuando sea necesaria

TRIGGER
→ reacción automática a determinados cambios
```

Ejemplo futuro:

```sql
CREATE INDEX ...
```

podría acelerar consultas frecuentes de agenda.

Otro ejemplo:

```sql
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
```

forma parte de nuestra seguridad multi-centro.

---

## 38.6. Una migration aplicada se considera historia

Esta regla es importante.

Supongamos que tenemos:

```text
001_create_patients.sql
```

La aplicamos en DEV, se comparte en Git y eventualmente llega a PROD.

Después descubrimos que necesitamos otra columna.

No editamos silenciosamente `001_create_patients.sql`.

Creamos:

```text
002_add_phone_to_patients.sql
```

¿Por qué?

Porque distintas bases pueden haber aplicado ya la primera versión.

Si reescribimos el pasado, dejamos de tener una historia reproducible.

La idea es:

```text
Migration 1
↓
Migration 2
↓
Migration 3
↓
estado actual
```

---

## 38.7. Nuestro flujo con DEV y PROD

Ya decidimos tener dos proyectos Supabase:

```text
Supabase DEV
Supabase PROD
```

El recorrido será:

```text
1. necesitamos cambiar la base
↓
2. creamos migration SQL
↓
3. migration entra en Git
↓
4. se aplica en DEV
↓
5. probamos
↓
6. regeneramos tipos TypeScript
↓
7. lint / typecheck / tests / build
↓
8. review
↓
9. cambio controlado en PROD
```

El orden puede adaptarse durante el desarrollo, pero el principio no cambia:

> **PROD no es el lugar donde descubrimos si una migration funciona.**

---

## 38.8. ¿Qué pasa con Supabase Local?

Supabase permite ejecutar una infraestructura local de desarrollo.

Eso puede ser muy útil en proyectos más maduros para:

```text
tests aislados
CI
reset reproducible de base
desarrollo sin depender de DEV remoto
```

Pero hemos decidido **no hacerlo requisito de la v1**.

Inicialmente:

```text
desarrollo local de Next.js
↓
Supabase DEV remoto
```

y las migrations siguen viviendo en Git.

Si más adelante necesitamos mayor aislamiento, podremos incorporar Supabase Local sin cambiar el principio de migrations.

---

## 38.9. ¿Qué son los tipos TypeScript generados?

PostgreSQL conoce el esquema real de nuestra base.

Por ejemplo:

```text
appointments

id         uuid
center_id  uuid
starts_at  timestamptz
status     text
```

Supabase puede transformar ese conocimiento en tipos TypeScript.

Conceptualmente:

```ts
type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          center_id: string;
          starts_at: string;
          status: string;
        };
      };
    };
  };
};
```

Guardaremos el resultado en:

```text
src/lib/supabase/database.types.ts
```

---

## 38.10. ¿Para qué sirven esos tipos?

Permiten conectar:

```text
PostgreSQL
↓
Supabase
↓
TypeScript
```

Si el esquema dice que existe:

```text
starts_at
```

nuestro código puede conocerlo.

Si una migration cambia una columna y regeneramos los tipos, TypeScript puede ayudarnos a descubrir qué partes del código quedaron desactualizadas.

Ejemplo conceptual:

```text
migration cambia DB
↓
npm run db:types
↓
database.types.ts cambia
↓
npm run typecheck
↓
aparecen incompatibilidades
```

Es una forma de obtener feedback rápido antes de encontrar el problema funcionando en producción.

---

## 38.11. ¿Por qué guardar un archivo generado en Git?

A primera vista puede parecer extraño guardar algo que puede regenerarse.

En este caso tiene ventajas claras:

```text
CI puede usarlo sin conectarse a Supabase
Codex puede inspeccionarlo
un desarrollador lo recibe al clonar
el Pull Request muestra cambios del esquema tipado
```

Por eso versionaremos:

```text
src/lib/supabase/database.types.ts
```

aunque sea generado automáticamente.

La regla será:

> **No editar manualmente el archivo generado. Regenerarlo desde el esquema.**

---

## 38.12. Tipos generados vs Zod

Es fácil confundirlos, pero resuelven problemas diferentes.

### Tipos generados de Supabase

Nos dicen cómo es la base:

```text
¿Qué columnas existen?
¿Qué puede ser null?
¿Qué tipo tiene una fila?
```

### Zod

Valida datos reales que entran a una operación:

```text
¿el nombre está vacío?
¿la fecha tiene formato válido?
¿la observación supera el máximo?
```

TypeScript desaparece en runtime.

Zod sí puede rechazar un input mientras la aplicación está funcionando.

Por eso necesitamos ambos.

---

## 38.13. Tipos de dominio

Tampoco queremos utilizar una fila completa de PostgreSQL como modelo universal de toda la aplicación.

Por ejemplo:

```text
Database Row
```

puede incluir campos técnicos que una pantalla no necesita.

Un caso de uso puede trabajar con:

```text
AppointmentSummary
AvailableSlot
CreateAppointmentInput
```

Estos conceptos pueden:

- inferirse desde Zod;
- componerse desde tipos generados;
- definirse como tipos de dominio si realmente aportan claridad.

La regla es evitar duplicar estructuras porque sí.

---

## 38.14. Ejemplo de una tarea real

Tarea:

```text
Agregar estado INACTIVE a Specialties
```

El harness debería pensar:

```text
Database impact: sí
```

### Implementer

```text
crea migration
↓
aplica en DEV
↓
regenera database.types.ts
↓
actualiza queries/actions/UI
↓
actualiza tests
```

### Reviewer

revisa:

```text
¿la migration representa correctamente el cambio?
¿hay un default razonable?
¿se preservan datos existentes?
¿afecta RLS?
¿faltan constraints?
¿los tipos fueron regenerados?
¿los tests cubren el nuevo comportamiento?
```

---

## 38.15. ¿Qué puede hacer un agente?

El harness puede ayudar mucho con la base, pero debemos poner límites.

Permitido durante una tarea:

```text
crear migrations
revisar SQL
aplicar cambios a DEV
regenerar tipos
correr tests
proponer índices/constraints
```

No permitido automáticamente:

```text
aplicar migrations a PROD
borrar/resetear PROD
modificar datos reales destructivamente
exponer credenciales
```

Producción requiere una acción explícita y controlada.

---

## 38.16. Comandos del proyecto

No queremos que cada agente tenga que recordar comandos largos de Supabase.

Crearemos wrappers mediante `package.json`.

Como mínimo está previsto:

```text
npm run db:types
```

Y podremos incorporar comandos explícitos para migrations DEV cuando configuremos físicamente el repositorio.

Evitaremos nombres ambiguos que puedan ocultar si una operación apunta a DEV o PROD.

---

## 38.17. Resumen mental

Si en el futuro solo recordamos una idea de esta sección, debería ser esta:

```text
Cambiar PostgreSQL
↓
escribir migration SQL
↓
guardar en Git
↓
probar en DEV
↓
regenerar tipos
↓
typecheck + tests + review
↓
recién después PROD
```

Y:

```text
PostgreSQL
→ protege y persiste datos

Migrations
→ describen cómo evoluciona PostgreSQL

Supabase CLI
→ herramienta para operar ese workflow

database.types.ts
→ conecta el esquema con TypeScript

Zod
→ valida los datos que entran en runtime
```

Este enfoque fue elegido porque hace que la base sea **reproducible, revisable, auditable y comprensible**, tanto para nosotros como para los agentes del harness.
