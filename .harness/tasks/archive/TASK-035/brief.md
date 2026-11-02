# TASK-035 — Configuración administrativa del centro

**Estado:** ACTIVE — Fase C `PHASE_C_PASSED`; Fase D `APPROVED` tras re-review independiente, con los dos hallazgos MEDIUM originales `RESOLVED`. Pendientes la integración en Git y el cierre documental. **Base:** `main` / `origin/main` `dd3c2c9bcb83c15f7c16ff258415e6488cc91db9`. **Rama:** `codex/task-035-center-settings`.

## Objetivo

Permitir a un ADMIN con membership activa consultar y editar nombre, teléfono, email institucional y dirección de su centro activo en `/centers/[centerId]/settings`.

## Alcance

Incluye formulario responsive, zona horaria de solo lectura, validación compartida con el alta, RPC tenant de escritura acotada con control de concurrencia, autorización en página/acción/PostgreSQL, navegación ADMIN y pruebas focales. Excluye cambio de timezone, logo, estado, memberships, usuarios, roles y datos operativos.

## Criterios de aceptación de Fase B

- ADMIN con membership activa del mismo centro puede abrir la pantalla de configuración y guardar únicamente los cuatro campos permitidos. Otros roles, otros centros y PLATFORM_ADMIN sin membership ADMIN no pueden abrir esa pantalla ni ejecutar la mutación. La lectura directa de columnas institucionales de `centers` por API sigue la policy SELECT preexistente: cualquier miembro activo puede leer la fila de su propio centro activo, sin acceso a filas de otros centros. Esta lectura no autoriza administrar la configuración.
- Inputs inválidos producen errores por campo; opcionales vacíos se guardan como NULL.
- Guardar sólo se habilita para cambios normalizados válidos. Éxito usa datos persistidos; fallos y conflicto conservan el borrador.
- Conflicto por `updated_at` se detecta atómicamente en PostgreSQL y no sobrescribe datos.
- Cancelar con borrador pide confirmación; recarga del navegador se protege. Navegación interna se trata con el mecanismo estable disponible, documentando límites.
- Nombre nuevo aparece en el encabezado del centro; zona horaria, logo y estado no se alteran.
- Pruebas focales disponibles, TypeScript, lint y formato focal pasan; no se presume prueba DEV.

## Riesgos e impacto

La RPC `SECURITY DEFINER` amplía la superficie ejecutable por `authenticated` y debe comprobar identidad, centro activo, rol tenant y CAS. `updated_at` debe conservar microsegundos como texto. Un error de persistencia puede tener resultado incierto: el borrador se conserva y se ofrece recarga antes de reintentar. El layout del centro puede mantener un nombre obsoleto si la revalidación no alcanza su caché.

Archivos previstos: migración y test SQL; schema institucional, servicio, acción, componente y ruta con tests; navegación; tipos Supabase; `docs/modules/centers.md`, `docs/modules/access.md` y `docs/status.md`.

## Fase C — objetivo, criterios, riesgos e impacto

El pedido de Fase C es validar el recorrido de guardado, la migración y la RPC en una base local aislada; comprobar autorización y concurrencia; preparar DEV mediante lecturas autorizadas; y probar persistencia integral sólo cuando exista un entorno preparado. El detalle operativo y el estado de cada criterio se registran en `phase-c-report.md`.

- Criterios: preflight de Git/entorno; ejecución real de migraciones y test SQL locales; carrera concurrente; revisión de contrato formulario → acción → RPC; regresiones y navegador sin escritura; inventario read-only de DEV antes de cualquier aplicación; persistencia real y recarga cuando se autorice y prepare DEV.
- Riesgos: una migración pendiente de otra tarea puede impedir aplicar únicamente TASK-035; una RPC ausente produce error de guardado indistinguible en la interfaz de otros errores inesperados; las pruebas locales de PostgreSQL no prueban PostgREST, la sesión real ni la persistencia en DEV.
- Impacto realizado: migración TASK-035 aplicada exclusivamente en DEV por autorización expresa y verificada por consultas de solo lectura. Una autorización posterior permitió cambios temporales de nombre y teléfono en un único centro DEV; se restauraron exactamente los valores visibles originales por el formulario. Próximo impacto permitido sin autorización adicional: documentación y consultas read-only.

## Límites operativos actuales

Durante la preparación del cierre: sin push, merge, nuevas escrituras DEV ni acceso PROD hasta la autorización correspondiente. Archivar el expediente y marcar CLOSED únicamente después de verificar la integración. No usar `SUPABASE_SECRET_KEY` para inspección remota improvisada. Preservar `next-env.d.ts`, cambios locales preexistentes, TASK-029, expedientes archivados, servidor `localhost:3000` y respaldo `.next`.
