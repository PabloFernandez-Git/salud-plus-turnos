# Supabase

Las migrations SQL versionadas vivirán en `migrations/`.

No se ha inicializado Supabase Local en TASK-001. El proyecto comienza usando Supabase DEV remoto.

La identidad DEV aprobada y no secreta está fijada en
`../scripts/config/approved-supabase-dev.mjs`; todos los wrappers remotos deben validarla antes de
conectar o invocar la CLI.

La preparación completa de otra máquina está documentada en
[`docs/supabase-dev-setup.md`](../docs/supabase-dev-setup.md).

Reglas:
- cambios de schema → migration SQL;
- DEV primero;
- tipos → `pnpm db:types`;
- conectividad de sólo lectura → `pnpm supabase:check:dev`;
- ningún agente aplica migrations automáticamente a PROD.
