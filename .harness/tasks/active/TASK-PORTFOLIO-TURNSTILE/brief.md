# TASK-PORTFOLIO-TURNSTILE — integración local

## Objetivo

Preparar Turnstile para los dos ingresos de la DEMO en `codex/portfolio-mvp`, sin cambiar Supabase, Cloudflare, Vercel, DEV, `main` ni TASK-029.

## Criterios de aceptación

- Un componente React reutilizable carga y maneja Turnstile; expone token, expiración, error, carga y reintento.
- El login tradicional DEMO y `signInAnonymously()` envían `options.captchaToken` a Supabase Auth.
- DEMO rechaza intentos sin token cuando CAPTCHA se exige; el resto de la aplicación conserva su login actual.
- La Site Key es pública y configurable; ninguna Secret Key entra en código o Vercel.
- Las pruebas cubren token válido/inválido, fallo, expiración, reintento y aislamiento de DEMO; TypeScript y build pasan.
- El acceso invitado continúa deshabilitado por defecto.

## Riesgos e impacto

- Tokens Turnstile son de uso único y vencen; cada intento fallido debe restablecer el widget.
- Activar CAPTCHA en Supabase antes de desplegar el formulario actualizado bloquearía el login existente.
- El script externo puede fallar o estar bloqueado; el formulario debe fallar cerrado cuando CAPTCHA es obligatorio.
- Solo se afectan el módulo access, la configuración DEMO, tests y documentación de portfolio.
