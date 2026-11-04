# TASK-PORTFOLIO-LOGIN-TABS — rediseño visual del login DEMO

## Objetivo

Presentar el login DEMO en dos paneles: identidad visual minimalista y autenticación con pestañas accesibles «Iniciar sesión» y «Demo invitado», con inicio en la primera.

## Criterios de aceptación

- En DEMO, escritorio muestra los dos paneles centrados; móvil prioriza el formulario sin desbordamiento.
- La pestaña de login muestra título, descripción, campos, contraseña visible/oculta, Turnstile y botón principal pedidos.
- La pestaña invitado muestra título y descripción exactos, Turnstile y botón principal; sus enlaces inferiores cambian de pestaña sin navegar.
- Las pestañas responden a clic y teclado, y exponen roles/estados accesibles.
- Existe un solo widget y token Turnstile compartido; Auth, errores, expiración y bloqueo conservan su comportamiento.
- Cursor y estados visuales coherentes; el login fuera de DEMO mantiene su presentación.
- Pasan tests focales, typecheck, ESLint, Prettier y build DEMO con webpack. Se crea commit local sin push ni deploy.

## Riesgos e impacto

- Al cambiar de pestaña no debe remontarse Turnstile ni perderse el token.
- Los campos de credenciales deben conservar sus valores al cambiar de pestaña, sin ejecutar el formulario desde el enlace inferior.
- Cambios limitados a la presentación de `/login`, componentes del módulo access, tests y memoria del harness. Sin cambios en Auth, Supabase, Cloudflare, Vercel, variables de entorno, migraciones, DEV, `main` ni TASK-029.
