# TASK-030 — Implementación y verificación UX

**Estado:** cuatro iteraciones UX aprobadas visualmente; gate técnico final y PR en preparación. TASK-030 permanece ACTIVE hasta la integración y el cierre documental autorizados.

## Cambios

- Listado en tarjetas compactas de dos columnas en escritorio y una en móvil; paciente, fecha/hora civil y estado tienen jerarquía clara. Las cinco etiquetas incluyen texto. Filtros, accesos rápidos, cursor y contrato de búsqueda permanecen intactos.
- Detalle más amplio con paciente, fecha/hora y estado destacados; zona horaria derivada de la configuración del centro y offset visible para distinguir horas DST. No se agregaron datos a la proyección Professional.
- Confirmaciones explícitas para Atendido, Ausente y Cancelado, con distinta prioridad visual. Matriz de transiciones, permisos, CAS y manejo de resultado incierto siguen iguales.
- Nota en lectura por defecto; editar, guardar, cancelar y eliminar sin terminología técnica. Se conserva `NULL` frente a `""` y texto; se protege el borrador ante cancelación, acciones internas, enlaces y descarga de página.
- Reprogramación en `<dialog>` nativo con selector y búsqueda existentes, foco inicial y retorno al disparador, Escape y confirmación de descarte. Error y recarga quedan accesibles dentro del diálogo tras conflicto o resultado incierto.

## Archivos de producto modificados

- `src/modules/appointments/components/appointments-list.tsx` y test.
- `src/modules/appointments/components/appointment-detail-screen.tsx` y test.
- `src/modules/appointments/components/booking-selector.tsx` (señal de interacción para detectar cambios sin guardar).
- `src/modules/appointments/search/appointment-search.ts` y test (presentación de fecha y zona).

## Verificación

- `pnpm bootstrap`: PASS antes del cambio de rama.
- `tsc --noEmit`: PASS con ejecutable instalado.
- ESLint focal: PASS sin errores ni warnings tras corrección.
- Prettier focal: PASS.
- Vitest general: 93 archivos, 731/731 PASS. Tras cambios finales, Vitest focal: 4 archivos, 23/23 PASS.
- Tooling Node: 31/31 PASS.
- `git diff --check`: PASS.
- Chromium local con componentes reales y fixtures sintéticas: PASS en 1440 × 900 y 390 × 844 para listado, detalle, nota en edición, modal y descarte; sin overflow horizontal ni errores de página. Evidencia en `evidence/`, resultado en `evidence/results.json`.
- Servidor Next.js existente: `GET /login` respondió 200 después del cambio de rama. No se detuvo ni reinició.
- Suites DEV/SQL/HTTP y E2E con infraestructura no ejecutadas: tarea UX, sin acceso remoto ni migraciones autorizadas.
- `pnpm` intentó reconciliar `node_modules` de TASK-029 con el lockfile de `main` y abortó sin TTY. Se usaron los binarios instalados sin reemplazar dependencias ni interrumpir Next.js.

## Revisión y límites

Revisión independiente focal: PASS tras resolver cinco hallazgos de interacción (recarga y error en modal, protección de nota, enlace externo al componente y foco al volver del descarte). Ver `review.md`.

El historial Back/Forward de navegación SPA aún puede evadir las confirmaciones del borrador de nota; las rutas de botón, enlaces y salida de página quedan cubiertas. Documentar una solución de bloqueo de historial compatible con App Router en una segunda iteración si la validación de uso lo exige. La revisión visual usa fixtures locales; no demuestra integración con Supabase desplegado.

`Marcar atendido` sigue visible según la matriz actual incluso antes del horario. No hay restricción por hora en las reglas escritas; no se cambió.

## Decisión solicitada tras la primera iteración (registro histórico)

En ese punto se solicitó revisar listado y detalle en la aplicación abierta, en escritorio y móvil. La persona usuaria aprobó esa base y pidió tres iteraciones adicionales; la restricción de no crear commit/PR correspondía a esa etapa y fue reemplazada por la autorización del gate final.

## Segunda iteración — fechas, horarios y navegación

- `CivilDatePicker` nuevo, sin dependencia: fecha DD/MM/AAAA, calendario inline con navegación mensual y por teclado, foco visible, cierre con Escape/Tab/clic externo y fecha civil del centro como referencia. La aritmética de días/meses es gregoriana sobre `YYYY-MM-DD`; no convierte la fecha por el huso del dispositivo. El valor para Action y búsqueda sigue siendo la fecha civil original `YYYY-MM-DD`.
- `BookingSelector` reutilizado por Crear turno y Reprogramar muestra únicamente los slots retornados por PostgreSQL para la fecha como botones compactos. La selección conserva `starts_at` exacto; si hay dos franjas con la misma hora civil, muestra el offset de cada una también en el resumen previo a guardar. `displayOffset` es sólo visual y no entra al payload de las Actions. Estados de carga, falta de disponibilidad, error y reseteos se conservan.
- `Volver a turnos` aparece en el encabezado del detalle y apunta al listado del mismo centro; se conserva el breadcrumb. El regreso directo no restaura filtros previos, conforme al alcance aprobado.
- `Eliminar nota` se muestra sólo con texto no vacío. Se mantiene `NULL` y cadena vacía como valores diferentes.
- Cursores pointer/not-allowed, hover y focus-visible en botones, selectores, filtros y enlaces de Turnos. El footer del modal de reprogramación queda visible al recorrer varios horarios en móvil.

