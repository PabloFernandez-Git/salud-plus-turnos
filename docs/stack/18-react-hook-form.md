# 18. React Hook Form

## ¿Qué es?

React Hook Form es una librería para administrar el estado y comportamiento de formularios en React.

Ayuda a manejar:

- valores;
- errores;
- campos tocados;
- envío;
- reset;
- edición;
- campos dinámicos.

## ¿Por qué lo elegimos?

Nuestro producto tendrá muchos formularios administrativos:

- centro;
- usuarios;
- profesionales;
- especialidades;
- pacientes;
- disponibilidad;
- turnos.

Varios de ellos tendrán suficiente complejidad como para justificar una librería dedicada.

React Hook Form reduce código repetitivo y se integra bien con Zod.

## Integración con Zod

La idea será:

```text
Formulario
→ React Hook Form
→ Zod
→ errores o datos válidos
```

Zod seguirá definiendo las reglas de validación.

React Hook Form se encargará del estado y del flujo del formulario.

## Integración con shadcn/ui

La separación conceptual será:

```text
shadcn/ui
→ apariencia

React Hook Form
→ comportamiento

Zod
→ validación
```

## ¿Se utilizará siempre?

No.

Los formularios muy simples podrán resolverse con HTML, FormData o Server Actions de Next.js cuando eso sea más claro.

La regla será:

```text
Formulario simple
→ solución simple

Formulario de negocio
→ React Hook Form + Zod
```

## Validación del servidor

La validación en el navegador mejora la experiencia de usuario, pero no reemplaza la validación del servidor.

Las operaciones que modifiquen datos volverán a validar el input con Zod antes de ejecutar reglas de negocio o persistir información.
