# Implementación — TASK-025

## Cambios

- `professionals-screen.tsx`: alta/vínculo y configuración en diálogos amplios; cambio de estado en confirmación compacta; descarte protegido; país por nombre con ISO alpha-2; validación local accesible con `FormFieldError`; copy aprobado.
- `country-options.json`: nombres de países en español y códigos ISO alpha-2 estáticos, derivados de la lista ISO existente. La lista estática evita diferencias de renderizado entre servidor y navegador.
- `professional-specialties-editor.tsx`: informa borrador y operación pendiente al diálogo; entrega los deltas guardados para actualizar el estado local sin desmontar el editor.
- `professional-actions.ts`: devuelve el `updated_at` que ya entrega la RPC de configuración para el siguiente guardado independiente. No cambia la RPC ni la validación del servidor.
- Pruebas focales de componentes y acción ampliadas. `docs/modules/professionals.md` registra el flujo de interfaz.

## Verificación

- `pnpm bootstrap`: PASS.
- `pnpm exec vitest run src/modules/professionals --reporter=dot`: 8 archivos, 104 pruebas PASS.
- `pnpm typecheck`: PASS.
- ESLint focal y Prettier focal: PASS.
- `git diff --check` en los archivos de la tarea: PASS.
- `node .harness/tasks/active/TASK-025-PROFESSIONALS-UX/visual-check.mjs`: Chromium sintético 1440/390 px PASS; modales centrados, sin desbordamiento, bordes gris/azul/rojo, descarte y retorno de foco. Sin capturas ni solicitudes a Supabase.

## Límites

En este primer checkpoint, la revisión manual autenticada en `localhost:3000` seguía pendiente. No se modificó Supabase DEV/PROD ni se ejecutaron migrations. Tampoco se había hecho commit, push ni PR.

## Corrección del 404 de Disponibilidad durante la revisión

- Los enlaces de ambos módulos ya usan `professional_centers.id`; la URL informada tiene UUID válidos.
- El 404 se reprodujo en la ruta de detalle sin sesión, mientras `/centers/[centerId]/availability` redirigía a `/login`. El registro de rutas del proceso Next.js activo omitía el detalle; `next typegen` generó correctamente esa ruta desde el código actual.
- Se invalidó el registro obsoleto mediante Fast Refresh al actualizar la marca de tiempo de `src/app/centers/[centerId]/professionals/[professionalCenterId]/availability/page.tsx`, sin cambiar su contenido ni reiniciar el servidor. La misma URL pasó de 404 a 307 hacia `/login`.
- `tests/e2e/availability-detail-route.spec.mjs` prueba que el servidor activo reconoce el detalle y exige autenticación; antes de la invalidación habría fallado con 404. Prueba: 1 PASS. La prueba existente de `AvailabilityScreen` cubre el estado sin horarios.
- No se alteró código de producto, consultas, permisos, RLS ni base de datos. La consulta remota de solo lectura intentada para descartar datos inconsistentes fue rechazada por la conexión/autenticación de DEV; el diagnóstico local resultó concluyente.

## Confirmaciones específicas de Profesionales

- La acción `setActive` ya no cae en el mensaje de configuración: distingue activación y desactivación según `isActive`. `update` conserva su mensaje propio y la acción de especialidades entrega el texto aprobado.
- El envío de especialidades borra sin demora una confirmación anterior y sólo presenta la nueva cuando la acción responde `success`. Cancelar no ejecuta la acción. Se mantienen las ramas existentes de error y conflicto.
- Pruebas focales de cuatro archivos: 62/62 PASS. Typecheck y ESLint focal: PASS. Prettier focal corregido. El servidor Next.js sigue en ejecución; la revisión manual de los mensajes queda a cargo de la persona usuaria.

## Ajustes finales de tabla y cierre

- La tabla presenta Especialidades después de Profesional, con nombres completos sólo para asociaciones y especialidades activas; muestra «Sin especialidades» cuando corresponde. Usa las props ya cargadas y refleja el resultado confirmado de un guardado hasta recibir el refresco autoritativo.
- Configurar usa «Cerrar» en el botón inferior. Cerrar, X, Escape y fondo conservan la misma comprobación de borrador; los guardados previos no se revierten. La tabla mantiene las demás columnas y acciones, con desplazamiento horizontal en móvil.
- `professionals-screen.test.tsx`: 37/37 PASS. El chequeo sintético Chromium a 1440 y 390 px pasó con nombres completos, columna y botones utilizables; no generó capturas. Typecheck y ESLint focal: PASS. Next.js en localhost:3000 no se reinició.

## Verificación final previa al PR (26/10/2026)

- La persona usuaria aprobó la interfaz en localhost:3000, tanto en escritorio como en móvil, y confirmó los accesos autenticados a Disponibilidad desde los dos módulos.
- La tabla muestra la indicación de desplazamiento sólo si desborda; sus tres acciones permanecen en una fila y calculan 44 px de altura uniforme. Chromium sintético a 390, 556 y 1440 px PASS, sin capturas nuevas.
- `pnpm exec vitest run src/modules/professionals src/modules/availability/components/availability-screen.test.tsx --reporter=dot`: 9 archivos, 134/134 pruebas PASS.
- `pnpm exec playwright test tests/e2e/availability-detail-route.spec.mjs --workers=1 --reporter=line`: 1/1 PASS sobre el servidor local existente; la ruta reconoce solicitudes no autenticadas y redirige a `/login`.
- `pnpm typecheck`, ESLint focal, Prettier focal y `git diff --check`: PASS. No se ejecutó build local para no interferir con Next.js en marcha; el workflow CI ejecuta `pnpm verify`, que incluye build.
- Alcance de publicación previsto: código, pruebas, documentación y expediente TASK-025. Se excluyen `next-env.d.ts`, secretos, artefactos y expedientes ajenos. Sin cambios de SQL, RPC, RLS, permisos ni contratos de identidad.
