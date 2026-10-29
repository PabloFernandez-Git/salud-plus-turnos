# TASK-033 — Gate técnico final previo a PR

**Dictamen: APPROVED.** La validación visual fue aprobada por la persona usuaria. El diff acumulado de TASK-033 frente a `origin/main` y sus archivos nuevos está técnicamente listo para preparar un commit selectivo y un PR hacia `main` cuando exista una autorización posterior. TASK-033 sigue ACTIVE; este gate no publica ni cierra la tarea.

## Alcance revisado

- Autorización server-side de PLATFORM_ADMIN, separación respecto de memberships de centro y visibilidad condicional del enlace.
- Navegación y loaders de dashboard/plataforma, incluidos acceso directo, recarga, espera y error.
- Alta de centros en tres pasos: email, contraseñas, revisión, descarte, intención persistida, `operation_id`, reintento idempotente y bloqueo ante resultado incierto o intención ilegible.
- Diálogo de activación/desactivación, selector IANA con etiquetas localizadas y DST, tabla/esquema móvil, foco, teclado y geometría responsive.
- Columna «Administrador» expresamente diferida; no hay lectura global de identidades ni SQL/RPC/migración nueva.

El inventario incluye los cambios tracked de `src/app/platform`, layout/header de centro, `src/modules/access`, `src/modules/dashboard`, documentación y los archivos nuevos de tests, `NavigationLoader`, etiquetas de zona horaria y expediente. `git diff origin/main` por sí solo no muestra los untracked; se revisaron además esos archivos. `next-env.d.ts` aparece modificado previamente y **no pertenece al commit futuro de TASK-033**. Los untracked ajenos también deben excluirse.

### Archivos del cambio

| Área                | Archivos                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rutas y navegación  | `src/app/platform/{page,loading}.tsx` y sus tests nuevos; `src/app/centers/[centerId]/layout.tsx` y su test; `src/components/navigation-loader.tsx` y test nuevos.                                                            |
| Acceso y alta       | `src/modules/access/server/access.ts`; `src/modules/access/components/{center-header,center-dashboard,center-status-form,create-center-panel,platform-centers-table,use-platform-operation-intent}` y tests afectados/nuevos. |
| Dashboard           | `src/modules/dashboard/components/daily-dashboard-panel.tsx` y test.                                                                                                                                                          |
| Zona horaria        | Nuevos `src/modules/access/domain/timezone-country-codes.ts`, `timezone-label.ts` y `timezone-label.test.ts`.                                                                                                                 |
| Memoria y evidencia | `docs/modules/{access,centers,dashboard}.md`, `docs/status.md`, `.harness/tasks/active/TASK-033/{brief,plan,implementation-report,review,gate-report}.md`, scripts visuales y `evidence/` del expediente.                     |

`src/app/centers/[centerId]/page.tsx` y su test aparecen modificados por el estado local de finales de línea, pero sin diferencia de contenido frente a `origin/main`. No forman parte de un cambio funcional del PR.

## Verificaciones ejecutadas

| Comprobación                                             | Resultado                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` (segunda corrida exacta)                    | **PASS**: ESLint 0 errores y 1 warning preexistente; TypeScript PASS; Vitest 101/101 archivos y 929/929 pruebas; tooling TASK-007 11/11 y TASK-021 20/20.                                                                                                 |
| `pnpm check` (primera corrida)                           | FAIL por 3 pruebas intermitentes bajo carga: foco en `add-center-user-panel`, timeout de selector IANA y timeout en Pacientes. El test largo IANA recibió timeout propio de 15 s. Pacientes pasó 41/41 aislado y la segunda corrida exacta pasó completa. |
| Vitest completo con `--maxWorkers=2 --testTimeout=15000` | **PASS**, 101/101 archivos y 929/929 pruebas. Esta corrida controlada distingue el comportamiento del producto de la carga de workers local.                                                                                                              |
| Pruebas focales TASK-033 (15 archivos)                   | **PASS**, 107/107 pruebas de rutas, permisos, modal, intención, estado, dashboard, loaders, tabla, schemas, servidor y zona horaria.                                                                                                                      |
| `pnpm format:check` global                               | FAIL en 264 archivos de código y configuración ajenos a TASK-033, tanto antes como después de corregir el formato de este reporte Markdown nuevo. No se reformatearon archivos ajenos.                                                                    |
| Prettier focal de los 31 archivos de código de TASK-033  | **PASS**. Incluye tracked modificados y nuevos `.ts`, `.tsx` y scripts `.mjs` del expediente; excluye `next-env.d.ts` preexistente.                                                                                                                       |
| `git diff --check`                                       | **PASS** para archivos tracked; Git advierte sobre futura conversión LF→CRLF, sin errores de whitespace. Los nuevos se comprobaron con Prettier focal y deberán incluirse en la revisión staged cuando se autorice un commit.                             |
| Evidencia visual existente                               | Revisadas capturas y resultados Chromium sintéticos de 390, 556 y 1440 px de las iteraciones, con viewport bajo para modal. La persona usuaria aprobó formalmente el resultado visual.                                                                    |

No se ejecutaron E2E autenticados ni consultas a Supabase DEV/PROD. El harness visual usa componentes reales con Auth, acciones y router sintéticos; no demuestra una transición real de Next ni datos persistidos. No se ejecutó `next build` porque no integra el gate pedido y podría interferir con el servidor Next existente.

## Revisión independiente y riesgos residuales

La revisión independiente del diff completo, archivos nuevos, seguridad, regresiones, mantenibilidad y documentación devolvió **APPROVED, sin bloqueantes**. Confirmó la autorización de plataforma en servidor, la conservación de `operation_id`, la ausencia de datos clínicos y la columna de ADMIN diferida.

**P2 conocido de disponibilidad:** `src/app/centers/[centerId]/layout.tsx` consulta `hasPlatformAdminRole` después de autorizar la membership. Si sólo falla la lectura adicional de `platform_admins`, una página tenant válida puede mostrar error. No concede acceso indebido ni mezcla centros. Se mantiene como mejora separada, sin ampliar silenciosamente TASK-033. La espera previa del layout tampoco muestra el loader de página en acceso directo, para conservar semántica de autorización/HTTP.

**Mejora diferida:** mostrar ADMIN activos actuales exige una RPC global de lectura por lote y contrato tipado, limitada a PLATFORM_ADMIN. La persona usuaria eligió no agregarla en esta iteración; la UI conserva sólo «Email del centro» y no infiere administradores a partir del alta inicial.

La advertencia ESLint ajena está en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238`. El formato global y la intermitencia observada en la primera corrida no fueron ocultados; el comando exacto `pnpm check` pasó en la segunda.
El Markdown focal del expediente y de `docs/status.md`, `docs/modules/access.md` y `docs/modules/centers.md` pasa Prettier. `docs/modules/dashboard.md` falla Prettier también en `origin/main`; se conservó su formato preexistente.

## Estado de preparación

Listo para **preparar** un commit selectivo y PR cuando se autorice expresamente. Antes de ello, seleccionar sólo los archivos de TASK-033, incluidos nuevos componentes/tests y expediente; excluir `next-env.d.ts`, `.env.local` y todo archivo local ajeno. No hubo commit, push, PR, merge, despliegue, operación Supabase ni modificación de TASK-029. La rama sigue `codex/task-033-centers-ux`; checkpoint TASK-029 `a04f8a749781288ebdea55a2ebb868fd0aa6de1e` intacto.
