# Implementación TASK-027

## Rama y alcance

`codex/task-027-availability-ux`, desde `origin/main` `5230be9` (PR #31). Sin commits, push, PR, merge ni despliegue.

Cambios de producto: `src/modules/availability/components/availability-screen.tsx` y su test. Documentación: `docs/modules/availability.md` y este expediente. Capturas sintéticas: `artifacts/task027-visual/{390,556,1440}.png`.

## Cambios

- Encabezado reducido al nombre dinámico. Se mantiene `timezone` en el contrato de la ruta, sin alterar la zona operativa.
- Duración controlada contra el último valor confirmado y el esquema de duración existente; botón deshabilitado si es igual o inválida; borrador conservado ante error.
- Aviso general de semana vacía retirado; siete tarjetas y sus vacíos por día preservados.
- Agregar/editar con modal nativo, foco, teclado, cierre por Cancelar/X/Escape/fondo y confirmación de descarte. Errores de campos con `FormFieldError` y ARIA. Mensajes de éxito específicos.
- Retiro con modal que identifica día y horas; la Action se llama sólo tras confirmación.
- Operaciones pendientes bloquean cierre y envío duplicado. Se conservan payload, autorización, CAS, validación del servidor y refresco.

## Verificación

- `pnpm bootstrap`: PASS.
- Vitest `src/modules/availability`: 47/47 PASS en 4 archivos, con mocks y sin acceso remoto.
- `pnpm typecheck`: PASS.
- `pnpm lint`: PASS con una advertencia preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs`.
- Prettier focal de ambos archivos TSX: PASS. `pnpm format:check` global falla por 273 archivos preexistentes fuera de formato, ajenos a TASK-027; no se reformatearon.
- `git diff --check`: PASS (sólo avisos de conversión LF/CRLF de Git).
- Chromium con una ruta de prueba temporal aislada y datos sintéticos, retirada después: 390/556/1440 px, zoom 100 %, modales visibles y ancho de documento igual al viewport. Ninguna mutación ejecutada. Capturas conservadas en `artifacts/task027-visual/`.

## Límites

No se accedió a Supabase DEV ni PROD. La prueba visual usó el componente real con datos sintéticos, no una sesión autenticada del profesional real. El servidor de desarrollo permaneció activo; la revisión visual y funcional de la ruta real queda para la persona usuaria.

## Ajustes finales solicitados tras la primera revisión

- El enlace del detalle dice «Volver a disponibilidad» y apunta a `/centers/{centerId}/availability` para ADMIN/RECEPTION. PROFESSIONAL conserva su detalle de sólo lectura sin un enlace que lo redirigiría a la misma página.
- Agregar y Editar usan campos de texto `HH:mm`, pista de formato y teclado numérico móvil. No hay máscara rígida, selector nativo ni transformación de zona horaria. La validación local reutiliza los esquemas de creación/edición; las Actions siguen recibiendo `HH:mm` y validan de nuevo en servidor.
- Los controles habilitados muestran cursor `pointer`; los botones deshabilitados, `not-allowed`. Se preservaron foco, hover y ARIA.
- Vitest focal de Disponibilidad: 58/58 PASS (4 archivos); tras formatear el último test, el componente volvió a pasar 29/29. TypeScript: PASS. ESLint global: PASS, con la misma advertencia preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs`. Prettier focal: PASS. `git diff --check`: PASS.
- Chromium aislado con datos sintéticos y sin ejecutar Actions: 390/556/1440 px PASS. Se verificó destino del enlace, entradas de texto editables, cursores computados, modal dentro del viewport y ausencia de desplazamiento horizontal. Evidencia: `artifacts/task027-visual/final-{390,556,1440}.png` y `final-results.json`.
- La ruta temporal y la excepción del proxy usadas para la prueba sintética se retiraron; `src/proxy.ts` queda sin diff.

En este punto del trabajo, la nueva revisión visual y funcional de la ruta autenticada aún estaba pendiente; la aprobación posterior consta en «Preparación del PR».

## Ajuste final: separador automático

- En ambos modales y campos, dos dígitos completan `:` y cuatro dígitos escritos o pegados quedan como `HH:mm`. Las entradas con `:` siguen admitidas. Borrado, selección, reemplazo y escritura del separador se comprobaron con teclado real en Chromium.
- Los errores aparecen al perder el foco o guardar, y se retiran al corregir. El teclado móvil solicita modo numérico. Se conserva `FormFieldError`, la precisión de minutos, el payload `HH:mm` y la detección de cambios pendientes.
- Vitest del componente: 32/32 PASS. Chromium aislado con datos sintéticos: 390/556/1440 px PASS para escritura, pegado, Backspace, Delete, reemplazo, validación por blur, descarte y ambos modales. Evidencia: `artifacts/task027-visual/auto-colon-{390,556,1440}.png` y `auto-colon-results.json`. No se ejecutaron Actions ni se accedió a Supabase.

## Refinamiento visual de las franjas semanales

- Se conservaron las siete tarjetas y el orden de las franjas. Cada horario se muestra como fila sin tarjeta interior, con separador sutil, reloj SVG del patrón de íconos existente, rango destacado y duración calculada desde `HH:mm` local.
- Las acciones de cada fila dicen «Editar» y «Quitar», conservan sus modales, miden 44 px y permanecen juntas al bajar de línea en móvil. «Agregar horario» y «Sin disponibilidad» se mantienen.
- Chromium con datos sintéticos, sin ejecutar Actions: 390/556/1440 px PASS; a 390 px las acciones bajan juntas, a 556/1440 px quedan a la derecha. Sin desplazamiento horizontal. Se verificó foco por Tab, cursores y apertura/cierre de ambos modales. Capturas y medidas: `artifacts/task027-visual/weekly-rows-{390,556,1440}.png` y `weekly-rows-results.json`. La ruta temporal y la excepción del proxy se retiraron.
- Verificación final focal: Vitest Disponibilidad 62/62 PASS, `pnpm typecheck` PASS, `pnpm lint` PASS con la advertencia preexistente de `oid` en `scripts/task009-gate-d/preflight-dev-readonly.mjs`, Prettier de los dos TSX PASS y `git diff --check` PASS. `src/proxy.ts` sin diff.

## Preparación del PR

- Aprobación visual explícita recibida el 2026-10-26. El cierre «X» del modal se ajustó de 40 a 44 px tras una medición de estilos calculados; el resto de acciones ya medía 44 px. Nueva medición PASS a 390/556/1440 px. Evidencia local en `artifacts/task027-visual/final-control-audit.json`, excluida del commit.
- La rama parte de `origin/main` `5230be9` sin divergencia previa. El alcance sigue siendo exclusivamente UX. TASK-027 permanece activa hasta aprobación y merge del PR.
- `pnpm check`: PASS — 791/791 Vitest en 93 archivos, 11/11 tooling TASK-007 y 20/20 tooling TASK-021; TypeScript PASS y ESLint 0 errores, 1 advertencia preexistente. Prettier focal de los dos TSX modificados: PASS. `pnpm format:check` global local informa 273 archivos preexistentes ajenos al cambio; `core.autocrlf=true` en este checkout. No se reformatearon. El CI comprobará el formato y build en checkout limpio de Linux.
