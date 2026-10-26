# Plan TASK-027

1. Refinar el estado de duración y las confirmaciones sin alterar las Actions.
2. Llevar creación, edición y retiro al patrón de modal nativo de Especialidades/Profesionales.
3. Actualizar las pruebas focales con mocks para éxito, error, stale, validación y descarte.
4. Ejecutar pruebas focales, TypeScript, ESLint, Prettier y revisión de diff.
5. Verificar las tres anchuras en el navegador local si el estado autenticado lo permite; registrar cualquier limitación.

## Ajustes posteriores a la revisión visual

6. Cambiar el enlace de regreso al índice de Disponibilidad del mismo centro.
7. Cambiar ambos campos a texto `HH:mm`, reutilizar esquemas existentes para errores locales y mantener los controles de descarte y Actions.
8. Aplicar cursores a controles habilitados/deshabilitados y repetir tests, chequeos y verificación visual sintética a 390/556/1440 px.
9. Autocompletar `:` en ambos campos sin bloquear borrado/selección, validar formato al perder foco y repetir pruebas de teclado, pegado y responsive antes de la aprobación visual.
10. Sustituir el recuadro por franja por filas de agenda con reloj, rango y duración local; mantener las acciones y los modales existentes.
11. Cubrir franjas únicas/múltiples, duraciones y acciones con pruebas focales; comprobar diseño y teclado a 390/556/1440 px y repetir TypeScript, ESLint, Prettier y diff.
