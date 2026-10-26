# Retrospectiva — TASK-028

## Qué funcionó

- La revisión visual en `localhost:3000`, junto con pruebas focales y Chromium con datos sintéticos a 390, 556 y 1440 px, permitió ajustar Registro y Administración antes del merge del PR #34.
- Reutilizar el catálogo de países, los schemas y el patrón compartido de errores mantuvo los códigos ISO alpha-2 y las validaciones existentes.
- La revisión independiente encontró un problema al editar una fecha parcial; se corrigió y se verificó de nuevo antes de la aprobación visual.

## Fricción y límites

El refinamiento necesitó varias rondas para alinear validación, fecha civil, resumen, estados de guardado y navegación. Las pruebas con mocks y la fixture sintética cubrieron decisiones de interfaz, pero no comprobaron una base desplegada ni respuestas de red reales de Supabase.

## Observación y acción pendiente

La advertencia neutral para fecha discordante evita revelar una identidad en pantalla. El contrato preexistente de resolve aún puede enviar `FOUND` y nombres al cliente autorizado con `birth_date_matches: false`. La exposición potencial en la respuesta de red **sigue abierta**; el cambio de texto no es una remediación de seguridad. Corresponde definir y ejecutar una tarea independiente de seguridad antes de utilizar datos personales reales en producción, con revisión específica del contrato y de los controles de inferencia. Este cierre no cambia ese contrato ni autoriza uso en producción. El pendiente permanece en [docs/status.md](../../../../docs/status.md).

Como aprendizaje documental de bajo riesgo, registrar por separado la evidencia de UI sintética, la revisión manual y las verificaciones remotas efectivamente ejecutadas. No se modifica el harness en este cierre.
