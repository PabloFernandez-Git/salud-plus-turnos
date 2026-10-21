# Implementación — TASK-010 modal final

## Cambio

- `Administrar acceso` conserva el modal centrado y utiliza `<dialog>` nativo, siguiendo el patrón de `PatientDialog` para `showModal`, Escape y clic en el fondo. No se modificó Registrar paciente.
- La X del encabezado mide 40 × 40 px, tiene nombre accesible, hover y foco visibles. Los cuatro cierres —X, fondo, Escape y Cancelar— pasan por `requestClose`; si hay cambios muestran la confirmación existente y si hay una operación pendiente no cierran.
- Cancelar y Revisar cambios comparten footer con divisor, orden secundario/principal y altura de 44 px. Revisar cambios sigue enviando el mismo formulario mediante `form={formId}`.
- Chromium reveló que Shift+Tab desde el primer botón llevaba el foco a `body`; se conservó un ajuste acotado de Tab en los límites del diálogo. El resto de la semántica y el cierre usan la primitiva nativa.
- No se tocaron Server Actions, reglas, permisos, Auth, RLS, RPC, PostgreSQL ni otras pantallas.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest focal del componente: 21/21 PASS, incluidas X/fondo/Escape/Cancelar con y sin cambios, descarte, foco y submit.
- `pnpm typecheck`, ESLint focal, Prettier focal y `git diff --check`: PASS.
- Chromium local con datos y acción sintéticos a 1440 y 390 px: modal centrado, X visible, footer alineado, cuatro cierres, descarte/seguir editando, Tab/Shift+Tab, revisión/confirmación, una actualización/refresco y cero desbordamiento. Altura de fila estable: 72.5 px.
- Capturas y resultados: `artifacts/task010-modal-final/`.

No hubo acceso a Supabase DEV/PROD, commit ni push.
