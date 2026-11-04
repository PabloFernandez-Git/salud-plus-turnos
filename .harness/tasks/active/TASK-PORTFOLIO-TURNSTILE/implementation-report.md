# Informe de implementación local

## Cambios

- `Turnstile` reutilizable con carga única del script, estados de carga, éxito, vencimiento, error y reintento, y reset imperativo tras rechazo de Auth.
- Login DEMO y acceso invitado comparten un único token. `signInWithPassword` y `signInAnonymously` usan `options.captchaToken`; el servidor exige token válido de forma cuando `PORTFOLIO_CAPTCHA_REQUIRED=true` en DEMO.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` es la única clave nueva del cliente. No se almacena Secret Key. El acceso invitado exige configuración CAPTCHA completa y sigue deshabilitado por defecto.
- Login no DEMO conserva el flujo previo. Documentación de activación y claves oficiales de prueba añadida.

## Verificación

- Suite general: 114 archivos, 1003/1003 PASS. Se añadió después un caso focal que comprueba el reset al fallar el login DEMO; el archivo `login-form.test.tsx` pasó 6/6.
- TypeScript, ESLint focal y Prettier focal: PASS.
- Build de DEMO con `PORTFOLIO_GUEST_ACCESS_ENABLED=false`, `PORTFOLIO_CAPTCHA_REQUIRED=true` y Site Key oficial de prueba: PASS con Webpack.
- Tooling Node: 31/31 PASS.
- Se inspeccionó `@supabase/auth-js` 2.116.0 instalado: ambos métodos serializan `options.captchaToken` como `gotrue_meta_security.captcha_token`.

## Pendiente de activación

Configurar la Secret Key real únicamente en Supabase Auth, la Site Key pública en el despliegue DEMO, verificar login e invitado con CAPTCHA real y pruebas negativas, y habilitar el acceso invitado en una fase separada. No se modificaron Supabase, Cloudflare ni Vercel.
