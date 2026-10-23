# Retrospectiva — TASK-024

## Qué funcionó

- El alcance focal mantuvo intactas las operaciones, el token CAS, los permisos y los contratos de servidor.
- La verificación con Vitest y Chromium sintético en escritorio y móvil permitió revisar modales, descarte, foco y validación antes de la aceptación visual final.
- La integración del PR #26 separó la implementación de este cierre documental.

## Qué generó fricción y causa

El primer tratamiento visual de Nombre dejaba visible el globo nativo del navegador y un foco de borde inconsistente. El ajuste final conservó `required` y `maxLength`, mostró un error propio accesible y unificó el borde de Nombre y Descripción; la persona usuaria aprobó el resultado.

## Mejora propuesta y clasificación

Reutilizar el patrón visual y accesible de error de campo cuando otro formulario lo requiera, con revisión focal de su comportamiento nativo. Mejora de bajo riesgo; no se propone cambiar el harness ni ampliar el alcance ahora.
