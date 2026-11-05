# TASK-036 — Unificar el diseño del login V1

**Base:** `origin/main` `afd502dc2b45ac5be303b22efd51f6cd521b54c9`. **Rama:** `codex/v1-login-unified`.

## Objetivo

Aplicar al login de V1 la composición visual ya aprobada en `codex/portfolio-mvp`: dos columnas, degradado azul/turquesa, cruz decorativa, tarjeta blanca redondeada, tipografía, espaciado y respuesta a pantallas pequeñas.

## Criterios de aceptación

- `/login` presenta sólo email, contraseña, botón Ingresar y recuperación de contraseña; conserva los mensajes de error existentes.
- La página mantiene `getPostLoginDestination`, las redirecciones y el `LoginForm` conectado a `loginAction`, sin cambios de validación, sesiones o autorización.
- No aparece acceso invitado, datos ficticios, texto de solo lectura ni Turnstile.
- La composición se compara con el portfolio a 1366 × 608, 1440 × 900 y 390 × 844; carga, errores y ausencia de desbordes se comprueban.
- Pasan las pruebas focales, ESLint, Prettier y typecheck; el commit local se crea sólo tras verificación y revisión.

## Alcance e impacto

Sólo presentación de `/login` en V1, documentación acotada y pruebas focales. No se modifican otros flujos de Auth, la rama portfolio, TASK-029, Supabase, migraciones ni servicios externos. Los archivos previstos son una envoltura visual del login, su integración en la página, estilos responsive y pruebas visuales/estructurales.

## Riesgos

- La composición puede desbordar a 608 px de altura o en móvil; comprobar tamaño real.
- Los mensajes de error pueden aumentar la altura de la tarjeta; mantener scroll y legibilidad.
- La comparación funcional de autenticación será local y con dobles de prueba porque esta tarea no puede operar Supabase DEV/DEMO.
