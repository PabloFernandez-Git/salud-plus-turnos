# 31. Seguridad básica del MVP

La seguridad del proyecto se basará en capas complementarias.

```text
Auth
→ quién es el usuario

Autorización server-side
→ qué puede hacer

Zod
→ si el input es válido

RLS
→ qué filas puede acceder

PostgreSQL
→ integridad de los datos
```

## Secretos

Las credenciales sensibles solo existirán del lado servidor.

Nunca se expondrán claves administrativas mediante variables públicas.

## Inputs

Todo input externo se considera no confiable y debe validarse nuevamente en servidor.

## IDs

Un ID válido no equivale a un recurso autorizado.

Siempre se comprobará que el usuario tenga acceso al centro y al recurso solicitado.

## Contraseñas

Supabase Auth será el único responsable de almacenar credenciales.

La contraseña inicial creada por un Administrador tendrá un mínimo de 10 caracteres.

El usuario no estará obligado a cambiarla en su primer acceso.

## Uploads

Los archivos se validarán por tipo y tamaño.

Para el logo del centro se aceptarán inicialmente imágenes PNG, JPG/JPEG o WEBP de hasta aproximadamente 2 MB.

## Errores y logs

Los errores visibles al usuario no expondrán detalles internos.

Los logs deberán evitar información sensible innecesaria.

## Rate limiting

Las operaciones sensibles deberán incorporar rate limiting antes de una exposición pública real.

La implementación concreta se decidirá más adelante.

## Dependencias

Se evitará incorporar paquetes sin una necesidad real.

Las dependencias forman parte de la superficie de seguridad y mantenimiento del proyecto.
