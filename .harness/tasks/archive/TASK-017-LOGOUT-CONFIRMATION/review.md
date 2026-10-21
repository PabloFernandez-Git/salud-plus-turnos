# Review focal — PASS

- `logoutAction`, `signOutLocally` y la redirección de servidor no cambiaron.
- La variante de confirmación sólo se activa desde el encabezado del Dashboard. Selección de centro, plataforma y no-access mantienen el comportamiento anterior.
- El diálogo nativo expone título y descripción accesibles, muestra errores sin cerrar, restaura foco al cancelar y contiene Tab/Shift+Tab. La guarda de pending cubre Cancelar, Escape, fondo y repetición de submit.
- Capturas desktop/mobile inspeccionadas: modal compacto, acciones centradas, sin separadores ni desbordamiento. Ningún hallazgo bloqueante local.
- El flujo autenticado real de DEV no se ejecutó por restricción explícita; el E2E existente quedó actualizado para una futura corrida autorizada.
