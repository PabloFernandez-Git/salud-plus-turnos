# TASK-028 — Informe de implementación

## Cambios

- `patient-workspace.tsx`: create y link cierran Registro, mantienen los filtros y refrescan el listado sin añadir `patient=<id>`; outcome CREATED/LINKED tienen avisos propios y ALREADY_ACTIVE es informativo. La ruta `from=appointment` y la reactivación mantienen sus destinos existentes.
- El selector de nacionalidad reutiliza los 249 nombres/códigos del catálogo de Profesionales. Se confirmó paridad exacta con los 249 códigos del schema de Pacientes. Se organizaron identidad y datos en rejillas adaptables y se añadió una etapa visible de revisión; el encabezado del modal permanece visible al desplazar el contenido.
- Guardar cambios compara los datos normalizados con el último formulario confirmado, requiere validación exitosa y se bloquea durante envío, stale e inactividad. Los campos administrativos se bloquean durante la operación para evitar perder ediciones simultáneas. Error conserva el borrador. `UNCHANGED` ya no se anuncia como guardado; los avisos administrativos se muestran dentro del modal y los no-op de vínculo/desactivación usan tono informativo.
- No se modificaron Actions, servicios, SQL, RPC, RLS, permisos, migraciones ni almacenamiento.

## Verificación automatizada

- `pnpm bootstrap`: PASS.
- `pnpm exec vitest run src/modules/patients --reporter=dot`: 12 archivos, 139 tests PASS, con mocks.
- `pnpm typecheck`: PASS.
- ESLint focal del componente, tests y script visual: PASS.
- Prettier focal: PASS.
- `git diff --check`: PASS.
- `node scripts/task028-patients-visual.mjs`: Chromium PASS a 390, 556 y 1440 px con acciones sintéticas. Se verificaron apertura, selector, etapas, cierre tras create, ausencia de apertura automática de Administración, botón Guardar y pestaña Turnos; sin desbordamiento horizontal de página ni errores JS. Capturas en `artifacts/task028-patients-visual/`.

## Límites y pendiente

- No se ejecutaron mutaciones ni desactivaciones reales, ni se accedió a Supabase DEV/PROD.
- El servidor local existente en `localhost:3000` permaneció activo y respondió 200; la comprobación visual automatizada usó una fixture aislada para no depender de sesión ni datos remotos.
- En este checkpoint inicial quedaban pendientes la revisión visual y la integración; la aprobación visual posterior se registra al final del informe. TASK-028 permanece activa.

## Ajustes finales del registro

- Registro usa `noValidate` y el patrón compartido `FormFieldError`/`formFieldErrorProps`: valida al perder foco o avanzar, muestra un solo borde rojo y mensaje por campo, enfoca el primer inválido y retira el error al corregir. El servidor conserva su validación autoritativa.
- Nacimiento usa un campo de texto `DD/MM/AAAA` con teclado numérico, separadores automáticos, edición y pegado. El helper comprueba fecha civil, bisiestos y futuro según el día del centro y convierte a ISO justo antes de las Actions, sin `Date.parse` ni desplazamiento horario.
- Create y link muestran identidad y datos administrativos reales en la revisión. El resumen procede de los mismos schemas normalizados que alimentan el payload final; los vacíos opcionales aparecen como `—` o «Sin notas». En link, el nombre proviene de la identidad compartida de sólo lectura. «Corregir datos» conserva el borrador y devuelve el foco al formulario.
- No se cambiaron reglas de negocio, contratos de Actions, módulos ajenos, permisos, SQL, RPC, RLS ni dependencias.

### Verificación de los ajustes finales

