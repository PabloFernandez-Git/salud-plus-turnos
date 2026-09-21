# Review — TASK-003 Configurar Supabase DEV

**Rol:** Reviewer / Verifier independiente + Security Reviewer + Database Reviewer

**Fecha:** 2026-09-21

**Branch verificada:** `task/003-supabase-dev-setup`

**Base:** `main` / `31f4b22`

**Estado del cambio:** working tree sin commit; la punta de la branch todavía coincide con `main`

**Resultado general del Review:** `PASS`

## Conclusión

La implementación real satisface conectividad de sólo lectura, generación reproducible de tipos,
frontera browser/server, ausencia de secretos versionados y ausencia de cambios de schema. El proyecto
remoto actualmente configurado fue contrastado de forma independiente: es `salud-plus-turnos-dev`,
ref `ehllxymqyzrofydrvtzo`, región `sa-east-1`, está saludable y figura como `LINKED`.

El hallazgo del primer ciclo quedó resuelto. La identidad aprobada ahora vive en una única fuente
ejecutable versionada y los guards contrastan contra ella el project ref de entorno, la URL y el link
local. Una configuración alternativa con URL, env ref y link coherentes entre sí fue rechazada antes
de cualquier acceso de red o invocación de CLI. TASK-003 queda lista para el protocolo de cierre.

## Hallazgo revalidado

### [RESUELTO] Los guards fijan la identidad del proyecto DEV aprobado

**Evidencia:**

- `scripts/config/approved-supabase-dev.mjs` contiene únicamente el project ref aprobado y la región;
  no contiene claves, tokens, contraseñas ni URLs con credenciales.
- La búsqueda del literal `ehllxymqyzrofydrvtzo` en código ejecutable bajo `scripts/` encuentra una
  única definición: esa fuente de verdad. Guards y tests la importan en lugar de duplicarla.
- `scripts/lib/supabase-dev-env.mjs` rechaza el env ref si difiere de la fuente aprobada, deriva el
  host desde la fuente aprobada y valida también el link local contra ella.
- Los siete tests específicos pasan e incluyen el caso donde env, URL y link son mutuamente
  coherentes pero pertenecen a otro proyecto.
- Una matriz independiente reprodujo los seis escenarios requeridos: sólo la configuración aprobada
  fue aceptada; los otros cinco casos terminaron en fallo seguro.
- El wrapper real `supabase:check:dev`, invocado con env ref y URL alternativos coherentes, terminó con
  exit `1` por identidad no aprobada antes de abrir red.

**Resultado:** el cambio conjunto de `.env.local`, URL y link ya no puede redirigir los wrappers a
otro proyecto sin modificar además una fuente versionada, explícita y revisable. No queda una vía
accidental evidente hacia PROD dentro del alcance de TASK-003.

## Matriz de verificación

| Área | Estado | Evidencia independiente |
| --- | --- | --- |
| Identidad remota actual | PASS | `projects list --output json` confirmó nombre, ref, `sa-east-1`, `ACTIVE_HEALTHY` y `linked: true`. |
| Ref esperado actual | PASS | `.env.local`, URL y metadata del link coinciden con `ehllxymqyzrofydrvtzo`; no se imprimieron valores sensibles. |
| Exclusividad DEV ante cambio coherente | PASS | Un ref alternativo coherente es rechazado contra la fuente versionada antes de red/CLI. |
| Health check | PASS | `GET /auth/v1/health`, endpoint oficial de disponibilidad de Supabase Auth; método de sólo lectura y sin body. |
| Generación real de tipos | PASS | `pnpm db:types` invocó la CLI contra DEV dos veces; ambas salidas tuvieron el mismo SHA-256. |
| Schema `public` | PASS | Tipos recién regenerados con `Tables`, `Views`, `Functions`, `Enums` y `CompositeTypes` vacíos; sin entidades del dominio. |
| Migrations/seeds/datos | PASS | No hay SQL ni migrations nuevas; `supabase/migrations/` conserva sólo `.gitkeep`; el seed permanece bloqueado y no se ejecutó. |
| `.env.local` | PASS | Ignorado por `.env.*`, no versionado y contiene exactamente las cuatro variables mínimas. |
| Metadata local | PASS | `supabase/.temp/` está ignorado y no tiene archivos versionados. |
| Credenciales versionadas | PASS | Los valores reales de URL y publishable key no aparecen en archivos versionables; no se detectaron tokens, claves secret/service-role, contraseñas ni connection strings. |
| Contrato de keys | PASS | Sólo URL y publishable key llegan a código cliente; no se requiere `SUPABASE_SERVICE_ROLE_KEY` ni existe cliente admin. |
| Clientes browser/server | PASS | Clientes separados con `@supabase/ssr`, ambos tipados y limitados a URL + publishable key. |
| Bundle cliente | PASS | El check normal pasó y una fuga sintética incorporada al bundle fue detectada con exit code `1`; los cambios temporales fueron retirados. |
| Errores/logs/docs | PASS | Mensajes sanitizados; no exponen valores de configuración ni stderr remoto sensible. |
| Reproducción en otra máquina | PASS | Explica identidad aprobada, instalación, login, link exacto, checks y manejo seguro. |

