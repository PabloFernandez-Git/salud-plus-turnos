# TASK-010 — Usabilidad de Gestión de usuarios

## Objetivo

Mejorar únicamente la disposición del primer paso de Agregar usuario y presentar Administrar acceso en un modal accesible sin alterar la lógica de usuarios ni contratos de seguridad.

## Criterios de aceptación

- En desktop Email conserva su ancho máximo y comparte fila con Continuar a su derecha; ambos controles tienen la misma altura. En mobile se apilan sin desbordamiento.
- Administrar abre un modal centrado, adaptable a 390 px, con identidad, rol, estado, vínculo profesional cuando corresponde, validaciones, Revisar cambios y confirmación existentes.
- La tabla no aumenta la altura de la fila al abrir Administrar.
- Cancelar y Escape cierran sin guardar; los cambios sin guardar requieren descarte explícito. El foco entra al modal, queda dentro con Tab y vuelve al botón al cerrar.
- Un éxito refresca el listado y cierra el modal; errores conservan los datos editados para corregirlos. Una navegación por pérdida de permiso mantiene el destino seguro existente.
- Pruebas locales afectadas y Chromium a 1440/390 px, con capturas de listado y modal. Sin DEV/PROD, Auth/RLS/RPC, migraciones, commit ni push.

## Riesgos e impacto

- El modal cambia estructura DOM y foco; el contenido debe salir del contenedor scroll de la tabla mediante portal y no interferir con el flujo de confirmación.
- Cerrar con cambios sin guardar o durante una mutación podría perder contexto; se bloqueará el cierre durante pending y se pedirá descarte cuando haya cambios locales.
- El alcance se restringe a `AddCenterUserPanel`, `ManageCenterMembershipPanel`, sus pruebas y evidencia visual; no se modifican otras pantallas ni el Harness.
