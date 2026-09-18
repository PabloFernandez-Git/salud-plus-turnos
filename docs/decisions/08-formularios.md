# 8. Formularios

## Decisión aprobada

**React Hook Form + Zod para los formularios de negocio e interactivos**

### Criterio de uso

React Hook Form será la librería principal para administrar formularios que necesiten:

- múltiples campos;
- validaciones;
- errores;
- estados de envío;
- edición;
- selects;
- checkboxes;
- campos dinámicos;
- valores iniciales.

Zod seguirá siendo la fuente principal de validación de inputs.

### Formularios simples

No será obligatorio utilizar React Hook Form para todos los formularios.

Cuando un formulario sea suficientemente simple, podrá utilizarse:

- HTML nativo;
- FormData;
- Server Actions de Next.js;

siempre que esto mantenga el código más claro y simple.

### Integración

La combinación será:

```text
shadcn/ui
→ componentes visuales

React Hook Form
→ estado y comportamiento del formulario

Zod
→ validación

Next.js Server
→ autorización y reglas de negocio

PostgreSQL
→ persistencia e integridad
```

### Cliente y servidor

La validación en el cliente se utilizará para mejorar la experiencia de usuario.

Las operaciones que modifican datos deberán volver a validar sus inputs en el servidor.

### Estado

**Aprobado**
