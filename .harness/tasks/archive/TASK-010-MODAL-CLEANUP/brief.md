# Gestión de usuarios — limpieza visual del modal

## Objetivo

Quitar los dos divisores entre identidad/campos y campos/acciones en Administrar acceso, manteniendo separación vertical por espacio.

## Criterios de aceptación

- Modal sin los dos bordes horizontales solicitados, con espacio equilibrado en desktop y mobile.
- Identidad, X, campos, botones y todos los flujos de cierre, descarte, revisión, confirmación y validación idénticos.
- Verificación visual local a 1440 y 390 px y pruebas focales pertinentes. Sin Supabase, otras pantallas, commit ni push.

## Riesgos e impacto

Sólo cambia clases de estilo del modal. El riesgo relevante es que al retirar padding/divisores se comprima demasiado la separación; se comprueba en capturas.