### Verificación de segunda iteración

- Vitest general: **94 archivos, 739/739 PASS**. Tests focales finales de calendario, selector, alta, detalle y listado: **34/34 PASS**.
- TypeScript, ESLint focal, Prettier focal y `git diff --check`: PASS.
- Chromium local con componentes reales y datos sintéticos: 1440 × 900 y 390 × 844, Crear turno y modal de Reprogramar, calendarios abiertos, doce slots y último slot seleccionable; sin overflow ni errores de página. Evidencia en `evidence-iteration-2/`.
- El navegador de fixture se configuró en `Pacific/Auckland` y el centro en `America/Argentina/Buenos_Aires`; la fecha civil presentada y enviada permaneció la del centro.
- Review independiente focal: PASS tras corregir continuidad del offset DST en resúmenes, semántica de error y advertencias de ESLint/accesibilidad. Ver `review.md`.
- No se ejecutaron E2E/SQL/HTTP contra DEV o PROD ni migrations: fuera del alcance de esta iteración UX. `pnpm bootstrap` como wrapper abortó antes de modificar dependencias; `node scripts/bootstrap.mjs` pasó. El servidor Next.js existente no se detuvo ni reinició.

### Riesgos y límites para inspección visual

- El calendario usa navegación mensual; no incluye salto directo de año ni entrada manual de fecha.
- El listado de slots en móvil puede requerir desplazamiento vertical; el footer de Reprogramar queda visible y el último slot fue seleccionable en Chromium.
- El enlace de regreso va al listado sin preservar filtros previos.
- Persiste la limitación de la primera iteración: Back/Forward SPA puede evitar la confirmación de descarte de una nota sin guardar.

## Tercera iteración — paciente, continuidad de horarios y carga de Reprogramar

- Crear turno exige paciente antes de habilitar especialidad, profesional, calendario y horarios. El resumen guía el primer paso. Al cambiar un paciente existente se descarta la selección dependiente; cuando Agenda abre el formulario sin paciente, el horario precargado se aplica tras la primera selección, y se descarta si luego se cambia de paciente o el servidor rechaza el slot.
- Los resultados de pacientes son tarjetas legibles en móvil, con CTA de 44 px y nombre accesible específico. El paciente elegido queda destacado. La Action de búsqueda y sus estados no cambiaron.
- El selector combina los slots exactos de PostgreSQL con **referencias deshabilitadas** derivadas de los intervalos semanales y la duración habitual. Completa también los huecos entre intervalos de una jornada. El máximo es 288 referencias, no se crean opciones seleccionables y las filas visuales no participan del payload. Si falla la lectura de disponibilidad y hay slots SQL, se muestran sólo los slots SQL. Si fallan los slots SQL, se muestra error.
- El detalle omite la etiqueta extensa de zona en horas inequívocas; en la hora local repetida por DST conserva el offset para distinguir el instante. La descripción y el texto de Reprogramar son más directos.
- El modal de Reprogramar muestra un estado de carga estable hasta resolver los catálogos y horarios iniciales. El selector posterior conserva la interacción y validación existentes.

### Verificación de tercera iteración

- Vitest focal final: 5 archivos, **39/39 PASS**. Suite general final: 95 archivos, **747/747 PASS**.
- TypeScript y ESLint focal: PASS. Fixture Chromium local a 1440 × 900 y 390 × 844: PASS sin errores de página ni desborde horizontal. Incluye paciente pendiente/resultado/seleccionado, huecos deshabilitados, calendario, modal en carga y cargado. Evidencia en `evidence-iteration-3/`.
- Review independiente: hallazgos sobre traspaso de Agenda sin paciente, huecos entre intervalos, nombre accesible del CTA y orden DST corregidos y cubiertos por tests focales. Ver `review.md`.
- No hubo cambios de contratos, SQL, RLS, permisos, dependencias, DEV o PROD. El servidor Next.js existente no se detuvo ni reinició. No se creó commit, push, PR ni merge.

La evidencia visual usa datos sintéticos y no demuestra la integración remota con Supabase. La confirmación final de la UX queda para la revisión de la persona usuaria.

## Pulido visual final — aprobado por la persona usuaria