- `pnpm exec vitest run src/modules/patients --reporter=dot`: 13 archivos, 164/164 PASS. Subconjunto de componente y helper: 58/58 PASS.
- `pnpm typecheck`, ESLint focal, Prettier focal y `git diff --check`: PASS.
- `node scripts/task028-patients-visual.mjs`: Chromium PASS a 390/556/1440 px con datos sintéticos; validó errores propios y foco, escritura y sustitución parcial de fecha, resumen, cierre tras create, scroll interno y ausencia de overflow horizontal o errores JS. Capturas en `artifacts/task028-patients-visual/`.
- `localhost:3000` respondió HTTP 200; el servidor Next existente no se detuvo ni reinició. No hubo acceso a Supabase DEV/PROD ni mutaciones reales.
- En este checkpoint quedaban pendientes el review independiente y la revisión humana; ambos se completaron después. En ese momento no había commit, push, PR ni despliegue.

## Advertencia de identidad y verificación de vinculación

- La frase anterior «Los datos ingresados no coinciden con la identidad registrada.» estaba en `Registration` de `patient-workspace.tsx`, condicionada a `identity_status === "FOUND" && !birth_date_matches`. Sólo cambió el texto visible por «No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha de nacimiento». Se conservó el bloque ámbar y su condición; errores de Action mantienen sus mensajes independientes.
- Tests con mocks cubren: `NOT_FOUND` avanza a revisión y create; `FOUND/NOT_LINKED` coincidente muestra identidad compartida de sólo lectura, revisa y llama a link sin create; mismatch retiene documento/fecha, no muestra nombre ni datos internos y no permite mutar; `FOUND/ACTIVE` no llama a create/link y `ALREADY_ACTIVE` conserva su aviso informativo. El éxito `LINKED` cierra Registro, refresca sin navegar ni abrir Administración. La estructura SQL local contiene `patient_centers_center_person_key unique (center_id, person_id)` y el RPC de link devuelve `ALREADY_ACTIVE` si encuentra la relación; no se modificaron ni ejecutaron.
- Verificación final: `pnpm exec vitest run src/modules/patients --reporter=dot` 13 archivos y 167/167 PASS; tests focales de componente/Action 46/46 PASS; TypeScript, ESLint focal, Prettier focal y `git diff --check` PASS. Fixture Chromium sintética 390/556/1440 px PASS; a 390 px cubre advertencia neutral y revisión/éxito de link sin overflow horizontal. `localhost:3000` sigue disponible para revisión humana.
- Límite: mocks y lectura de SQL prueban la decisión de la UI y el contrato codificado, no el estado desplegado ni la unicidad efectiva de una base DEV/PROD. El contrato de resolve existente entrega `FOUND` y nombres al cliente autorizado aun cuando `birth_date_matches` es falso; esta ronda sólo neutraliza el texto visible y no modifica ese contrato. El riesgo de inferencia por resolve/create ya consta en la documentación de foundation como PRE-PROD. Sin acceso remoto, mutaciones reales, migraciones, commit, push ni PR.

## Aprobación visual y preparación de publicación

- La persona usuaria aprobó visualmente en `localhost:3000` los ajustes de TASK-028 en escritorio y móvil de 390 px al 100 %, incluida la advertencia de identidad. La fixture sintética pasó a 390, 556 y 1440 px; no sustituye una prueba de datos reales.
- Alcance aprobado para PR: registro sin apertura automática de Administración, avisos create/link, selector de países, formulario responsive, validación accesible, fecha civil, resumen y corrección, dirty state de Administración, descarte y advertencia neutral. Se preservan búsqueda, filtros, pestañas, turnos y las demás reglas del módulo.
- **Riesgo de privacidad preexistente, sin remediar en TASK-028:** el payload de resolve puede entregar `FOUND` y nombres al cliente autorizado incluso con `birth_date_matches: false`. El texto neutral sólo evita mostrar esa información en la interfaz. Debe abrirse una tarea posterior de seguridad antes de utilizar datos personales reales en producción; se mantuvieron intactos Action, contrato, RPC, RLS, permisos, PostgreSQL y migraciones.
- TASK-028 sigue activa hasta su integración. La publicación del PR y el resultado de CI se registrarán por separado; no se hará merge ni despliegue en esta tarea.
