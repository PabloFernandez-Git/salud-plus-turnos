# TASK-012 — Ancho de descripciones de módulos del centro

## Objetivo

Ampliar sólo el ancho máximo de las descripciones de header de Usuarios, Pacientes, Especialidades y Profesionales de `max-w-3xl` a `max-w-5xl`.

## Criterios de aceptación

- Los cuatro textos y todas las demás clases permanecen intactos.
- Desktop aprovecha el ancho libre; tablet y mobile permiten wrap natural, sin `whitespace-nowrap`.
- Pasan tests focalizados afectados, lint, typecheck y `git diff --check`.
- Commit nuevo y push normal en la branch actual, sin PR.
- `next-env.d.ts` histórico permanece sin modificación ni stage.

## Riesgos e impacto

Cambio CSS de bajo riesgo limitado a cuatro párrafos. Las rutas requieren sesión ADMIN para una revisión visual real en navegador; en ausencia de esa sesión, inspeccionar las clases, el layout responsive y los tests sin afirmar una inspección autenticada.
