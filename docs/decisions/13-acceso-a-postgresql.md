# 13. Acceso a PostgreSQL

## Decisión aprobada

**Supabase Client como mecanismo principal de acceso a datos desde Next.js**

### Enfoque general

La aplicación utilizará Supabase Client para las consultas habituales sobre PostgreSQL.

La arquitectura conceptual será:

```text
React
↓
Next.js Server
↓
Supabase Client
↓
PostgreSQL
↓
RLS
```

### Motivos principales

- integración natural con Supabase Auth;
- integración directa con Row Level Security;
- menor complejidad inicial;
- buen soporte para TypeScript mediante tipos generados;
- evita incorporar un ORM sin una necesidad concreta;
- mantiene una buena velocidad de desarrollo para el MVP.

### Rol de SQL

La elección de Supabase Client no reemplaza el uso de SQL ni el aprendizaje de PostgreSQL.

SQL seguirá utilizándose para:

- migrations;
- creación y modificación de tablas;
- foreign keys;
- constraints;
- índices;
- políticas RLS;
- funciones PostgreSQL;
- operaciones complejas o transaccionales cuando sea necesario.

### Operaciones complejas

Cuando una operación requiera lógica atómica o transaccional compleja, podrá implementarse como una función de PostgreSQL y llamarse mediante RPC desde Supabase Client.

Ejemplo conceptual:

```text
Supabase Client
↓
rpc("book_appointment")
↓
PostgreSQL
```

### Clientes privilegiados

Las operaciones administrativas que requieran credenciales privilegiadas deberán utilizar un cliente separado y ejecutarse únicamente del lado servidor.

Las credenciales administrativas nunca deberán exponerse al navegador.

### ORM

No se incorporarán inicialmente:

- Prisma;
- Drizzle;
- otro ORM.

Podrán reevaluarse en el futuro si aparecen necesidades concretas que justifiquen agregar otra capa.

### Estado

**Aprobado**
