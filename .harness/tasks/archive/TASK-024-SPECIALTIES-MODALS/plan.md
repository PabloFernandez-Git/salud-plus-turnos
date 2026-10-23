# Plan

1. Conservar las Server Actions, el token CAS, la tabla y las validaciones.
2. Sustituir el panel integrado por un `dialog` nativo para crear, editar y confirmar el estado.
3. Proteger los cierres con cambios, contener y restaurar el foco, y bloquear acciones pendientes.
4. Verificar con tests del componente y Chromium local sintético a 1440/390 px; revisar el diff.
5. Conservar `required`/`maxLength`, cancelar el globo nativo y mostrar un error de campo accesible mediante un componente visual reutilizable sólo en Especialidades.
