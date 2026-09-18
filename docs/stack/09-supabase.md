# 9. Supabase

## ¿Qué es?

Supabase es una plataforma que ofrece servicios backend administrados.

Entre ellos:

- PostgreSQL administrado;
- autenticación;
- almacenamiento de archivos;
- APIs y herramientas de administración.

La base de datos sigue siendo PostgreSQL.

## ¿Por qué lo elegimos?

Queremos concentrarnos en construir el producto sin tener que administrar desde el primer día:

- servidores;
- instalación de PostgreSQL;
- infraestructura;
- backups;
- servicios separados para cada necesidad.

Supabase nos permite comenzar con menos piezas de infraestructura.

## ¿Qué parte usamos seguro desde ahora?

La decisión aprobada es:

- Supabase como plataforma para alojar PostgreSQL.

La posible utilización de:

- Supabase Auth;
- Supabase Storage;

se decidirá por separado.

## ¿Es gratuito?

Supabase dispone de un plan gratuito adecuado para comenzar un proyecto de portfolio y desarrollar el MVP.

Si el producto creciera considerablemente, podría requerir un plan pago.

## ¿Nos ata a Supabase?

Queremos evitar un acoplamiento innecesario.

El modelo de dominio debe seguir representándose de forma clara en PostgreSQL.

Supabase será la infraestructura elegida inicialmente, no la definición del producto.

---
