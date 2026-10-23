# Plan de TASK-023

1. Auditar la estructura, controles y estados de Crear turno contra Registrar paciente y formularios administrativos; registrar hallazgos y elegir sólo ajustes menores.
2. Eliminar el bloque redundante del Dashboard sin modificar `CenterNavigation`.
3. Agregar botón semántico exclusivamente a los encabezados de fecha semanales. Reutilizar `agendaUrl`, `civilDate` y el estado `filters` para pasar a Día. Quitar el enlace «Lista de turnos» del encabezado.
4. Ajustar estilos focales de Crear turno donde la auditoría encuentre diferencias injustificadas.
5. Añadir pruebas de navegación semanal, cruces de mes/año, filtros, roles y conservación de slots; ejecutar verificaciones técnicas y Chromium local con capturas.
6. Solicitar review independiente, corregir hallazgos bloqueantes y registrar resultados sin publicar cambios.
