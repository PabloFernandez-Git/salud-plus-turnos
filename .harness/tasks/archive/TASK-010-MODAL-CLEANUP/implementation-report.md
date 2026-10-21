# Implementación — limpieza visual del modal

- Se quitaron `border-b border-slate-200` del encabezado y `border-t border-slate-200` del footer de Administrar acceso.
- El padding vertical asociado pasó de 16 a 8 px. El espacio de 16 px del contenedor conserva 24 px de separación en ambas zonas.
- No cambiaron contenido, controles, semántica ni handlers.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal de `manage-center-membership-panel.test.tsx`: 21/21 PASS.
- ESLint focal: PASS.
- Chromium local sintético a 1440/390 px: líneas ausentes por estilo computado, modal centrado, cero desbordamiento, fila estable de 72.5 px, controles y cierres/revisión/confirmación PASS.
- Capturas inspeccionadas visualmente: `artifacts/task010-modal-cleanup/desktop-1440-modal.png` y `mobile-390-modal.png`.

No se accedió a Supabase ni se hizo commit o push.
