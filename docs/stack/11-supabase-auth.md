# 11. Supabase Auth

## ¿Qué es?

Supabase Auth es el sistema de autenticación de Supabase.

Se encargará de verificar quién es el usuario mediante:

- email;
- contraseña.

También administrará:

- sesiones;
- recuperación de contraseña;
- cambio de contraseña.

## ¿Por qué lo elegimos?

Ya utilizamos Supabase como plataforma para PostgreSQL.

Usar también Supabase Auth evita incorporar otro proveedor de autenticación sin una necesidad concreta.

Nuestro MVP necesita un flujo simple de acceso:

email + contraseña  
→ usuario autenticado  
→ aplicación

Supabase Auth cubre correctamente ese escenario.

## ¿Qué NO resuelve?

Supabase Auth responde principalmente:

> ¿Quién sos?

No define por sí solo:

- a qué centro puede acceder el usuario;
- qué rol tiene en cada centro;
- qué acciones puede realizar.

Eso pertenece a nuestro modelo de aplicación y se resolverá en la etapa de autorización.

## ¿Cómo se relaciona con nuestros usuarios?

Podemos pensar dos niveles:

```text
Supabase Auth
→ identidad y credenciales

Aplicación
→ usuario, centros, roles y permisos
```

Una misma cuenta autenticada puede tener acceso a varios centros.

---
