# TASK-038 — Bloqueos excepcionales de disponibilidad

## Objetivo

Permitir a ADMIN y RECEPTION registrar y retirar bloqueos de días civiles completos por ProfessionalCenter, sin cambiar la disponibilidad semanal ni los turnos ya reservados. PROFESSIONAL consulta solo sus propios bloqueos. Los bloqueos deben impedir nuevos slots, altas y reprogramaciones desde PostgreSQL y distinguirse en Agenda.

## Criterios de aceptación

- Fechas inclusivas válidas, motivo limitado a VACATION, ABSENCE, HOLIDAY u OTHER, sin descripción personal; centro y vínculo activos.
- Listado y administración en el detalle de Disponibilidad; aviso y confirmación explícita con cantidad exacta de turnos no cancelados afectados, consulta de estos turnos para staff, retiro lógico confirmado y estados de carga/error/vacío.
- Sin solapamientos de bloqueos activos por profesional-centro, incluso con solicitudes concurrentes.
- Búsqueda de slots, creación y reprogramación rechazan fechas bloqueadas en la base. Al retirar, se restaura la regla semanal y de turnos ocupados. Turnos existentes conservan identidad, estado y datos.
- Agenda Día/Semana/Mes marca las fechas bloqueadas respetando centro, rol y filtros.
- Pruebas de validación, permisos, zona del centro, concurrencia y regresión de turnos. Verificación focal, TypeScript, ESLint, Prettier y diff check.

## Impacto

Migración incremental local de Supabase; contratos tipados y servicios de Disponibilidad; Server Actions; detalle de Disponibilidad; consulta y visualización de Agenda; pruebas y documentación pertinente. No se modifican migraciones anteriores, autenticación, portfolio DEMO ni servicios remotos.

## Riesgos y controles

- Carrera bloqueo/reserva: lock de centro compartido seguido de lock por ProfessionalCenter compartido para reservas y exclusivo para bloqueos; conteo de afectados bajo el lock y comparación con el conteo confirmado.
- Aislamiento: autorización en Action y RPC, RLS SELECT limitado al centro y al vínculo propio para PROFESSIONAL.
- Fechas: almacenar `date`, comparar contra fecha civil en zona del centro, no convertir el rango en JavaScript.
- Resultado incierto: exigir recarga antes de repetir una mutación.

## Límites

No aplicar migraciones en DEV/PROD, no hacer push, deploy ni commit. La prueba real contra DEV requiere aplicar la migración mediante autorización separada.

## Remediación de review (2026-11-16)

Objetivo: diagnosticar el error de Disponibilidad sin modificar DEV y corregir los dos hallazgos de seguridad antes de repetir la revisión independiente.

Criterios: confirmar el proceso de localhost:3003 y el error técnico de la consulta; serializar CANCELLED con el conteo confirmado del bloqueo en orden centro → ProfessionalCenter → fila, conservando las reglas de transición; rechazar `infinity` y `-infinity` en tabla y RPC; probar ambas carreras, fechas especiales, regresión focal y tooling. Ofrecer una vista visual local con datos sintéticos aislados de Supabase DEV.

Impacto: esta misma migración aún no aplicada, pruebas PostgreSQL locales, un guion de vista previa y expediente TASK-038. Riesgos: un lock tomado después de la fila del turno puede causar interbloqueo; el centro se bloquea en exclusivo para CANCELLED antes de resolver el ProfessionalCenter, y luego se toma su lock compartido antes del `FOR UPDATE`. Las consultas reales en DEV siguen pendientes de la migración y de una revisión independiente nueva. Sin commit, push ni deploy.

## Refinamiento visual previo a DEV (2026-11-16)

Objetivo: pulir el modal de alta, la lista de bloqueos, el modal de retiro y el aviso de Agenda para alinearlos con Salud Plus V1. El usuario informó `TASK038_APPROVED_FOR_DEV_VALIDATION`; esta fase es solo de presentación.

Criterios: fechas y motivos legibles, campos alineados, acciones primaria/secundaria/destructiva claras, cierre consistente con los modales existentes y diseño compacto que envuelve varios items en móvil. Revisar Disponibilidad y Agenda sintéticas en escritorio y móvil, incluidos ambos modales. Ejecutar pruebas focales, TypeScript, ESLint/Prettier focales y diff check.

Impacto: únicamente componentes de Disponibilidad y Agenda, pruebas de presentación, guion de vista sintética y documentación del expediente. Riesgos: desbordamiento o foco perdido en móvil; mantener los handlers, estados, validación y accesibilidad del diálogo, y comprobarlos visual y funcionalmente. No cambiar SQL, migración, RPC, RLS, locks ni lógica de negocio; sin migración DEV, commit, push ni deploy.

## Ajustes finales de Agenda (2026-11-16)

Objetivo: mostrar el intervalo lunes-domingo en el título de Semana y limitar el aviso de bloqueos a los que intersecten el período visible. Disponibilidad y sus modales ya tienen aprobación visual; no cambiar sus diseños.

Criterios: Día y Mes conservan sus títulos; Semana muestra fechas civiles correctas incluso al cruzar meses o años. El aviso y las marcas de bloqueos usan solo bloques del período de Día, Semana o Mes, manteniendo los filtros y permisos existentes. Confirmar por qué la vista sintética mostraba bloques externos, probar las tres vistas y revisar escritorio/móvil.

Impacto: componente de Agenda, pruebas focales, guion sintético y documentación TASK-038. Riesgos: divergencia entre el rango de la consulta real y el render, o filtrado accidental de un bloqueo que comienza antes del período y lo intersecta; reutilizar `agendaRange` y probar ambos bordes. Sin cambios a PostgreSQL, migración, diseños aprobados, DEV, commit, push ni deploy.

## Correcciones finales de UX (2026-11-16)

Objetivo: contraer la sidebar al salir con el mouse después de navegar, conservando su expansión por hover y foco de teclado; mostrar el mes de Agenda con mayúscula inicial únicamente en el nombre, por ejemplo «Diciembre de 2026».

Criterios: clic en Agenda o Turnos mantiene la sidebar abierta mientras el cursor está dentro y la salida la contrae, incluso tras varios ciclos y cambios de ruta. Foco y navegación por teclado, menú móvil y táctil permanecen operativos. Los encabezados Día y Semana conservan su comportamiento. Verificación focal, TypeScript, ESLint, Prettier, diff check y navegación interactiva de escritorio y móvil.

Impacto: `CenterSidebar` y encabezado de `AgendaCalendar`, con sus pruebas. Riesgo: confundir foco producido por mouse con foco de teclado; distinguir la modalidad de interacción en la sidebar sin alterar el foco DOM ni agregar listeners globales. Sin cambios de base, turnos, diseño aprobado o servicios remotos.

Verificación: 35 pruebas focales pasaron; TypeScript, ESLint y Prettier focales, y `git diff --check` pasaron. Chromium interactuó con los componentes reales en una vista aislada local: hover y salida, Agenda y Turnos con cuatro ciclos de clic y salida tras cambios de ruta, foco de teclado, menú táctil móvil, y encabezados de diciembre de 2026, enero de 2027, Día y Semana. La aplicación Next permanece en `http://localhost:3004`; la automatización del navegador nativo no estuvo disponible, por lo que la interacción se verificó con Chromium local y datos sintéticos, sin sesión DEV.
