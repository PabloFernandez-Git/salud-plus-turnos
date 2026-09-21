# Supabase infrastructure

`client.ts` y `server.ts` separan los clientes browser y SSR. Ambos usan únicamente la URL pública y
la publishable key; no existe un cliente administrativo en TASK-003.

`database.types.ts` se genera desde el esquema `public` real de DEV con `pnpm db:types`. No editarlo
manualmente.
