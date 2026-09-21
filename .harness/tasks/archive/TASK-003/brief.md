# TASK-003 — Configurar Supabase DEV

**Estado:** `READY_FOR_REVIEW`

## Objetivo

Dejar el repositorio preparado para conectarse de forma segura, verificable y reproducible a un proyecto Supabase exclusivo de Development, sin diseñar todavía el esquema productivo ni realizar ninguna operación contra Production.

La tarea debe explicar y comprobar la identidad del proyecto DEV, la clasificación de variables, los límites de los clientes de Next.js, la conectividad mínima y la generación real de tipos TypeScript desde el esquema `public` de DEV.

## Contexto relevante

- `AGENTS.md`
- `.harness/README.md`
- `.harness/protocols/startup.md`
- `.harness/protocols/task-loop.md`
- `.harness/agents/orchestrator.md`
- `docs/product.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/database-workflow.md`
- `docs/coding-conventions.md`
- `docs/decisions/03-base-de-datos-y-plataforma-de-datos.md`
- `docs/decisions/13-acceso-a-postgresql.md`
- `docs/decisions/16-estrategia-de-entornos-supabase.md`
- `docs/decisions/21-supabase-cli-migrations-y-tipos-typescript-generados.md`
- `docs/stack/30-supabase-client.md`
- `docs/stack/31-seguridad-basica-del-mvp.md`
- `docs/stack/33-entornos-supabase.md`
- `docs/stack/38-supabase-cli-migrations-y-tipos-generados.md`
- `.env.example`
- `.gitignore`
- `package.json`
- `scripts/bootstrap.mjs`
- `scripts/generate-db-types.mjs`
- `scripts/seed-dev.ts`
- `supabase/README.md`
- `src/lib/supabase/README.md`

## Estado inicial verificado

- La rama fue creada desde `main` limpia y sincronizada con `origin/main` en el commit `31f4b22`.
- `pnpm bootstrap` pasa con Node.js `24.21.0` y pnpm `11.26.0`.
- `.env.local` no existe y está excluido por `.gitignore` mediante `.env.*`.
- El único archivo de entorno versionado es `.env.example` y contiene placeholders.
- Las dependencias `@supabase/supabase-js`, `@supabase/ssr` y `supabase` ya están declaradas.
- `pnpm db:types` existe, pero el script actual espera `SUPABASE_DEV_PROJECT_REF` en `process.env`; un proceso Node independiente no carga `.env.local` automáticamente.
- No existen todavía clientes Supabase ni `database.types.ts` productivos bajo `src/lib/supabase/`.
- No hay una identidad de proyecto DEV ni credenciales locales confirmadas. Por eso la tarea no puede pasar aún a implementación.

## Decisiones de configuración para esta tarea

### Entorno y región

- El proyecto debe ser exclusivo de Development y distinguible de Production, preferentemente con el nombre `salud-plus-turnos-dev`.
- Para desarrollo desde Argentina se seleccionará la región específica **South America (São Paulo), `sa-east-1`**, por proximidad geográfica y para evitar que una región general ubique el proyecto en otra zona.
- El `project ref` se obtendrá del Dashboard o de la URL del proyecto y se comprobará contra el host `https://<project-ref>.supabase.co`. No se inventará ni se confundirá con el nombre visible o el identificador de la organización.

### Clasificación de variables y credenciales

| Clasificación | Valores | Regla |
| --- | --- | --- |
| Seguros para navegador | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pueden llegar al bundle; su alcance real debe quedar limitado por grants y RLS cuando exista schema. |
| Locales no secretas | `APP_ENV`, `SUPABASE_DEV_PROJECT_REF` | Identifican el entorno; no necesitan prefijo público ni deben usarse para autorizar. |
| Secretos server-side | `SUPABASE_SECRET_KEY` si se adopta la clave moderna, o `SUPABASE_SERVICE_ROLE_KEY` sólo si sigue siendo necesaria por compatibilidad | Nunca llevan prefijo `NEXT_PUBLIC_`, nunca se importan desde Client Components y nunca se versionan. Bypassean RLS. |
| Secretos operativos | contraseña de base y `SUPABASE_ACCESS_TOKEN` de la CLI | Se guardan en el password manager o credential store del usuario; no se escriben en documentación, logs, Git ni se comparten por chat. |

