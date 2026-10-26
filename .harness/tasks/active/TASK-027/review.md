# Review TASK-027

## Revisión de código

- Alcance: el diff de producto se limita al componente y tests de Disponibilidad; `src/proxy.ts` quedó sin diferencias después de retirar la ruta visual temporal.
- Contratos: las cuatro Actions, esquemas y capa servidor permanecen iguales. Se preservan IDs, día, horas, `expectedUpdatedAt`, permisos y lectura por zona del centro.
- Seguridad: no se agregaron rutas persistentes, acceso a datos ni exposición de claves. La confirmación de retiro sólo dispara la Action tras el botón explícito.
- Interacción: errores permanecen junto a los campos, valores se conservan tras error, y las operaciones pendientes impiden cierre/doble envío. El modal devuelve foco al disparador al cerrar.
- Visual: capturas revisadas a 390/556/1440 px; no hay desbordamiento horizontal ni controles cortados. Las siete tarjetas mantienen su estructura.

## Estado

Verificación automatizada y revisión del diff: PASS. La persona usuaria aprobó visualmente TASK-027 en `localhost:3000` el 2026-10-26. La tarea continúa activa hasta revisión del PR y autorización de merge; no se archiva.

## Revisión posterior a los ajustes finales

- Destino fijo del enlace: mismo `centerId`, índice de Disponibilidad; sin cambios en rutas ni autorización.
- La validación local usa `createAvailabilitySchema` y `updateAvailabilitySchema`; el servidor y la base conservan sus reglas originales. Los cambios parciales siguen editables y se consideran pendientes al cerrar.
- `FormFieldError`, `aria-invalid` y `aria-describedby` relacionan errores y pista con el campo correspondiente. `inputMode="numeric"` facilita la entrada móvil; el separador se agrega tras dos dígitos y también se admiten valores pegados con o sin `:`.
- El cursor computado se verificó en Chromium para regreso, disparadores, Guardar, Cancelar, X y Confirmar retiro. Guardar duración deshabilitado conserva `not-allowed`.
- No se ejecutaron retiros ni guardados en la prueba visual. Esta verificación precedió a la aprobación visual posterior.

## Revisión del separador automático

- Vitest focal de Disponibilidad: 61/61 PASS, incluidos creación, edición, formato y corrección. TypeScript, ESLint y Prettier focal: PASS.
- Chromium verificó escritura, pegado, Backspace, Delete, selección/reemplazo, blur, descarte y modales de creación/edición en 390/556/1440 px. Sin desbordamiento horizontal.
- La ruta sintética y la excepción temporal del proxy fueron retiradas. No se ejecutaron Actions ni hubo acceso a Supabase. Esta verificación precedió a la aprobación visual posterior.

## Revisión de las filas semanales

- El cambio de producto se limita a la presentación de franjas y al texto «Quitar»; no cambia el orden, las Actions, los formularios ni las reglas de duración. El cálculo de la etiqueta usa directamente las horas locales existentes.
- Pruebas de cero, una y varias franjas, tres formatos de duración, acciones y sólo lectura: 62/62 PASS en el módulo. TypeScript, ESLint (una advertencia preexistente), Prettier focal y diff check: PASS. Chromium a 390/556/1440 px confirmó alineación, botones de 44 px, foco, cursores y ausencia de desbordamiento. Esta verificación precedió a la aprobación visual posterior.

## Aprobación visual y revisión previa al PR

- Aprobación explícita de la persona usuaria el 2026-10-26: encabezado, regreso, duración, modales, horas con separador, validaciones, descarte, retiro, cursores y franjas compactas responsive.
- Diff revisado: sólo `availability-screen.tsx`, su test, documentación del módulo y este expediente. `next-env.d.ts`, `.env.local` y artefactos históricos quedan excluidos del commit. Actions, esquemas, servidor, permisos, RPC, RLS y migrations sin diff.
- Altura calculada en Chromium a 390, 556 y 1440 px: todas las acciones medidas 44 px. El cierre del modal medía 40 px; se corrigió exclusivamente a `h-11 w-11` y se volvió a medir. Cursores habilitados `pointer`, Guardar duración deshabilitado `not-allowed`; sin desbordamiento horizontal.
- La ruta sintética usada para medir se retiró, `src/proxy.ts` quedó sin diff. No se ejecutaron Actions ni se accedió a Supabase durante la medición.
- `pnpm check` final PASS: 791/791 Vitest y 31/31 tooling, TypeScript y ESLint sin errores (una advertencia previa). Prettier focal PASS. Formato global local falla por 273 archivos preexistentes fuera de formato en el checkout Windows (`core.autocrlf=true`); no se alteraron. Queda verificar formato/build en el CI de Linux antes del merge.
