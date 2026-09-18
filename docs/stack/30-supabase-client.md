# 30. Supabase Client

## ¿Qué es?

Supabase Client es la librería que utilizaremos como vía principal para consultar y modificar datos desde Next.js.

Ejemplo conceptual:

```ts
const { data } = await supabase
  .from("appointments")
  .select("*")
  .eq("status", "PENDING");
```

La consulta sigue terminando en PostgreSQL.

## ¿Por qué lo elegimos?

Encaja directamente con decisiones ya tomadas:

```text
Supabase Auth
+
Supabase Client
+
PostgreSQL
+
RLS
```

Esto permite que la identidad del usuario y las políticas de acceso de la base trabajen de manera coherente.

## ¿Reemplaza aprender SQL?

No.

SQL seguirá siendo una parte central del proyecto.

Lo utilizaremos para:

- definir el esquema;
- crear migrations;
- establecer relaciones;
- crear constraints;
- diseñar índices;
- escribir políticas RLS;
- implementar funciones PostgreSQL cuando sea conveniente.

La regla será:

```text
Supabase Client
→ acceso cotidiano

SQL / PostgreSQL
→ estructura, integridad y operaciones complejas
```

## Operaciones complejas

Si una operación requiere garantías atómicas, transacciones o lógica cercana a la base, podremos implementarla en PostgreSQL y llamarla mediante RPC.

Ejemplo futuro:

```text
crear turno
↓
rpc("book_appointment")
↓
validaciones y operación atómica en PostgreSQL
```

## ¿Por qué no usamos un ORM ahora?

No incorporaremos Prisma ni Drizzle inicialmente porque no existe una necesidad concreta que justifique otra capa.

Si el proyecto crece y aparece una razón real, podrán evaluarse nuevamente.
