# TASK-010 — Ajustes finales del modal Administrar acceso

## Objetivo

Alinear Cancelar y Revisar cambios en un footer, añadir cierre X y fondo, y unificar todos los cierres con protección de cambios sin guardar. Conservar el modal centrado y la lógica existente.

## Criterios de aceptación

- Footer a la derecha con botón secundario Cancelar y principal Revisar cambios, misma altura, divisor y distribución responsive.
- X de 40 × 40 px con SVG, nombre accesible, hover y foco visibles, sin tapar identidad.
- X, fondo, Escape y Cancelar cierran sin cambios; con cambios muestran confirmación. Seguir editando conserva valores, descartar cierra sin persistir. Pending impide el cierre.
- Diálogo centrado con foco contenido y restaurado, Tab y Shift+Tab, y clic interno inocuo.
- Chromium local a 1440/390 px, pruebas focales y capturas actualizadas.

## Riesgos e impacto

- El cambio de contenedor a `<dialog>` nativo debe conservar la semántica, el foco y el flujo de confirmación. Se adapta el patrón de `PatientDialog` sin modificar Registrar paciente.
- Alcance exclusivo del componente de administración, sus pruebas, script y evidencia visual. Sin cambios de negocio, Auth/RLS/RPC/PostgreSQL, Supabase DEV/PROD, Harness, commit o push.
