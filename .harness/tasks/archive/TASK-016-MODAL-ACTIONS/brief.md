# TASK-016 — Alineación de acciones en modales

## Objetivo

Centrar los grupos de botones de Administrar acceso, ¿Descartar cambios? de Registrar paciente y todas las etapas de Registrar paciente, sin alterar flujos ni otros componentes.

## Criterios de aceptación

- Cancelar/Revisar cambios y Seguir editando/Descartar cambios centrados como grupos, con orden, tamaño, color y comportamiento conservados.
- Comprobar identidad y la acción variable de la etapa posterior de Registrar paciente centradas; campos y textos siguen a la izquierda.
- Un criterio reutilizable de `flex`, `gap` y centrado se aplica sólo a estos grupos; botones del panel lateral y formularios de página sin cambios.
- Chromium 1440/390 px: alineación, ausencia de overflow, foco visible, teclado y funcionalidad existente. Capturas comparables y pruebas locales focales PASS.

## Riesgos e impacto

- `PatientDialog` se comparte con Administración de pacientes; el cambio debe ocurrir en `Registration` y en su estado de descarte, no en el contenedor compartido.
- Los botones de registro son `submit` de formularios distintos; conservar tipos, deshabilitación, mensajes y acciones.
- No se modifican reglas, validaciones, permisos, contratos, Auth, RLS, RPC, PostgreSQL, Supabase DEV/PROD ni Harness. Sin commit ni push.
