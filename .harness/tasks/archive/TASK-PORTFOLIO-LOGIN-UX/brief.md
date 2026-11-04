# TASK-PORTFOLIO-LOGIN-UX — presentación del login DEMO

## Objetivo

Dar prioridad visual al acceso invitado en el login DEMO de `codex/portfolio-mvp`, manteniendo el ingreso por email y contraseña como alternativa secundaria.

## Criterios de aceptación

- En DEMO, el título es «Explorá Salud Plus» y la descripción usa el texto solicitado.
- «Explorar demo como invitado» es el botón principal; el ingreso tradicional sigue disponible e identificado.
- Ambos botones habilitados muestran cursor pointer; los estados deshabilitados muestran cursor not allowed y estilo inactivo.
- Ambos mecanismos conservan una sola verificación Turnstile compartida.
- El diseño sigue siendo responsive y el login fuera de DEMO mantiene su presentación.
- Pasan tests focales, typecheck y build DEMO; se crea un commit local.

## Riesgos e impacto

- El reordenamiento visual no debe alterar el envío del token ni los estados de Auth.
- Solo se modifican la página `/login`, los componentes visuales del módulo access, pruebas focales y la documentación de esta tarea.
- No se modifican Supabase, Cloudflare, variables de entorno, DEV, `main`, TASK-029, push ni deploy.