## Guards reproducidos

| Escenario controlado | Resultado |
| --- | --- |
| `APP_ENV=production` en bootstrap | PASS — exit no exitoso antes de red. |
| `APP_ENV=production` en health check | PASS — exit `1` antes de red. |
| `APP_ENV=production` en generación de tipos | PASS — exit `1` antes de CLI. |
| `APP_ENV=production` en seed placeholder | PASS — exit `1`, sin operación. |
| URL discordante con el ref | PASS — exit `1` antes de red. |
| Ref configurado discordante con el link | PASS — exit `1` antes de red. |
| Ref/URL/link alternativos pero coherentes | PASS — rechazados por no coincidir con la fuente DEV aprobada. |

## Comandos y verificaciones reproducidas

| Comando / inspección | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS — lockfile sin cambios. |
| `pnpm bootstrap` | PASS con la configuración actual. |
| `pnpm supabase:check:dev` | PASS — health check HTTPS de sólo lectura. |
| `pnpm db:types` | PASS dos veces — salida determinista desde `public` de DEV. |
| `pnpm format:check` | PASS. |
| Tests específicos de guards | PASS — 7 tests, incluidos los seis escenarios requeridos. |
| `pnpm check` | PASS — ESLint, TypeScript y 17 tests en 5 archivos. |
| `pnpm build` | PASS. |
| `pnpm security:check:client-bundle` | PASS en árbol normal. |
| Prueba negativa de fuga sintética | PASS como detector — el comando falló por el centinela presente en un artefacto cliente. |
| `git check-ignore -v .env.local supabase/.temp/project-ref` | PASS. |
| `git ls-files` sobre env/temp | PASS — sólo `.env.example`; ningún archivo de `.temp`. |
| Escaneo de credenciales y comparación con valores locales | PASS — cero valores reales en archivos versionables. |
| Inspección de `supabase/` y tipos generados | PASS — sin schema, tablas, datos, RLS ni migrations de dominio. |
| `git diff --check` | PASS. |

El primer intento de las operaciones remotas dentro del sandbox no tuvo acceso de red/perfil. Se
repitieron con el acceso requerido y finalizaron correctamente; no fue un fallo de la implementación.

## Scope y riesgos residuales

- No se detectó scope creep hacia Auth, RLS, schema, datos o UI productiva.
- El ref aprobado aparece una sola vez en código ejecutable; sus repeticiones en documentación e
  informes son evidencia y pasos operativos, no fuentes de configuración competidoras.
- No se creó ni modificó ningún recurso remoto durante el review; las únicas operaciones remotas
  fueron listados, health check y lectura de schema para tipos.
- No hay evidencia de que TASK-003 haya apuntado realmente a PROD: el destino actual fue verificado
  como `salud-plus-turnos-dev`.
- La publishable key es pública por diseño y no sustituye RLS. El schema público está vacío, por lo
  que TASK-003 no introduce exposición de datos de dominio.

## Resultado

`PASS`

El hallazgo bloqueante quedó completamente resuelto y todos los criterios de TASK-003 fueron
reproducidos. La tarea queda lista para el protocolo de cierre, sin commit, push, merge, cierre ni
archive realizados durante este review.
