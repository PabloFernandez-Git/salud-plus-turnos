# Supabase infrastructure

`client.ts` y `server.ts` separan los clientes browser y SSR. Ambos usan únicamente la URL pública y
la publishable key. `proxy.ts` refresca la sesión SSR mediante cookies y `getClaims()`.

`admin.ts` es un cliente `server-only` separado. Usa exclusivamente `SUPABASE_SECRET_KEY` para Auth
Admin, sin persistencia, auto-refresh ni detección de sesión en URL. No debe reexportarse desde un
módulo importable por Client Components ni usarse como vía normal de datos del producto.

El bootstrap manual requiere además un `SUPABASE_BOOTSTRAP_OPERATION_ID` UUID estable. Debe
reutilizarse al reintentar el mismo bootstrap para reconciliar una respuesta perdida; generar otro
UUID representa una intención distinta y será rechazada después de la inicialización one-shot.

`database.types.ts` se genera desde el esquema `public` real de DEV con `pnpm db:types`. No editarlo
manualmente.
