# TASK-030 — Refinamiento UX de Turnos

**Estado:** ACTIVE — cuatro iteraciones UX aprobadas visualmente; gate técnico final y PR hacia `main` en curso. Integración y cierre documental pendientes de autorización posterior.
**Base:** `main` en `68326ef8f44d773f9aca75458f4d4ea72bdfc8d6`, rama `codex/task-030-appointments-ux`.

## Objetivo

Mejorar lectura, jerarquía, responsive e interacción del listado y detalle de turnos sin cambiar contratos, permisos, reglas de negocio ni infraestructura. Conservar creación y búsqueda de horarios existentes.

## Criterios de aceptación

- Listado: paciente, fecha civil legible, horario y estado destacados; profesional/especialidad y enlace visibles; filtros y paginación conservados; estados expresados con texto y estilo.
- Detalle: distribución amplia en escritorio y una columna en móvil; fecha legible, zona horaria comprensible derivada de la configuración y offset disponible; proyección Professional sin datos de staff.
- Acciones: prioridad visual y confirmación explícita de acciones terminales; sin alterar matriz, CAS, permisos ni bloqueo tras resultado incierto.
- Nota: lectura por defecto, edición con guardar/cancelar, eliminación visible sin terminología técnica, confirmación de descarte y preservación de `NULL`/vacío/texto.
- Reprogramación: selector y contratos actuales en modal accesible si resulta acotado; confirmación de descarte, errores y estados pendientes conservados.
- Tests focales y controles de calidad; evidencia visual sintética a 1440 y 390 px; revisión independiente. La aprobación visual posterior autorizó commit, publicación de la rama y PR; detener antes de merge o despliegue.

## Riesgos e impacto

- El cambio de rama con Next.js ya en ejecución puede exigir recompilación; no se detiene ni reinicia automáticamente.
- Los horarios civiles se presentan mediante la zona del centro, sin asumir fecha UTC. Los slots conservan el offset suministrado por el selector para horarios DST ambiguos.
- La edición de nota distingue `NULL` de cadena vacía. El estado local y el token CAS deben permanecer coherentes tras mutaciones.
- Las confirmaciones y el modal deben preservar foco, teclado, cancelación y protección contra doble envío.
- `Marcar atendido` puede mostrarse antes del horario; las reglas escritas no definen una restricción de transición por hora. Se documenta sin cambiarlo.
- Quedan fuera migraciones, SQL, RPC, RLS, seguridad de TASK-029, dependencias y cambios remotos.

## Preparación y aislamiento

El commit de TASK-029 `a04f8a749781288ebdea55a2ebb868fd0aa6de1e` se verificó antes de cambiar de rama. Los archivos sin seguimiento no colisionaron con `main`; `next-env.d.ts` quedó modificado y preservado. `pnpm bootstrap` pasó. El servidor respondió en `localhost:3000`; no se detuvo ni reinició.

## Segunda iteración — alcance aprobado

La persona usuaria aprobó la primera iteración como base y pidió cuatro ajustes sin abrir otra tarea: fecha y horario de Crear/Reprogramar, cursors de Turnos, regreso visible al listado y ocultar «Eliminar nota» cuando el valor sea cadena vacía.

### Criterios de aceptación adicionales

- Fecha civil visible como DD/MM/AAAA, calendario accesible con navegación mensual, teclado, foco, estados deshabilitado/error, usable a 390 px. La fecha enviada sigue siendo `YYYY-MM-DD` del centro y las validaciones de servidor no cambian.
- Slots ofrecidos por PostgreSQL como opciones compactas seleccionables. Se preserva el `starts_at` exacto y se muestra offset sólo para horas civiles duplicadas por DST.
- Cursores pointer/not-allowed y hover/focus en controles interactivos del módulo.
- «Volver a turnos» en encabezado del detalle apunta al listado del mismo centro, además del breadcrumb.
- «Eliminar nota» sólo aparece con texto no vacío; `NULL`, cadena vacía y texto conservan su semántica.
- Tests focales, evidencia sintética 1440/390, revisión independiente; detener antes de commit/push/PR/merge.

### Riesgos e impacto adicionales

- El calendario personalizado debe operar sobre componentes civiles sin convertir al huso del dispositivo; no cambia contratos ni genera disponibilidad.
- La cuadrícula de horarios debe evitar que una fila de otra fecha sea seleccionable y distinguir instantes con la misma hora local.
- Se conserva el servidor Next.js existente y los archivos locales. `pnpm bootstrap` como wrapper abortó al intentar reconciliar `node_modules` tras el cambio de rama anterior; `node scripts/bootstrap.mjs` pasó sin mutación.

## Tercera iteración — alcance aprobado

La persona usuaria pidió pulir el flujo, sin nueva tarea ni cambio de rama:

- Crear turno exige seleccionar paciente antes de habilitar especialidad, profesional, fecha, horarios y resumen. Cambiar paciente resetea dependencias para evitar una elección ambigua.
- Búsqueda de pacientes: resultados y selección más claros, conservando la Action de búsqueda.
- Jornada: mostrar huecos no disponibles como referencias visuales deshabilitadas. Sólo los slots de PostgreSQL se pueden seleccionar; la disponibilidad semanal y la duración habitual ya presentes sirven para construir la continuidad visual, con límite de filas.
- Texto del detalle y reprogramación más natural; offset del detalle sólo cuando evita una ambigüedad DST real.
- Reprogramar abre con una carga deliberada hasta resolver catálogos/horarios iniciales, sin flash de campos vacíos.
- Tests focales, evidencias 1440/390 y review independiente. Sin commit, push, PR, merge o cambios remotos.

### Riesgos e impacto

La disponibilidad semanal puede cambiar entre lectura y mutación. Las referencias visuales nunca son seleccionables; la RPC de slots y la validación del servidor siguen siendo autoridad. Si la lectura de disponibilidad falla pero existen slots ofrecidos, se muestran sólo esos slots sin completar huecos. Los cambios son de componentes/tests/documentación de TASK-030; no modifican SQL, permisos, contratos ni seguridad.

## Pulido visual final — alcance aprobado

La persona usuaria validó favorablemente las tres iteraciones y pidió tres ajustes visuales antes de aprobar UX: distribuir las acciones del detalle de forma intencional a 390 px según la cantidad realmente visible; igualar ancho y alto de los dos accesos rápidos móviles, identificando el período activo sólo a partir de filtros existentes; y mostrar «Sin nota administrativa.»/«Agregar nota» tanto para `NULL` como para cadena vacía sin alterar su valor persistido. Se mantienen acciones, confirmaciones, rutas, filtros, contratos y reglas actuales.

### Criterios, riesgos e impacto

- Cuatro acciones: cuadrícula móvil de dos columnas; tres: principal de ancho completo y dos secundarias debajo; una o dos: distribución proporcionada. Escritorio conserva flex y prioridades existentes. Sin overflow, truncamiento ni controles inventados.
- Accesos rápidos de ancho completo en móvil y horizontales en escritorio; resaltar la vista sólo cuando fechas y filtros existentes coincidan con el acceso. No se introduce estado local ni navegación nueva.
- `NULL` y `""` comparten texto vacío y CTA «Agregar nota»; el valor del estado y el payload de Guardar/Eliminar permanecen intactos. Texto real conserva Editar y Eliminar.
- Tests focales, capturas 1440/390 y review independiente. El trabajo sobre límites temporales de estados queda expresamente fuera; no se tocan SQL, RPC, RLS, servidor Next.js, DEV/PROD ni TASK-029. Detener antes de commit/push/PR/merge para revisión visual final.
