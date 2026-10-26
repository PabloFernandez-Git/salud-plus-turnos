# Retrospectiva — TASK-025

## Qué funcionó

- El alcance focal conservó permisos, contratos de servidor, RPC y RLS mientras mejoró los formularios y la tabla de Profesionales.
- Las pruebas de ambos órdenes de guardado verificaron que Configuración y Especialidades mantuvieran sus borradores y el token CAS vigente.
- Las comprobaciones focales, Chromium responsive y la revisión autenticada permitieron cerrar los ajustes antes de integrar PR #28.

## Qué generó fricción

- La primera confirmación de descarte desmontaba el editor de Especialidades y perdía una selección pendiente.
- El servidor Next.js local conservaba un registro de rutas obsoleto que producía un 404 en el detalle de Disponibilidad pese a existir la ruta.
- Los mensajes genéricos de éxito y los últimos detalles de la tabla requirieron validación visual y ajustes focales.

## Causa

El estado del editor dependía de que el formulario siguiera montado. El 404 provenía del registro de desarrollo y se corrigió mediante Fast Refresh, sin cambiar rutas ni permisos. Los mensajes y detalles visuales necesitaban reflejar cada operación y el ancho real de la tabla.

## Mejora propuesta

Reutilizar en futuros formularios el patrón probado de borradores por sección, descarte protegido, errores por campo y confirmaciones específicas. Mantener la prueba focal de registro de ruta para detectar un 404 local similar. Evaluar estos patrones sólo cuando una tarea nueva los requiera.

## Clasificación

Bajo riesgo: aprendizaje documental y cobertura focal existente. No se proponen cambios nuevos de harness, arquitectura ni producto en este cierre.
