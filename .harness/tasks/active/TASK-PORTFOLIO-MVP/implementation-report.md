# TASK-PORTFOLIO-MVP — Implementation report

## Cambios

- Worktree y rama `codex/portfolio-mvp` desde `afd502dc2b45ac5be303b22efd51f6cd521b54c9`; los demás worktrees no se modificaron.
- Migración DEMO posterior a las 27 base: revoca DML directo y todas las RPC públicas a `authenticated`; devuelve `EXECUTE` sólo a nueve RPC de lectura tenant. La resolución global de pacientes y profesionales no queda expuesta.
- `PORTFOLIO_DEMO_MODE=true` bloquea Server Actions de escritura y de resolución de identidades antes de llamar servicios privilegiados. Banner y etiqueta de lectura identifican la demo.
- `APP_ORIGIN` fija el origen de recovery/callback; el destino de callback sigue siendo la ruta permitida.
- La acción web de cambio de contraseña también se bloquea en modo DEMO.
- Seed SQL sintético y repetible con un centro, dos profesionales, dos especialidades, tres pacientes y tres turnos relativos al día de carga. El seed se niega a ejecutarse si hay otro usuario Auth o centro.
- README, guía de aprovisionamiento/variables/smoke y documentación de módulos/estado actualizados.

## Verificación local

- Bootstrap del entorno instalado: PASS.
- Vitest focal inicial: 23/23 en cuatro archivos, PASS. Revisión previa a Vercel: 32/32 en cinco archivos, PASS.
- TypeScript: PASS.
- ESLint focal: PASS.
- Prettier focal: PASS.
- `next build --webpack`: PASS. Se usó webpack porque Turbopack no admite el junction temporal de `node_modules` de este worktree; no hubo cambio de tooling del proyecto.
- `git diff --check`: PASS.

## Estado operativo y pendientes

El operador confirmó Supabase DEMO `oygrwetmxsqgcizopezq`: 28 migraciones, registro público desactivado, cuenta Auth, seed e inventario ficticio PASS. Las seis RPC sensibles de pacientes tienen EXECUTE=false para `anon` y `authenticated`. No se repitieron migraciones ni seed. Faltan la prueba directa de DML con JWT demo, las URLs definitivas de Auth, las variables Vercel y el smoke del despliegue. Una sesión Auth puede cambiar sus propias credenciales directamente por la API de Supabase Auth aunque la acción web esté bloqueada; esto requiere control operativo de la cuenta compartida. No se accedió a Supabase DEV/PROD ni se desplegó Vercel.
