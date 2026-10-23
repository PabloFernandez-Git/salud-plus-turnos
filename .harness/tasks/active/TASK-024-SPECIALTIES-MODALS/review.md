# Review focal

Diff revisado contra el alcance: sólo UI de Especialidades, tests, script local y documentación del módulo. Sin cambios en actions, servidor, permisos, Supabase ni base de datos. El bloqueo de envíos usa una referencia sincrónica además del estado de transición. La restauración del foco se dispara al cerrar, incluso con Strict Mode.

Verificación local: PASS. Revisión visual y aceptación de la persona usuaria en `localhost:3000`: aprobada para publicar un PR. La tarea permanece activa hasta la revisión y el merge autorizados por separado.

El ajuste final limita la supresión del globo nativo al input Nombre y mantiene las restricciones HTML. El patrón compartido sólo presenta el mensaje y los atributos ARIA; no modifica otros formularios. Nombre y Descripción comparten un borde de ancho fijo: gris en reposo, azul con foco y rojo si hay error. La persona usuaria aprobó visualmente el resultado final.
