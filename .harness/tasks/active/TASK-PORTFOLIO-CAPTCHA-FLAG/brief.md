# TASK-PORTFOLIO-CAPTCHA-FLAG — activar CAPTCHA por flag

## Objetivo

Corregir el login DEMO para que `PORTFOLIO_CAPTCHA_REQUIRED` controle Turnstile y la exigencia del token, aunque exista una Site Key. Conservar el diseño aprobado, el acceso invitado desactivado y el login fuera de DEMO.

## Criterios de aceptación

- Con CAPTCHA desactivado, DEMO no muestra Turnstile y permite el login tradicional sin token.
- Con CAPTCHA activado, DEMO muestra Turnstile y exige token para login e invitado.
- Si se exige CAPTCHA y falta la Site Key, el acceso falla cerrado.
- `PORTFOLIO_GUEST_ACCESS_ENABLED` controla solo la disponibilidad del invitado.
- Pasan tests focales, typecheck, ESLint y build DEMO con webpack.

## Riesgos e impacto

- Pasar el flag al componente de forma incorrecta podría bloquear el login existente o permitir autenticación sin token. Verificar las dos combinaciones y el rechazo en servidor.
- Limitar los cambios al módulo de acceso, la página de login y sus pruebas. No modificar Supabase, migraciones, variables, DEV, main ni TASK-029.