Supabase recomienda actualmente claves `publishable` para componentes públicos y claves `secret` para backend. La implementación deberá resolver explícitamente la transición desde el contrato legado `SUPABASE_SERVICE_ROLE_KEY` ya presente en el repositorio. No se obtendrá ni conservará una clave privilegiada si ninguna comprobación aceptada la necesita. En cualquier caso, `SUPABASE_SERVICE_ROLE_KEY` debe quedar técnica y verificablemente fuera del navegador.

### Operaciones permitidas contra DEV

- inspeccionar identidad, región, salud y configuración del proyecto;
- autenticar la CLI en la máquina del usuario sin registrar el token en el repositorio;
- realizar requests de conectividad de sólo lectura;
- generar tipos TypeScript desde el schema `public` real;
- más adelante, crear y aplicar migrations versionadas a DEV en tareas que lo autoricen expresamente;
- usar datos ficticios sólo cuando una tarea posterior defina el seed.

### Operaciones prohibidas automáticamente contra PROD

- vincular esta rama o los scripts locales con el proyecto PROD;
- aplicar migrations, `db push`, seeds o resets;
- crear, editar o borrar tablas, datos, usuarios, buckets o secretos;
- copiar credenciales DEV a Production o viceversa;
- ejecutar pruebas de conectividad privilegiada contra PROD;
- realizar cualquier cambio de configuración desde un agente sin autorización humana explícita.

## Criterios de aceptación

### Proyecto DEV e identidad

- [ ] Existe un proyecto Supabase exclusivo de Development y está claramente separado de cualquier proyecto Production.
- [ ] El proyecto está en **South America (São Paulo), `sa-east-1`**, o una excepción humana queda documentada antes de implementar.
- [ ] El nombre visible, el `project ref`, la URL y la región fueron contrastados en el Dashboard sin registrar secretos.
- [ ] La URL configurada contiene exactamente el `project ref` de DEV y los scripts rechazan una discrepancia.
- [ ] Ningún comando ejecutado durante TASK-003 apunta a un `project ref`, URL o credencial de PROD.

### Variables y archivos locales

- [ ] `.env.local` contiene sólo las variables necesarias para DEV y permanece fuera de Git.
- [ ] `.env.example` documenta placeholders y clasificación, sin ningún valor real.
- [ ] `git check-ignore .env.local` confirma la exclusión y `git ls-files` confirma que no está versionado.
- [ ] Sólo la URL y la publishable key usan el prefijo `NEXT_PUBLIC_`.
- [ ] La contraseña de base, el token personal de la CLI y cualquier clave privilegiada permanecen fuera de `.env.example`, documentación, logs y archivos versionados.
- [ ] El bootstrap valida presencia y coherencia de la configuración sin imprimir valores.

### Frontera browser/server

- [ ] El cliente de navegador, si resulta necesario para esta infraestructura, usa exclusivamente URL + publishable key.
- [ ] El cliente de servidor para sesiones, si resulta necesario, usa `@supabase/ssr`, URL + publishable key y queda preparado sin implementar Auth funcional.
- [ ] Un cliente administrativo no se crea por anticipado; si una comprobación aprobada lo exige, vive en un módulo marcado `server-only` y separado de los clientes normales.
- [ ] Ningún Client Component, módulo importable por navegador, `next.config.ts` ni configuración equivalente referencia `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN` o contraseña de base.
- [ ] Existe una verificación reproducible, con un valor centinela sintético y no con un secreto real, de que las credenciales privilegiadas no aparecen en artefactos cliente.

### Conectividad y tipos

- [ ] Existe una comprobación básica, de sólo lectura y repetible que confirma conexión con el proyecto DEV esperado sin crear schema, tablas ni datos.
- [ ] La comprobación falla de forma segura si URL y `project ref` no coinciden o si `APP_ENV=production`.
- [ ] La CLI queda autenticada mediante una acción local del usuario o un mecanismo equivalente que no exponga el token.
- [ ] `pnpm db:types` carga de forma reproducible la configuración local necesaria, se ejecuta realmente contra DEV y termina con exit code `0`.
- [ ] `pnpm db:types` genera `src/lib/supabase/database.types.ts` desde el schema `public` real y el archivo no se edita manualmente.
- [ ] Los tipos generados no contienen ninguna de las tablas de dominio prohibidas por el alcance de TASK-003.

### Reproducibilidad, seguridad y evidencia

