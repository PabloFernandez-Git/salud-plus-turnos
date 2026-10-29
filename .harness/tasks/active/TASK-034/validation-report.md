# TASK-034 — Fase C: validación funcional

**Dictamen:** `FUNCTIONAL_VALIDATION_APPROVED`. TASK-034 sigue ACTIVE, sin commit, PR ni despliegue.

## Entorno y tipo de prueba

Se levantó **Next.js 16.3.5 con webpack en `127.0.0.1:31034`**, con un directorio de salida separado. Las rutas del fixture reexportaron las páginas y layouts reales del repositorio; `access.ts`, `authorization.ts`, el encabezado, el enrutamiento y `error.tsx` fueron código real. Un cliente Supabase sintético, seleccionado por cookie de escenario, sustituyó Auth y las consultas. Los componentes de dashboard, alta y lista de plataforma se sustituyeron por contenido sintético. El proceso se inició con valores públicos ficticios y sin credenciales reales de Supabase; no se consultó DEV/PROD ni se usaron identidades reales. `localhost:3000` permaneció intacto. El fixture temporal quedó en la caché ignorada `node_modules/.cache/task034-next-fixture` y la instancia se detuvo al terminar.

La prueba recorrió **HTTP, routing, Server Components, redirecciones y frontera de error reales de Next.js en Chromium**. No es E2E autenticado con Supabase real ni valida persistencia, RLS desplegada o acciones administrativas. El script de navegación es `functional-next-check.mjs` y sus resultados están en `evidence/results.json`, `evidence/results-focused.json`, `evidence/results-loading.json` y `evidence/results-navigation.json`.

## Escenarios y resultados

| Área                                                                            | Resultado observado                                                                                                                                                                                     | Estado   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A. Centro con membresía y centro activos; falla `platform_admins`               | HTTP 200, contenido visible, sin enlace «Administrar plataforma» ni error general                                                                                                                       | PASS     |
| B. `/` con un centro o dos, y `/select-center` con uno; falla `platform_admins` | Destino correcto: centro o selector; sin bucle ni enlace global                                                                                                                                         | PASS (3) |
| B. Navegación Centro → Plataforma → Centro con permiso confirmado               | Los enlaces reales cambian de ruta en ambos sentidos y muestran el contenido autorizado                                                                                                                 | PASS     |
| C. Sin centros y permiso desconocido                                            | HTTP 500 con mensaje genérico y botón manual; permanece en `/`, sin `/no-access` automático                                                                                                             | PASS     |
| C. Reintento mientras persiste el fallo y tras recuperación                     | Nueva petición 500 mantiene el mensaje; después, permiso positivo redirige a `/platform`                                                                                                                | PASS     |
| C. Sin centros y permiso negativo confirmado                                    | Redirige a `/no-access`                                                                                                                                                                                 | PASS     |
| D. `/platform`                                                                  | Permiso positivo: 200. Negativo o fallo de consulta: 307 hacia `/no-access`, sin contenido de plataforma. La ruta `/no-access` puede reenviar al centro si existe membresía válida, sin elevar permisos | PASS (3) |
| E. Sin membresía, membresía inactiva o centro inactivo                          | HTTP 404                                                                                                                                                                                                | PASS (3) |
| E. Rol insuficiente en la ruta real de usuarios                                 | HTTP 404                                                                                                                                                                                                | PASS     |
| E. Sesión inválida                                                              | Redirige a `/login` sintético                                                                                                                                                                           | PASS     |
| E. Error de membresía o de centro                                               | HTTP 500 y error genérico; sin contenido tenant                                                                                                                                                         | PASS (2) |
| Carga focal de `/platform`                                                      | `AppLoader` visible durante una lectura lenta; desaparece al mostrar la página                                                                                                                          | PASS     |

**Total: 18 escenarios distintos PASS.** Las rutas de éxito no produjeron errores de consola ni excepciones de página. Los 404 y 500 simulados registraron los errores esperados en consola de desarrollo; el mensaje visible no mostró los detalles internos. Capturas relevantes: `evidence/center-global-error.png`, `unknown-global-error.png`, `retry-recovered.png` y `platform-loading.png`. La insignia roja en la captura del error procede del overlay de Next en modo desarrollo.

## Defecto encontrado y corrección

El primer recorrido mostró que `reset()` del `error.tsx` raíz no lanzaba una nueva petición HTTP para el error de Server Component en `/`. El botón permanecía en el mismo error después de recuperar el servicio sintético. Se cambió **sólo** ese botón a `window.location.reload()`, que inicia una petición nueva por cada clic. El reintento fallido y el recuperado pasaron en Chromium; no hay reintento automático. Se ajustó el test focal del componente.

## Verificaciones posteriores a la corrección

- Chromium y Next real: 16/16 escenarios principales PASS; repetición focal con estilos reales: 2/2 PASS; carga de `/platform`: 1/1 PASS; navegación Centro → Plataforma → Centro: 1/1 PASS.
- Vitest focal de `src/app/error.test.tsx`: 1/1 PASS. Las otras 63 pruebas focales de Fase B no se repitieron porque su código no cambió.
- TypeScript: PASS. ESLint de `error.tsx` y su test: PASS. Prettier focal y `git diff --check`: PASS.

## Límites y tiempos

Quedan para el gate final las verificaciones completas y la revisión independiente. No se validaron Supabase real, RLS desplegada, login con contraseña, operaciones administrativas, el loader previo al layout tenant ni todos los tamaños responsive.

Tiempos aproximados: preparación del fixture ~5 min; navegación y análisis de evidencias ~8 min; corrección del reintento ~3 min; verificaciones focales ~4 min; documentación ~2 min. La compilación inicial de Next y la ejecución en Chromium explican la mayor parte del tiempo.
