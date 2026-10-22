# TASK-011 — Descripciones en headers administrativos

## Objetivo

Agregar los textos exactos solicitados a los headers de Pacientes, Especialidades y Profesionales, usando la descripción de Usuarios como referencia visual.

## Criterios de aceptación

- Cada header presenta eyebrow, título, nombre del centro y descripción, en ese orden.
- Las tres descripciones reutilizan tipografía, tamaño, color, line-height, ancho máximo, separación y comportamiento responsive del patrón de Usuarios.
- No cambian el texto de Usuarios ni eyebrow, títulos, nombre del centro, botón, acciones, layout general o lógica funcional.
- Pasan los tests focalizados afectados, lint, typecheck y `git diff --check`.
- `next-env.d.ts` histórico permanece sin modificación ni stage.

## Riesgos e impacto

Impacto limitado al texto y espaciado de tres headers. Especialidades y Profesionales tienen estructura previa distinta de Usuarios; usar `mt-2` sobre la descripción para reproducir la separación de `space-y-2` sin alterar el resto. La comprobación visual del sitio autenticado requiere sesión ADMIN; en ausencia de ella se verifica jerarquía y clases en código y tests de componentes.
