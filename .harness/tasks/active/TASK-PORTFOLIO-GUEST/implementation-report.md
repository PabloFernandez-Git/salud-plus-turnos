# Informe de implementación local

## Alcance

- Rama `codex/portfolio-mvp`, sin cambios en `main`, DEV, Supabase DEMO ni TASK-029.
- Botón de ingreso anónimo opt in, reutilización de sesión y soporte opcional de Turnstile.
- Migración SQL y configuración de Auth separadas en `supabase/demo/`; ninguna migración compartida cambia.
- Provisión atómica de perfil y membership del único centro DEMO desde el trigger Auth. Hook Auth y trigger bloquean altas no anónimas. Límite transaccional de 500 invitados.
- Policies restrictivas de perfiles y memberships para invitados; grants de escritura y RPC sensibles siguen revocados por la migración DEMO anterior.
- Limpieza transaccional con vista previa y `ROLLBACK` por defecto, máximo 100 invitados de más de 30 días.

## Verificación

- Supabase Auth/PostgREST/PostgreSQL local desde base limpia: dos invitados, sesiones distintas, lectura de centro y dashboard, aislamiento de perfil y membership, rechazo de otro centro, DML y RPC sensibles, rechazo de signup no anónimo por hook, tope de cuentas y limpieza con FK: `PORTFOLIO_GUEST_LOCAL_INTEGRATION_PASSED`.
- Simulación RLS con `is_anonymous=false` para un perfil invitado existente: sigue limitado a su identidad y membership.
- Vitest completo: 111 archivos, 993 pruebas aprobadas.
- Tooling Node: 31 pruebas aprobadas. TypeScript, ESLint focal y Prettier focal: aprobados.
- Build de producción con Webpack: aprobado. Turbopack no acepta el enlace `node_modules` de este worktree, que apunta fuera de su raíz; es una limitación del entorno local de prueba.
- El gate opcional de centinelas del bundle no llegó al build: invoca `pnpm` internamente y ese gestor rechaza el mismo enlace de `node_modules`. No se introdujeron referencias nuevas a claves privadas en el cliente.

## Pendiente para activación separada

Aplicar exclusivamente la migración DEMO tras preflight remoto, configurar el hook de Auth, límites y eventual CAPTCHA, ejecutar el smoke remoto con dos navegadores y JWT reales, y solo entonces habilitar el flag y desplegar. Ver `docs/portfolio-guest-access.md`.
