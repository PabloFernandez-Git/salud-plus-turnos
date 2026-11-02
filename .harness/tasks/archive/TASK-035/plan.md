# Plan TASK-035

## B1 — Base de datos

Crear `admin_update_center_settings` con lock de centro, autorización tenant, validación, CAS `updated_at` y retorno persistido. Revocar EXECUTE implícito y conceder sólo a `authenticated`. Preparar prueba SQL focal y ejecutarla únicamente sobre PostgreSQL local aislado e identificado, si está disponible.

## B2 — Aplicación

Extraer reglas institucionales compartidas sin cambiar el comportamiento del alta. Crear query, servicio y Server Action con cliente de sesión, validación, autorización, errores seguros y revalidación. Añadir tests focales.

## B3 — Interfaz

Crear ruta ADMIN y formulario responsive con datos actuales, dirty semántico, validación por campo, éxito, errores, conflicto, descarte y zona horaria readonly. Añadir navegación ADMIN y tests focales. Verificar TypeScript, ESLint, Prettier focal y diff.

## Fases posteriores

Fase C: validación funcional Next.js, navegación, formulario y persistencia sólo en entorno expresamente autorizado. Fase D: suite completa, revisión independiente y gate final. No ejecutarlas en Fase B.
