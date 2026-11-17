# Demo pública de portfolio

**URL:** [salud-plus-portfolio.vercel.app](https://salud-plus-portfolio.vercel.app) · **rama:** `codex/portfolio-mvp` · **código funcional publicado:** `557cc6ba481fb35d01c60e30e97cf839db494644`.

La demo representa un único centro con datos exclusivamente ficticios. Se puede explorar sin correo ni contraseña desde **Demo invitado → Explorar demo como invitado**. Es de solo lectura y no debe utilizarse para gestionar información médica real. Los flujos de escritura de la aplicación completa permanecen deshabilitados en esta publicación.

La navegación visual de TASK-037 ya está integrada: sidebar compacta, menú móvil y encabezado de ancho completo. TASK-038 añade los bloqueos excepcionales a Agenda y Disponibilidad en solo lectura. Se conservan el aviso DEMO, el login, Turnstile y los límites de escritura.

## Configuración de la publicación

- Vercel sirve Next.js desde la rama de portfolio; `PORTFOLIO_DEMO_MODE=true`, `PORTFOLIO_CAPTCHA_REQUIRED=true` y `PORTFOLIO_GUEST_ACCESS_ENABLED=true` en Production, comprobados al actualizar esta guía.
- Supabase DEMO es un proyecto independiente de DEV. Supabase Auth mantiene una sesión anónima por visitante; Cloudflare Turnstile protege el ingreso. La Site Key es pública; la Secret Key solo pertenece a la configuración de Supabase Auth.
- El hook **Before User Created** y el trigger de `auth.users` admiten únicamente altas anónimas y provisionan perfil y membresía del centro ficticio. RLS restringe perfiles y membresías entre invitados.
- `PORTFOLIO_DEMO_MODE=true` bloquea las Server Actions de escritura; PostgreSQL revoca DML sobre tablas públicas y EXECUTE sobre RPC sensibles. Solo se conceden las funciones de lectura necesarias para la demo. Los botones de escritura se muestran deshabilitados.

La cuenta operativa tradicional de DEMO no se publica ni se requieren credenciales compartidas para visitantes. Ninguna configuración de DEMO debe copiarse a DEV o `main`. Ver [acceso invitado](portfolio-guest-access.md), [arquitectura](architecture.md) y [estado](status.md).

## Alcance de la verificación

El operador informó que el flujo público de invitados funciona en Chrome. Tras TASK-038 se verificaron remotamente cuatro bloqueos ficticios activos, tres turnos conservados, permisos de lectura sin DML directo y el bundle público con origen Supabase exclusivamente DEMO. La inspección visual autenticada de Agenda y Disponibilidad en el nuevo despliegue sigue pendiente por indisponibilidad del navegador conectado. Ver [estado](status.md) y el [informe](../.harness/tasks/active/TASK-PORTFOLIO-038/implementation-report.md). El sitio contiene solo datos de prueba.
