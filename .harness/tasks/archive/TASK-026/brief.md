# TASK-026 — Consistencia responsive de Especialidades

## Objetivo

Alinear únicamente la tabla de Especialidades con el patrón responsive aprobado en TASK-025 para Profesionales.

## Criterios de aceptación

- Editar y Desactivar o Activar conservan ancho natural y permanecen en una fila a 390, 556 y 1440 px.
- Las acciones miden 44 px de alto, centran su texto y conservan padding, tipografía, cursor, foco, hover y disabled accesibles.
- La tabla desplaza horizontalmente dentro de su contenedor cuando es necesario, sin desbordar la página.
- La indicación «Deslizá horizontalmente para ver todas las columnas» aparece sólo ante desbordamiento horizontal real y desaparece al recuperar espacio.
- Nombre, Descripción y Estado conservan su contenido; permisos, operaciones, modales, confirmaciones, validaciones y reglas de negocio no cambian.
- Pasan pruebas focales, TypeScript, ESLint, formato y comprobación Chromium a 390, 556 y 1440 px con zoom 100 %.

## Riesgos e impacto

Impacto limitado a la pantalla y pruebas de `src/modules/specialties/`, documentación del módulo y expediente TASK-026. El ancho intrínseco de Acciones puede ampliar la tabla: se comprobará que el scroll quede contenido y que el indicador responda a cambios de tamaño. No se accede a Supabase DEV o PROD ni se modifican otros módulos, SQL, RPC, RLS o migrations.
