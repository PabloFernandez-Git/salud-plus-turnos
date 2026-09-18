# 36. Capas ligeras dentro de los módulos

Los módulos crecerán de forma progresiva.

Ejemplo:

```text
modules/appointments/
├── components/
├── schemas/
├── queries/
├── actions/
└── domain/
```

No todas las carpetas deben existir desde el inicio.

## Responsabilidades

```text
components
→ UI específica

schemas
→ validación Zod

queries
→ lecturas

actions
→ operaciones que modifican estado

domain
→ reglas de negocio puras
```

## App Router

`src/app/` debe mantenerse delgado y centrado en routing y composición.

La lógica de negocio no debe acumularse dentro de las páginas de Next.js.

## Código global

```text
src/components/
→ componentes reutilizables globales

src/lib/
→ infraestructura compartida, por ejemplo Supabase, auth y utilidades
```

## Tests

Los tests unitarios y de componentes vivirán cerca del código.

Los E2E se mantendrán separados.

## Dependencias entre módulos

Se priorizarán APIs públicas de módulo y se evitarán imports profundos a detalles internos.

Esto mejora encapsulación y facilita el context routing del Agent Harness.
