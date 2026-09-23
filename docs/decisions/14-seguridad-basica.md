# 14. Seguridad básica

## Decisión aprobada

**Política básica de seguridad para el MVP**

### Principios generales

La seguridad se implementará en varias capas complementarias:

```text
Supabase Auth
→ identidad

Next.js Server
→ autorización

Zod
→ validación de inputs

Lógica de negocio
→ reglas del dominio

RLS
→ aislamiento entre centros

PostgreSQL
→ integridad y constraints
```

### Secretos y credenciales

- los secretos deberán existir únicamente del lado servidor;
- las credenciales administrativas de Supabase no deberán exponerse al navegador;
- `.env.local` no deberá versionarse;
- las variables `NEXT_PUBLIC_*` solo podrán contener valores seguros para el cliente.
- para Auth Admin se utilizará únicamente `SUPABASE_SECRET_KEY` moderna;
- no se incorporará `SUPABASE_SERVICE_ROLE_KEY` legacy;
- el cliente administrativo usará `supabase-js`, estará marcado `server-only`, separado de clientes
  SSR/browser y tendrá persistencia, auto-refresh y detección de sesión en URL desactivados;
- la secret key sólo podrá usarse para Auth Admin, compensación y bootstrap/reconciliación
  controlada, nunca como vía normal de datos del producto.

### Autorización

Ocultar acciones en la interfaz no se considera una medida de seguridad suficiente.

Toda operación sensible deberá validar en servidor:

- usuario autenticado;
- centro activo;
- membership;
- estado del acceso;
- rol;
- ownership cuando corresponda.

Las operaciones globales validarán separadamente `platform_admins`. Ser PLATFORM_ADMIN no satisface
una membership de centro, y una membership ADMIN no satisface el permiso global.

### Inputs externos

Todo dato proveniente del cliente se considera no confiable.

Esto incluye:

- formularios;
- query params;
- URLs;
- IDs;
- filtros;
- payloads.

Los datos deberán validarse del lado servidor antes de ejecutar reglas de negocio.

### IDs y acceso a recursos

La existencia de un recurso no implica autorización para acceder a él.

Para IDs como:

- `centerId`;
- `patientId`;
- `professionalId`;
- `appointmentId`;

se deberá comprobar que el usuario tenga permiso sobre el recurso dentro del centro correspondiente.

### Row Level Security

Las tablas relevantes con datos multi-centro deberán estar protegidas mediante RLS.

Las políticas concretas se diseñarán cuando se implemente el esquema.

### Contraseñas

Las contraseñas serán administradas únicamente por Supabase Auth.

No se almacenarán contraseñas ni hashes en tablas propias.

La contraseña inicial definida por el Administrador tendrá un mínimo de:

**10 caracteres**

No será obligatorio cambiarla en el primer inicio de sesión.

El mismo mínimo se configurará en Supabase Auth. No se exigirán reglas artificiales de composición.
Los usuarios administrativos se crean con email confirmado server-side y no existe signup público.

### Uploads

Para el logo del centro se aplicarán restricciones de:

- tipo de archivo;
- tamaño máximo;
- ruta generada por la aplicación;
- permisos de modificación.

Inicialmente se aceptarán imágenes como:

- PNG;
- JPG/JPEG;
- WEBP.

El tamaño máximo inicial será de aproximadamente **2 MB**.

### Contenido HTML

Se evitará utilizar HTML arbitrario o `dangerouslySetInnerHTML` con contenido de usuarios.

Si en el futuro existiera una necesidad concreta, deberá evaluarse sanitización adecuada.

### Errores

La interfaz no deberá mostrar:

- stack traces;
- detalles internos de PostgreSQL;
- secretos;
- mensajes técnicos sensibles.

Los mensajes visibles deberán ser seguros y comprensibles.

### Logs

Los logs deberán contener solo el contexto necesario.

Se evitará registrar objetos completos de pacientes, credenciales u otra información sensible innecesaria.

### Rate limiting

El rate limiting se considera obligatorio antes de una exposición pública real para operaciones sensibles.

La herramienta o proveedor concreto se decidirá cuando nos acerquemos a producción.

### Dependencias

Se evitará incorporar dependencias sin una necesidad concreta.

Las dependencias deberán revisarse periódicamente y se podrá utilizar `npm audit` como una señal adicional, sin aplicar actualizaciones ciegas automáticamente.

### Estado

**Aprobado**
