# Plan TASK-038

1. Revisar contratos de disponibilidad, slots, mutaciones, Agenda, RLS y tests afectados.
2. Crear migración con tabla, exclusión de rangos activos, RLS/grants, RPCs de lectura/preview/escritura y locks compatibles con reservas.
3. Agregar esquemas, consultas, Actions y componentes para el detalle de Disponibilidad.
4. Integrar la lectura y representación de bloqueos en Agenda.
5. Probar casos focales y concurrencia; ejecutar gates y revisar diff. Registrar resultados y hallazgos en el harness.

## Remediación de review

1. Confirmar el proceso de `3003`, la ruta de Next y el error de la RPC en DEV sin aplicar migraciones.
2. Completar la migración local: serializar CANCELLED con creación de bloqueos y exigir fechas finitas en tabla y RPC.
3. Agregar pruebas PostgreSQL de ambas carreras, permisos y CAS de cancelación, y rechazo de fechas especiales.
4. Servir componentes reales con datos sintéticos en localhost aislado de Supabase.
5. Repetir pruebas focales, PostgreSQL local, TypeScript, ESLint, Prettier focal, diff check y preparar nueva revisión independiente.

## Refinamiento visual previo a DEV

1. Comparar los cuatro bloques con los modales y cards actuales de Salud Plus V1 y capturas sintéticas.
2. Ajustar solo estructura visual, clases y copy breve de claridad; conservar acciones, estados, validación y acceso.
3. Ampliar la vista sintética para capturar también el retiro y verificar los cuatro bloques en 1440 y 390 px.
4. Ejecutar pruebas focales, TypeScript, ESLint/Prettier focales y `git diff --check`; registrar evidencia y dejar la vista local disponible.

## Ajustes finales de Agenda

1. Comparar el rango civil usado por la consulta real, el título y la vista sintética.
2. Mostrar el intervalo semanal y filtrar en el componente solo los bloqueos que intersectan el rango de `agendaRange`, conservando los filtros existentes.
3. Probar Día/Semana/Mes, bordes de mes/año y filtros; revisar capturas sintéticas a 1440 y 390 px.
4. Ejecutar pruebas focales, TypeScript, ESLint/Prettier focales y `git diff --check`; registrar el resultado sin commit ni despliegue.
