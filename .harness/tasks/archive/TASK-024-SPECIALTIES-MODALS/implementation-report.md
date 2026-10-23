# Implementación y verificación local

- Rama: `codex/especialidades-modales`, creada en el checkout existente sin alterar los cambios previos.
- `SpecialtiesScreen` usa un modal centrado para crear/editar y uno compacto para confirmar estado. El botón de desactivación es rojo. Crear/editar protegen Cancelar, X, Escape y fondo cuando hay cambios.
- Las operaciones, errores, token CAS, tabla y reactivación conservan su comportamiento. Descripción: «Administrá las especialidades del centro».
- Vitest focal: 22/22 PASS. TypeScript, ESLint focal, Prettier y `git diff --check`: PASS.
- Chromium local con datos sintéticos: 1440 y 390 px PASS; apertura y centrado de los tres modales, descarte, Escape, descripción precargada y ausencia de desbordamiento horizontal. Sin llamadas a Supabase ni al servidor Next.js del usuario.

## Ajuste de validación visual

- `FormFieldError` y `formFieldErrorProps` establecen el patrón visual/accesible compartido; sólo Especialidades lo consume por ahora.
- Nombre mantiene `required` y `maxLength`. Su evento `invalid` cancela el globo nativo, muestra el mensaje propio y dirige el foco al input. El submit también rechaza valores compuestos sólo por espacios, en línea con el esquema servidor.
- El error se elimina al corregir el campo; los errores del servidor siguen visibles y asociados al input. Los modales y el descarte permanecen intactos.
- Chromium sintético 1440/390 px: PASS para envío vacío en crear/editar, foco, corrección y cancelación del evento `invalid` que evita el globo nativo. Sin capturas nuevas.
