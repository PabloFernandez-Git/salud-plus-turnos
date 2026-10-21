# TASK-018 — Textos del modal Cerrar sesión

## Objetivo

Cambiar únicamente el título y la descripción del diálogo de confirmación de cierre de sesión del Dashboard por los textos aprobados.

## Criterios de aceptación

- Título: «¿Querés cerrar sesión?».
- Descripción: «Podés volver a ingresar a Salud Plus cuando quieras.».
- Botones, estilos, dimensiones, foco, cierre, errores y mecanismo de logout permanecen iguales.
- Selectores y aserciones locales que dependen de estos textos se actualizan; las pruebas focales pasan.

## Riesgos e impacto

- Los tests de componente, E2E y verificación visual usan el título como nombre accesible del diálogo; deben coincidir con el texto nuevo.
- No hay cambios de Auth ni acceso a Supabase DEV/PROD; no se hacen commit ni push.
