# Review focal — PASS

- El cambio de ancho queda limitado por `wideDescription` a Pacientes; el valor por defecto de los demás módulos sigue siendo `max-w-3xl`.
- El ajuste de ancho y contenido del descarte se activa sólo con `centered && discardRequested`; la administración lateral de pacientes permanece igual.
- La confirmación sigue en un único `<dialog>` nativo, con foco contenido y descripción enlazada mediante `aria-describedby`. Escape vuelve a editar; el fondo no descarta; los botones mantienen sus acciones previas; operaciones pendientes bloquean cierre.
- Capturas desktop/mobile inspeccionadas: espaciado, alineación y contraste correctos, sin desbordamiento.
- No se observaron cambios en Server Actions, reglas, permisos, datos ni contratos.

No hay hallazgos bloqueantes dentro del alcance.