- Las acciones del detalle usan cuadrícula de dos columnas en móvil. Con cuatro acciones quedan dos por fila; con tres, la primera ocupa el ancho y las otras dos comparten la segunda fila. Con dos acciones (Professional) quedan proporcionadas. No se agregan controles ni se cambia su orden, estilo de prioridad, confirmación o habilitación. En escritorio continúa el layout flex.
- Los dos accesos rápidos del listado ocupan el ancho completo en móvil, tienen mínimo de 48 px y conservan su disposición horizontal en escritorio. El período coincidente se destaca usando exclusivamente `today` y los filtros ya recibidos; `aria-current="true"` describe el período también cuando hay paginación. Los destinos y parámetros existentes no cambian.
- `NULL` y cadena vacía de nota muestran «Sin nota administrativa.» y «Agregar nota»; el texto guardado muestra «Editar nota» y «Eliminar nota». Los valores persistidos, payloads, protección de borradores y Actions no cambian.

### Verificación focal

- Vitest de listado/detalle: **2 archivos, 19/19 PASS**. TypeScript, ESLint focal, Prettier y `git diff --check`: PASS.
- Chromium local con componentes reales y datos sintéticos a 1440 × 900 y 390 × 844: PASS. Capturas de cuatro y tres acciones, dos acciones Professional, accesos rápidos, nota con texto y nota `NULL`/vacía en `evidence-final/`; sin overflow horizontal ni errores de página.
- Review independiente: PASS tras corregir la semántica de `aria-current` para páginas paginadas. Ver `review.md`.
- La matriz actual no produce exactamente una acción visible: los casos vigentes son cuatro, tres, dos o ninguna. El layout de una acción queda de ancho completo por su clase `grid-cols-1`, sin fabricar un caso o botón artificial.
- Se conservaron la rama y todos los cambios locales previos, incluido `next-env.d.ts`. No se detuvo Next.js, no se accedió a DEV/PROD y no hubo cambios en TASK-029, SQL, RPC, RLS, permisos o reglas temporales. Sin commit, push, PR ni merge.

## Gate técnico final — 2026-10-27

La persona usuaria aprobó visualmente las cuatro iteraciones y autorizó commit, publicación de esta rama y PR a `main`. Merge, despliegue y archivo de TASK-030 siguen sin autorización. El diff de producto se limita a componentes y búsqueda del módulo Turnos y sus tests; la documentación de este expediente, `docs/modules/appointments.md` y `docs/status.md` explica alcance y estado.

### Comprobaciones de esta intervención

- `pnpm check`: **no ejecutó sus scripts**. El wrapper de pnpm intentó reconciliar `node_modules` y abortó con `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. No se forzó la purga ni se cambiaron dependencias.
- Equivalentes con binarios instalados: ESLint completo PASS, **0 errores y 1 warning preexistente** en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238` (`oid` sin uso); TypeScript `tsc --noEmit` PASS; Vitest completo **95 archivos, 751/751 PASS**; tooling Node TASK-007 **11/11 PASS** y TASK-021 **20/20 PASS**.
- Pruebas focales de siete archivos de TASK-030: **51/51 PASS**. Prettier focal en componentes y búsqueda de Turnos: PASS.
- E2E con Supabase, SQL y pruebas remotas: omitidas por restricción expresa de no modificar DEV/PROD y porque este gate no autoriza datos reales. Las capturas sintéticas aprobadas de escritorio 1440 px y móvil 390 px están en `evidence/`, `evidence-iteration-2/`, `evidence-iteration-3/` y `evidence-final/`; los respectivos `results.json` registran las aserciones visuales.

### Decisiones y límites

- La selección usa sólo `starts_at` exactos de PostgreSQL; los huecos visuales nunca se pueden elegir. Fecha civil del centro, offsets DST, CAS, rol y validación de servidor permanecen como autoridad.
- Quedó aprobada la jerarquía móvil de cuatro acciones en dos columnas, tres con la principal en primera fila, accesos rápidos uniformes y textos de nota `NULL`/vacía frente a nota con contenido.
- TASK-030 no corrige las transiciones temporales: la base actual permite Atendido antes del inicio, Ausente antes del final y Confirmar después del inicio. Se difiere la definición funcional a una tarea posterior; no se crea ni implementa aquí.
- Permanecen aceptadas la posible evasión de descarte de nota por Back/Forward SPA, el regreso al listado sin restaurar filtros y el calendario sin edición manual de fecha. Las pruebas de fixture no demuestran integración con Supabase ni preparación para producción.

### Recomendación de integración

Si el diff staged excluye los archivos locales ajenos, pasa `git diff --cached --check` y la revisión independiente final del conjunto aprueba sin bloqueos, abrir PR a `main` para revisión humana. Detenerse antes de merge, despliegue o archivo.
