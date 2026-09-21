# Configuración reproducible de Supabase DEV

## Alcance

Esta guía conecta un clon local exclusivamente con el proyecto Supabase de Development. Permite
validar conectividad y generar tipos desde el esquema `public` real. No crea tablas, migrations,
usuarios, buckets ni datos, y no configura Production.

El único proyecto compartido aprobado es `salud-plus-turnos-dev`, project ref
`ehllxymqyzrofydrvtzo`, en **South America (São Paulo), `sa-east-1`**. La fuente de verdad consumida
por los guards es
[`scripts/config/approved-supabase-dev.mjs`](../scripts/config/approved-supabase-dev.mjs). Cambiar de
proyecto requiere revisar y versionar explícitamente esa configuración; modificar sólo `.env.local`
y el link local no puede cambiar el destino aceptado.

## Credenciales y variables

Crear `.env.local` a partir de `.env.example` y completar únicamente:

| Variable | Clasificación | Uso |
| --- | --- | --- |
| `APP_ENV` | local no secreta | Debe ser `development`; los scripts bloquean cualquier otro valor. |
| `NEXT_PUBLIC_SUPABASE_URL` | pública | URL exacta del proyecto DEV. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pública | Clave publishable; su seguridad depende de grants y RLS. |
| `SUPABASE_DEV_PROJECT_REF` | local no secreta | Debe coincidir con el project ref DEV aprobado y versionado. |

TASK-003 no necesita una secret key ni una clave `service_role`. No agregarlas para evitar warnings:
ambas omiten RLS y sólo podrán incorporarse en una tarea que justifique un cliente administrativo
server-only. La contraseña de base y el token personal de Supabase CLI tampoco pertenecen a
`.env.local`, documentación ni Git: guardarlos en un password manager o credential store.

`.env.local` está ignorado por Git. Verificarlo sin mostrar su contenido:

```powershell
git check-ignore -v .env.local
git ls-files -- .env.local ".env*"
```

El segundo comando debe listar `.env.example`, pero nunca `.env.local`.

## Preparar un clon nuevo

1. Instalar Node.js 24 y pnpm 11.26.0; luego ejecutar `pnpm install --frozen-lockfile`.
2. En Supabase Dashboard, seleccionar el proyecto aprobado indicado arriba y confirmar nombre, ref y
   región. Un proyecto alternativo, aunque sea nuevo y se llame DEV, no satisface los guards. No usar
   quickstarts ni crear tablas de ejemplo.
3. Copiar `.env.example` a `.env.local` y reemplazar los placeholders con Project URL, publishable
   key y project ref del mismo proyecto.
4. Autenticar la CLI de forma interactiva. No copiar el token al repositorio:

   ```powershell
   pnpm exec supabase login
   ```

5. Linkear el clon únicamente con el project ref aprobado:

   ```powershell
   pnpm exec supabase link --project-ref ehllxymqyzrofydrvtzo
   pnpm exec supabase projects list
   ```

   La lista debe marcar como `LINKED` el mismo ref configurado. El metadata local del link vive en
   `supabase/.temp/` y está ignorado por Git.

6. Ejecutar los checks reproducibles:

   ```powershell
   pnpm bootstrap
   pnpm supabase:check:dev
   pnpm db:types
   ```

`bootstrap` comprueba presencia, formato y que env, URL y link coincidan con la identidad DEV
versionada, sin imprimir valores. `supabase:check:dev` hace un `GET` al health check oficial con la
publishable key; no consulta ni modifica datos. `db:types` vuelve a validar el destino, lee el esquema
`public` mediante la CLI y regenera `src/lib/supabase/database.types.ts`.

## Clientes de aplicación

- `src/lib/supabase/client.ts` crea el cliente browser con URL y publishable key.
- `src/lib/supabase/server.ts` crea el cliente SSR con las mismas credenciales no privilegiadas y el
  adaptador de cookies de Next.js.
- No existe un cliente admin. Tampoco se implementan Auth, refresh proxy ni acceso al dominio en
  esta tarea.

## Protección de Production

Los wrappers fallan antes de conectarse si `APP_ENV` no es exactamente `development`, si env o URL
no corresponden al ref DEV aprobado, o si el link local apunta a otro proyecto. Esto también bloquea
una URL, env y link alternativos aunque sean coherentes entre sí. Antes de cualquier trabajo futuro
de base se debe comprobar visualmente que el proyecto es DEV.

Está prohibido usar estos pasos para ejecutar en Production `db push`, migrations, seeds, resets o
cualquier mutación. Aplicar cambios a PROD requiere una tarea y autorización humana explícitas.

## Troubleshooting y rotación

- **Falta `.env.local`:** copiar `.env.example`; no renombrar ni versionar el archivo real.
- **URL/ref rechazados:** volver a copiar ambos valores desde el proyecto aprobado. No cambiar la
  fuente versionada para hacer pasar una configuración local accidental.
- **Proyecto linkeado distinto:** inspeccionar `pnpm exec supabase projects list` y relinkear sólo
  después de confirmar nombre, región y ref de DEV.
- **CLI sin sesión:** repetir `pnpm exec supabase login`; no usar un token pegado en scripts.
- **Proyecto pausado:** reactivarlo desde Dashboard y repetir el health check.
- **Clave inválida:** copiar nuevamente la publishable key, sin sustituirla por una secret key.
- **Credencial expuesta:** revocarla o rotarla inmediatamente en Dashboard, actualizar sólo el
  almacenamiento local/seguro correspondiente y revisar el historial antes de continuar.

`database.types.ts` es generado. No editarlo manualmente: corregir el esquema autorizado y volver a
ejecutar `pnpm db:types`.
