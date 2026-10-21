# Plan — primer corte de Agenda

1. Reutilizar los servicios autorizados de TASK-009 con consulta paginada por
   segmentos de hasta 31 días, sin truncar resultados silenciosamente.
2. Añadir parser de vista/filtros y proyección de hora civil del Center con pruebas
   de zona horaria, DST, rangos y paginación.
3. Montar Día/Semana/Mes productivos en `src/modules/agenda/`, ruta tenant y
   navegación. Mantener el spike de TASK-002 como evidencia separada.
4. Ejecutar tests relevantes, lint, typecheck y diff check. Revisar permisos,
   datos proyectados, fallos de carga y alcance; registrar pendientes reales.