- [ ] Existe una guía versionada para repetir la configuración en otra máquina desde un clon limpio, usando placeholders y credential storage seguro.
- [ ] La guía explica creación/selección del proyecto, región, obtención del `project ref`, variables, login de CLI, conectividad, generación de tipos y troubleshooting mínimo.
- [ ] La guía distingue expresamente DEV de PROD y enumera las operaciones prohibidas contra PROD.
- [ ] `pnpm bootstrap`, `pnpm format:check`, `pnpm check`, `pnpm build`, la comprobación de conectividad y `pnpm db:types` pasan.
- [ ] El informe de implementación registra comandos y resultados sanitizados, sin valores reales.
- [ ] Un Reviewer independiente y especialistas de Security/Database verifican la frontera de secretos, el destino DEV, el diff generado y la ausencia de cambios en PROD.

## Impactos

- Security: sí, alto — clasificación de claves, manejo local de secretos y prevención de exposición al bundle.
- Authorization: no funcional — no se implementan usuarios, memberships, roles ni políticas del dominio.
- Database: sí, infraestructura — conexión e introspección de DEV, sin schema productivo ni cambios estructurales.
- Documentation: sí — procedimiento reproducible y actualización del estado.
- Testing: sí — checks de coherencia, conectividad, generación de tipos y frontera server/browser.
- Dependencies: no previsto — las dependencias necesarias ya están declaradas; cualquier agregado requiere justificación.
- Production: prohibido — no se autoriza ninguna lectura privilegiada ni mutación automática contra PROD.

## Riesgos

- Elegir por error el proyecto o `project ref` de PROD. Se mitiga validando nombre, URL, ref y región antes de cada operación y usando nombres de comandos explícitos para DEV.
- La región de un proyecto es una decisión difícil de cambiar. Debe elegirse São Paulo al crearlo, antes de cargar configuración.
- Supabase está migrando de las claves legadas `anon`/`service_role` a `publishable`/`secret`. El repositorio ya usa publishable key pero conserva el nombre legado `SUPABASE_SERVICE_ROLE_KEY`; la implementación debe resolver esa compatibilidad sin ampliar privilegios.
- Una publishable key es visible por diseño, pero no reemplaza RLS. TASK-003 no crea tablas y no debe presentar esa clave como mecanismo de autorización.
- `pnpm db:types` depende de autenticación de CLI y hoy no carga `.env.local` por sí mismo; una configuración sólo válida dentro de Next.js no cumpliría reproducibilidad.
- La CLI guarda un token en el credential store del usuario o, si no está disponible, en un archivo de su perfil. El usuario debe realizar o supervisar ese login y no compartir el token.
- Los quickstarts del Dashboard pueden invitar a crear tablas de ejemplo. Hacerlo violaría el alcance y debe evitarse.
- Un smoke test mal diseñado podría escribir datos o requerir una clave privilegiada sin necesidad. Debe ser de sólo lectura y usar la publishable key siempre que sea posible.
- El proyecto gratuito puede estar pausado o tardar en aprovisionarse; una falla transitoria no debe confundirse con credenciales incorrectas.

## Fuera de alcance

- Diseñar o crear el esquema completo del producto.
- Crear tablas de pacientes, profesionales, turnos, disponibilidad, especialidades o memberships.
- Crear tablas de ejemplo desde los quickstarts de Supabase.
- Implementar Supabase Auth funcional, proxy de refresh, login, logout o usuarios de prueba.
- Implementar autorización, memberships, roles o RLS del dominio.
- Implementar seeds completos o ejecutar `db:seed:dev`.
- Conectar la agenda o cualquier UI productiva a datos reales.
- Crear lógica productiva, migrations de dominio o funciones PostgreSQL.
- Configurar Vercel Preview/Production.
- Crear o modificar el proyecto Supabase PROD.
- Hacer commit, push, merge o cerrar la tarea durante esta etapa.

## Acción humana requerida

Antes de delegar la implementación, el usuario debe crear o confirmar el proyecto DEV desde el Dashboard de Supabase y preparar las credenciales en su propia máquina. Los pasos exactos están en `plan.md`.

No debe pegar en el chat la contraseña de base, un `SUPABASE_ACCESS_TOKEN`, una secret key ni una service-role key. Puede completar `.env.local` directamente y autenticar la CLI localmente. Después sólo necesita confirmar que esos pasos terminaron y, si se solicita para validar identidad, compartir el nombre del proyecto, la región y el `project ref`, que no son secretos.

## Condición de salida de esta etapa

La acción humana fue confirmada, la implementación y sus verificaciones terminaron, y TASK-003 queda
en `READY_FOR_REVIEW`. No se autorizaron operaciones contra PROD ni se amplió el alcance.
