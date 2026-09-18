# 14. Supabase Row Level Security (RLS)

## ¿Qué es?

RLS es una capacidad de PostgreSQL que permite restringir qué filas puede consultar o modificar un usuario.

En nuestro caso la utilizaremos principalmente para proteger el aislamiento entre centros.

Ejemplo:

```text
Usuario con acceso a Centro A
→ puede consultar datos de Centro A
→ no puede consultar datos de Centro B
```

## ¿Por qué usar RLS además de Next.js?

Porque agrega una segunda capa de seguridad.

Aunque hubiera un error en una validación del servidor, la base de datos puede seguir impidiendo el acceso a filas de otro centro.

Esto se conoce como defensa en profundidad.

## ¿RLS manejará todos los permisos?

No.

Para mantener el proyecto comprensible:

- Next.js server-side → permisos y reglas de acción;
- RLS → aislamiento de datos entre centros.

No queremos repartir toda la lógica de negocio entre código TypeScript y políticas SQL complejas.
