# Acceso invitado de la demo pública

La [demo de Salud Plus](https://salud-plus-portfolio.vercel.app) permite entrar por **Demo invitado → Explorar demo como invitado**, sin correo ni contraseña. Cada visitante usa una sesión propia de Supabase Auth: se reutiliza si sigue vigente o se crea mediante `signInAnonymously()`. La aplicación muestra el centro ficticio en modo de solo lectura.

## Controles exclusivos de DEMO

- Cloudflare Turnstile entrega un token para el login tradicional y el acceso invitado. Supabase Auth valida el token; la aplicación lo descarta al vencer o fallar y permite reintentar. `PORTFOLIO_CAPTCHA_REQUIRED=true` controla si el formulario lo exige. `PORTFOLIO_GUEST_ACCESS_ENABLED=true` controla por separado si aparece la entrada invitada.
- El hook **Before User Created** (`public.portfolio_allow_anonymous_signup`) rechaza altas no anónimas. El trigger de `auth.users` vuelve a exigir la misma condición y crea en `public.users` un perfil sintético y una membresía del único centro DEMO para cada UID invitado. El trigger limita a 500 los invitados simultáneos.
- Las políticas RLS restrictivas de `users` y `center_memberships` permiten que cada invitado consulte solo sus propias filas, incluso si cambia el claim anónimo. La autorización por centro permanece activa para las consultas de los módulos.
- En DEMO, `authenticated` carece de INSERT, UPDATE y DELETE sobre tablas públicas y de EXECUTE sobre RPC de escritura. Las Server Actions también rechazan escrituras mediante `PORTFOLIO_DEMO_MODE=true`. La Site Key pública no sustituye ninguna de estas barreras; la Secret Key de Turnstile se configura solo en Supabase Auth.
- El operador informó un límite remoto de **10 altas anónimas por hora e IP**. La referencia `supabase/demo/auth-config.example.toml` es un ejemplo local y no representa la configuración activa del panel.

La migración y la limpieza se encuentran exclusivamente en `supabase/demo/`; no forman parte del despliegue de migraciones compartidas a DEV o PROD.

## Verificación remota informada por el operador

Con dos JWT anónimos independientes en Chrome y Edge, el operador comprobó UID distintos, `is_anonymous=true`, lectura del centro DEMO y de los módulos de pacientes y profesionales. Cada invitado recibió HTTP 200 para su perfil y membresía; las consultas de filas del otro devolvieron listas vacías. INSERT, UPDATE y DELETE sobre `centers`, y la RPC `staff_create_appointment`, devolvieron HTTP 403 / `42501`. Una consulta de `staff_get_daily_dashboard` con otro centro devolvió HTTP 403 / `42501` y `DASHBOARD_ACCESS_DENIED`. El registro tradicional con CAPTCHA válido devolvió HTTP 403 y `Only anonymous DEMO signups are allowed.`; la consulta posterior a `auth.users` encontró cero cuentas de prueba. También se verificaron el acceso público, el cierre de sesión y los controles de escritura deshabilitados.

Estas pruebas específicas no constituyen una auditoría exhaustiva de todas las tablas, permisos o RPC. Los datos de la demo son ficticios y no deben usarse para atención médica real.

## Limpieza controlada

El operador puede revisar `supabase/demo/cleanup-guests.sql` **solo en DEMO**. Selecciona como máximo 100 cuentas anónimas de más de 30 días, con perfil sintético y única membresía en el centro DEMO; borra en orden de claves foráneas `center_memberships` → `public.users` → `auth.users`. El archivo termina en `ROLLBACK` para inspeccionar el lote sin borrar. Cambiarlo a `COMMIT` requiere una decisión operativa separada después de revisar UUID y conteos. No ejecutar la limpieza automáticamente ni aplicar `supabase db push` para esta demo.
