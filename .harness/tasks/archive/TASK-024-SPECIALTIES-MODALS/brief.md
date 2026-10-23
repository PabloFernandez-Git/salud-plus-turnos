# TASK-024 — Modales de Especialidades

## Objetivo

Presentar creación, edición y confirmación de cambio de estado de Especialidades en modales centrados, con protección de cambios sin guardar en creación y edición.

## Criterios de aceptación

- Nueva especialidad y Editar comparten el modal con nombre y descripción opcional; Editar precarga ambos valores.
- Desactivar usa un modal de confirmación centrado, conserva el aviso sobre asociaciones y confirma con botón rojo. Reactivar mantiene su operación existente.
- Cancelar, X, Escape y fondo cierran directamente los formularios limpios y solicitan descarte si tienen cambios. Seguir editando conserva los datos.
- Mientras una operación está pendiente, se bloquean cierre y envío duplicado. El foco queda dentro del modal y vuelve al disparador al cerrar.
- La descripción del módulo es «Administrá las especialidades del centro».
- Se conservan tabla, validaciones, acciones, permisos, contratos y manejo de errores/concurrencia.
- Pasan tests focales de cierre, descarte, teclado y layout responsive sin pruebas remotas.
- Crear y editar muestran «Ingresá el nombre de la especialidad.» bajo Nombre al intentar guardar vacío, con borde rojo, foco en el campo y asociación accesible; no aparece el globo nativo de Chrome.
- El error se retira al corregir el nombre. Las validaciones `required`/`maxLength` y las reglas del servidor permanecen activas. La solución visual de error queda reutilizable sin extenderse a otros módulos.

## Riesgos e impacto

Impacto restringido al componente de Especialidades, sus tests y un componente visual compartido de error. Riesgos: cierre accidental durante una mutación, foco perdido al desmontar el diálogo, regresión del token CAS, desbordamiento en móvil o supresión accidental de una validación nativa. Verificar cada flujo y revisar el diff. No tocar base de datos ni servidor Next.js.
