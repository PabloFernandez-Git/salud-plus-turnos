# TASK-015 — Favicon, encabezado de Pacientes y confirmación de descarte

## Objetivo

Incorporar un favicon propio, aprovechar el ancho del encabezado de Pacientes y ordenar visualmente la confirmación de descarte de Registrar paciente, conservando todos los comportamientos actuales.

## Criterios de aceptación

- Icono azul sin texto de calendario y salud integrado con la convención de iconos de Next.js; título y otros metadatos intactos; sin favicon genérico.
- Descripción de Pacientes idéntica, en una línea a 1440 px si cabe; botón alineado y ajuste natural sin overflow a 390 px. Los demás encabezados no cambian.
- Confirmación centrada de 420–480 px en desktop y adaptable en mobile, con el título y descripción solicitados; acciones de igual altura en una fila a la derecha cuando caben.
- Seguir editando conserva datos; descartar cierra sin guardar; Escape, fondo, foco y operaciones pendientes mantienen la protección actual.
- Chromium 1440/390 px, capturas y pruebas locales focales PASS.

## Riesgos e impacto

- `ModuleHeader` y `PatientDialog` son compartidos. El ancho nuevo debe aplicarse sólo a Pacientes y el estilo compacto sólo al estado de descarte del registro.
- El favicon debe resolverse mediante la ruta de iconos de Next.js sin alterar `metadata.title`.
- No se modifican reglas, contratos, Auth, RLS, RPC, PostgreSQL, otras pantallas ni Harness; sin Supabase DEV/PROD, commit, push o merge.
