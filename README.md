# Salud Plus

Salud Plus es una aplicación de gestión de turnos para centros de salud pequeños. Reúne agenda, pacientes, profesionales y disponibilidad en un mismo espacio para facilitar la organización diaria del centro.

**[Explorar la demo pública](https://salud-plus-portfolio.vercel.app)**

## Cómo ingresar

1. Abrí la demo y elegí la pestaña **Demo invitado**.
2. Completá la verificación de seguridad y seleccioná **Explorar demo como invitado**.
3. Recorré el centro ficticio. Cada visitante obtiene su propia sesión, sin correo ni contraseña.

La demo contiene **solo datos ficticios** y es **de solo lectura**: permite navegar y consultar, pero no guardar cambios. No está destinada a gestionar información médica real. La aplicación completa incluye flujos de escritura sujetos a roles y permisos; esos controles permanecen deshabilitados en la demo pública.

## Funcionalidades implementadas

- Dashboard y agenda con vistas diaria, semanal y mensual.
- Consulta y gestión de turnos, pacientes, profesionales, especialidades y disponibilidad en la aplicación completa.
- Acceso a centros mediante membresías y roles; gestión de usuarios y configuración del centro.
- En la demo, exploración de los módulos de consulta con acciones de escritura visibles pero deshabilitadas.

## Arquitectura y tecnologías

Next.js 16, React 19, TypeScript y Tailwind CSS para la interfaz; Supabase Auth y PostgreSQL para identidad y datos. La demo se publica en Vercel y usa Cloudflare Turnstile para el ingreso. Supabase Auth crea una sesión anónima por visitante; las políticas RLS aíslan perfiles y membresías, y los permisos SQL y controles del servidor impiden escrituras. Las pruebas del repositorio usan Vitest, React Testing Library y Playwright.

La demo utiliza un proyecto Supabase separado de DEV. La arquitectura general se describe en [docs/architecture.md](docs/architecture.md), y la configuración específica en [docs/portfolio-demo.md](docs/portfolio-demo.md) y [docs/portfolio-guest-access.md](docs/portfolio-guest-access.md).

## Desarrollo local

Requiere Node.js 24 y pnpm 11.26.0. Copiá `.env.example` a `.env.local`, completá las variables de tu entorno y ejecutá:

```bash
pnpm install --frozen-lockfile
pnpm bootstrap
pnpm dev
```

Para verificar el proyecto:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Ver [producto](docs/product.md) y [estado de desarrollo](docs/status.md). Las verificaciones de la demo no constituyen una auditoría de seguridad exhaustiva.
