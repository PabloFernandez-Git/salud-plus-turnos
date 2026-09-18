# Supabase

Las migrations SQL versionadas vivirán en `migrations/`.

No se ha inicializado Supabase Local en TASK-001. El proyecto comienza usando Supabase DEV remoto.

Reglas:
- cambios de schema → migration SQL;
- DEV primero;
- tipos → `pnpm db:types`;
- ningún agente aplica migrations automáticamente a PROD.
