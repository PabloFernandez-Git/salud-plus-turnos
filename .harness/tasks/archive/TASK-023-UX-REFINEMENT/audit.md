# Auditoría visual de Crear turno — TASK-023

Comparación de `NewAppointmentScreen` y `BookingSelector` con `PatientsScreen`, el formulario de Registrar paciente y los formularios administrativos.

| Aspecto | Hallazgo | Decisión |
| --- | --- | --- |
| Encabezado y tipografía | Usa `ModuleHeader` y encabezados de sección con jerarquía semejante a la aplicación. | Conservar. |
| Espaciado y ancho | Contenedor de 1400 px, tarjetas con `p-5 sm:p-6` y contenido de formulario de 800 px. Mobile apila los controles. | Conservar. |
| Campos | Búsqueda y nota usan `rounded`; Pacientes y selectores de reserva usan `rounded-md`. Falta foco visible explícito en búsqueda, nota y selectores. | Alinear radio y foco visible; no cambiar tamaños ni valores. |
| Etiquetas y ayudas | Etiquetas explícitas, nota con contador, mensajes de disponibilidad y error junto al campo. | Conservar textos y ubicación. |
| Selectores | Cuatro controles siguen Especialidad → Profesional → Fecha → Horario y estados dependientes. | Conservar lógica; sólo foco visual. |
| Acciones | Botones de Buscar, Verificar y Confirmar duplican el estilo del botón primario de `ModuleHeader`; enlaces secundarios son textuales como en los otros formularios. | Usar la clase primaria compartida, conservar enlaces y disposición. |
| Disabled, loading y error | Los bloqueos, mensajes y roles ARIA están presentes; la clase compartida ya incluye opacidad disabled. | Conservar lógica y mensajes. |
| Indicadores de pasos | Cuatro tarjetas numeradas presentan búsqueda, selección, nota opcional y resumen, sin navegación forzada. | Conservar cantidad y orden. |
| Confirmaciones | Resumen, confirmación, resultado incierto y reconciliación tienen áreas visibles. | Conservar íntegramente. |
| Móvil | Tarjetas fluidas, búsqueda apilada y botón de confirmación de ancho completo. | Verificar a 390 px; no rediseñar. |

Un asistente paso a paso o una barra de progreso alteraría la composición y necesitaría otra tarea. No se implementa.
