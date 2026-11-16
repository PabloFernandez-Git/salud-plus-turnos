# TASK-038 — Validación funcional en Supabase DEV

Fecha: 2026-11-16. Proyecto verificado: `ehllxymqyzrofydrvtzo`. Rama:
`codex/task-038-availability-blocks`. El usuario confirmó 28/28 migraciones sincronizadas
y `supabase db push --linked --dry-run --skip-vault` sin pendientes. No se aplicaron
migraciones en esta validación.

## Catálogo

Consulta PostgreSQL remota de solo lectura: tabla `public.availability_blocks`,
constraints de fechas finitas, motivo, FK y exclusión parcial; índice de fechas
parcial; RLS habilitada con única policy SELECT para `authenticated` y aislamiento
de centro/profesional; SELECT de tabla para `authenticated` sin INSERT/UPDATE,
sin SELECT para `anon`; cuatro RPC `staff_*_availability_block` con firmas,
`SECURITY DEFINER`, `search_path` cerrado y EXECUTE solo para `authenticated`.
Resultado: PASS.

## Pruebas autenticadas

`node scripts/task038-dev-validation.mjs` pasó contra DEV con dos centros nuevos,
cinco Auth users temporales y roles ADMIN, RECEPTION y PROFESSIONAL. Se verificó:
alta y retiro por staff; consulta propia del profesional y denegación de mutaciones;
bloqueos de uno y varios días; preview con un turno previo; conservación exacta del
turno tras bloquear; rechazo de alta y reprogramación en fechas bloqueadas;
recuperación de slots tras retiro; aislamiento entre centros y rechazo de
`infinity`/`-infinity` en RPC. Resultado: PASS.

Se registraron los identificadores exactos en
`dev-validation-manifest.json` (`runId=f0ea457590807efd`): 5 Auth users, 5 bloqueos,
1 turno. El cleanup eliminó y auditó todos esos registros y sus entidades padre;
estado `cleaned_and_audited`. El primer intento (`runId=c00ead06bd9e4d2a`)
se detuvo durante setup por el rol de conexión y también se limpió y auditó:
5 Auth users, ningún centro, bloqueo ni turno. Su registro está en
`dev-validation-attempt1-manifest.json`. Ningún dato preexistente fue modificado.

## Tipos y aplicación

`pnpm db:types` regeneró `src/lib/supabase/database.types.ts` desde DEV. El diff
incluye TASK-038, RPC previas que estaban ausentes del archivo local y la versión
PostgREST 14.18. La CLI representa los campos opcionales de
`admin_update_center_settings` como no anulables; se conservaron las seis
anotaciones `| null` que ya reflejaban el contrato de la aplicación. Tras ese
ajuste focal, `pnpm typecheck` pasó.

60 pruebas focales pasaron (4 archivos). ESLint y Prettier focales, y
`git diff --check`, pasaron.

Next ya estaba ejecutándose desde este worktree en `http://localhost:3004`.
`/login` respondió HTTP 200 y una ruta protegida redirigió a `/login` sin sesión.
Entrada para revisión autenticada: `http://localhost:3004/login`, luego
`http://localhost:3004/select-center`; en el centro elegido, abrir Agenda y
Disponibilidad desde la navegación. No se conservan las cuentas sintéticas
para la revisión manual.
