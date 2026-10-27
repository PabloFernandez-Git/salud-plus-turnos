# Estado actual

**TASK-032 — ACTIVE; CLOSED / ARCHIVED propuesto en este PR documental.** El refinamiento UX de Gestión de usuarios está integrado en `main` mediante [PR #40](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/40), merge `0fdb6f0068682c54aab89c29953e7c528cc8abd7`. El [CI posterior al merge](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40593197450/job/122502398242) terminó en SUCCESS; la revisión independiente completa fue APPROVED y la persona usuaria aprobó visualmente el listado móvil, el modal de tres etapas, la confirmación de contraseña, el éxito y la administración de accesos. El [expediente y cierre](../.harness/tasks/archive/TASK-032-USERS-UX/closure.md) se archivan íntegramente en este PR. El cierre formal será efectivo sólo tras autorización e integración del PR documental. Esta rama no modifica funcionalidad ni despliega la aplicación; TASK-029 permanece ACTIVE / PRE-PROD BLOCKED y separada.

**TASK-031 — CLOSED / ARCHIVED propuesto en este PR documental; efectivo sólo tras su aprobación y merge.** Las restricciones temporales de Confirmar, Atendido y Ausente y los diálogos accesibles de estado se integraron en `main` mediante [PR #38](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/38), commit `e0f7c6bf54905abcdc2212f52c07b76740f0ba70`. El [CI posterior al merge](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40540164882/job/122316085934) terminó en SUCCESS; la revisión independiente fue APPROVED y la persona usuaria aprobó visualmente el resultado responsive. El [expediente y cierre](../.harness/tasks/archive/TASK-031-APPOINTMENT-TIME-RULES/closure.md) se archivan íntegramente en este PR. La migración está en el repositorio, pero su aplicación y verificación en Supabase DEV/PROD siguen pendientes de autorización separada. Este PR no modifica producto ni despliega la aplicación; TASK-029 conserva su estado.

**TASK-030 — CLOSED / ARCHIVED (propuesto en este PR documental; cierre formal al integrarlo).** El refinamiento UX de Turnos se integró en `main` mediante [PR #36](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/36), commit `d8baf097f4f0114a1eceb9c6dca0e6cddfc49bea`; el job `verify` posterior al merge terminó en [SUCCESS](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40525457158/job/122263689050). Las cuatro iteraciones recibieron aprobación visual en escritorio y móvil, y la revisión independiente final fue APPROVED. El [expediente](../.harness/tasks/archive/TASK-030-APPOINTMENTS-UX/closure.md) y sus evidencias se archivan en este PR. Las restricciones temporales de Confirmar, Atendido y Ausente quedan diferidas a una tarea funcional posterior; se conservan las reglas actuales de Cancelar y Reprogramar. Este PR no modifica funcionalidad ni despliega la aplicación.

**TASK-028 — CLOSED / ARCHIVED (cierre documental propuesto el 2026-10-26; pendiente de integración).** El refinamiento UX de Pacientes quedó integrado en main mediante [PR #34](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/34), squash `971e6553172cb368daef6a92fe049d2a32441927`; su CI terminó en success. Registro cierra tras crear o vincular, conserva filtros y el flujo desde Crear turno; incluye nacionalidad legible con códigos ISO alpha-2, fecha civil DD/MM/AAAA, validaciones accesibles y revisión con corrección de datos. Administración conserva borrador, descarte, pestañas, historial y acciones, y sólo permite guardar cambios válidos. Pruebas focales 167/167, verificación general 824/824 Vitest y 31/31 tooling, TypeScript, ESLint y Prettier focal: PASS; revisión independiente y visual manual aprobadas. Chromium con datos sintéticos a 390/556/1440 px: PASS. Las pruebas con mocks no acreditan Supabase desplegado. **Privacidad PRE-PROD pendiente:** resolve puede devolver `FOUND` y nombres al cliente autorizado aun con fecha discordante; la advertencia neutral sólo evita mostrarlos en pantalla, no elimina la exposición en la respuesta de red. Se requiere una tarea independiente de seguridad antes de usar datos personales reales en producción. El [expediente](../.harness/tasks/archive/TASK-028/closure.md) y su [revisión documental](../.harness/tasks/archive/TASK-028/closure-review.md) se archivan en esta rama; el PR documental requiere aprobación antes del merge.

**TASK-027 — CLOSED / ARCHIVED.** El refinamiento UX de Disponibilidad quedó integrado en `main` mediante [PR #32](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/32), merge commit `07f273fa82a49c69d53cac8d543a02778aa7dd10`. Encabezado y regreso al listado simplificados; duración guardable sólo con cambios válidos; modales de agregar, editar y quitar, descarte confirmado, campos `HH:mm` con separador automático, validaciones MVP y franjas compactas con duraciones. Aprobación visual en `localhost:3000`; Chromium con datos sintéticos a 390/556/1440 px y controles de 44 px. Pruebas focales 62/62, Vitest 791/791, tooling 31/31, TypeScript, ESLint, build y CI: PASS. Sin cambios en SQL, migrations, RPC, RLS ni reglas de negocio. El [expediente](../.harness/tasks/archive/TASK-027/closure.md) y su [revisión documental](../.harness/tasks/archive/TASK-027/closure-review.md) están archivados; el cierre documental se integró mediante [PR #33](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/33).

**TASK-026 — CLOSED / ARCHIVED.** La consistencia responsive de la tabla de Especialidades quedó integrada en `main` mediante [PR #30](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/30), merge commit `c48aada9b4c9d0f05b4d0b1e1b276c683176365d`; su cierre documental se integró mediante [PR #31](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/31) (`5230be98a4ec590b984ccf995c0efd0ed333391f`). Aprobación visual en `localhost:3000` a 390/556 px; Chromium a 390/556/1440 px, 25/25 pruebas focales, Vitest 764/764, tooling 31/31, TypeScript, build y CI: PASS. Sin cambios en base de datos, permisos, modales ni reglas de negocio. El [expediente](../.harness/tasks/archive/TASK-026/closure.md) y su [revisión documental](../.harness/tasks/archive/TASK-026/closure-review.md) están archivados.

**TASK-025 — CLOSED / ARCHIVED.** El refinamiento UX de Profesionales quedó integrado en `main` mediante [PR #28](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/28), merge commit `0e9a3e91a6043e7de9d28e58f605fd74e352cb10`; su cierre documental se integró mediante [PR #29](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/29) (`cf59245350b55a811173b1c858ca12319f0a50ec`). Pruebas focales 134/134, regresión de Disponibilidad 1/1, CI y aprobación visual en escritorio y móvil: PASS. Sin cambios en base de datos, RPC o RLS. Expediente y [revisión del cierre](../.harness/tasks/archive/TASK-025-PROFESSIONALS-UX/closure-review.md) archivados.

**TASK-024 — CLOSED / ARCHIVED.** El refinamiento UX de Especialidades quedó integrado en `main` mediante [PR #26](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/26), merge commit `00ed3ec8b79489affa2661a121846602164e075d`; su cierre documental se integró mediante [PR #27](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/27) (`68326ef8f44d773f9aca75458f4d4ea72bdfc8d6`). CI PASS; Vitest focal 22/22 y validación visual desktop/mobile aprobadas. Expediente completo en [archivo](../.harness/tasks/archive/TASK-024-SPECIALTIES-MODALS/closure.md); no quedan pendientes funcionales dentro de su alcance.

**TASK-023 — CLOSED / ARCHIVED (2026-10-23; cierre documental propuesto en este PR).** El refinamiento UX de Dashboard, Agenda y Crear turno quedó integrado en `main` mediante [PR #24](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/24), squash `07a67b4c884812a6821571c8fc58920f236aa874`. CI, revisión independiente y validación visual/funcional: PASS. El expediente conserva auditoría, decisiones, pruebas y evidencia; ver [cierre](../.harness/tasks/archive/TASK-023-UX-REFINEMENT/closure.md). Este PR sólo archiva y documenta; su merge queda pendiente de autorización.

**TASK-021 — CLOSED / ARCHIVED (2026-10-23; cierre propuesto en PR documental).** El Dashboard operativo quedó integrado en `main` mediante [PR #22](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/22), merge commit `5f0cead268adbc64ccdaf055e64e90ff87f4eb71`. Gate A DEV PASS (25 migrations); Gate B DEV PASS con Chromium autenticado 1/1 y cleanup `residue=0`; Vitest 706/706, `node:test` 21/21, Chromium local 13/13 y revisión técnica independiente PASS. La persona usuaria aprobó la validación visual final en `localhost:3000` en escritorio y móvil de 390 px y confirmó la navegación existente. El criterio 14 del MVP está cumplido para el alcance de TASK-021; las alertas sin regla definida y el onboarding siguen como evoluciones separadas. El expediente completo, incluidas decisiones, gates e intentos históricos, está en [closure.md](../.harness/tasks/archive/TASK-021-DASHBOARD-OPERATIVO/closure.md). No se aplicó la migration en PROD ni se repitieron operaciones DEV para este cierre.

**TASK-022 — CLOSED / ARCHIVED (2026-10-22).** El criterio 13 del MVP (Próximos turnos e Historial en la ficha del paciente) quedó integrado en `main` mediante el PR #20, squash `8ba31f7262a558b2cfc8471965c4453ce85bb816`. El CI posterior al merge figura como SUCCESS según la confirmación de la persona usuaria. Expediente completo en `.harness/tasks/archive/TASK-022-PATIENT-APPOINTMENTS/`.

**Evidencia de cierre TASK-022.** SQL local PASS; migration `20261022120000_add_patient_appointment_history.sql` aplicada y validada estructuralmente sólo en `salud-plus-turnos-dev` (24 migrations); gate funcional DEV PASS por evidencia RPC y Chromium autenticado en runs documentados; revisión independiente APPROVED. El run focal de cierre `9b581bb1-e2be-44e4-b33d-77efbc594982` terminó con `residue=0`, cuatro Auth ausentes e inventarios inicial/final idénticos en 14 recursos. Los checkpoints anteriores, incluidos los runs bloqueados por aserciones de test, se conservan como historial en el expediente archivado; no describen pendientes actuales.

**Límite de despliegue.** La aplicación de la migration en PROD no fue autorizada ni realizada. Cualquier aplicación o despliegue fuera de DEV requiere una decisión separada.

**TASK-020 (2026-10-22): mejoras visuales aprobadas para integración.** Agenda muestra «Consultá la actividad por día, semana o mes.» sin alterar horarios ni DST. La página 404 global usa el diseño final de dos paneles y el botón «Volver al inicio» centrado en el panel derecho, con destino `/`; una ruta inexistente devolvió HTTP 404 en una comprobación Next aislada. Las siete tarjetas del Dashboard conservan su navegación y distribución responsive con descripciones sin punto final. Vitest focal, typecheck, lint/formato y Chromium local a 1440/390 px pasaron; no se accedió a Supabase ni se repitieron pruebas remotas.

**Conciliación TASK-011 / TASK-012 (2026-10-22): REEMPLAZADAS y archivadas localmente.** Las descripciones solicitadas para Pacientes, Especialidades y Profesionales están presentes; el encabezado aprobado por PR #15 usa breadcrumb → título → descripción y muestra el centro en el layout compartido. El criterio antiguo de eyebrow → título → centro → descripción de TASK-011 queda reemplazado, no aprobado como PASS. TASK-012 tampoco cumple literalmente `max-w-5xl`: Usuarios, Especialidades y Profesionales conservan `max-w-3xl`; TASK-015 aprobó `max-w-none` sólo para Pacientes. La inspección de capturas locales anteriores y 33/33 pruebas focales actuales respaldan legibilidad y ajuste responsive; no se hizo una nueva inspección autenticada ni validación remota. Expedientes de cierre en `.harness/tasks/archive/TASK-011/` y `.harness/tasks/archive/TASK-012/`. `main` local avanzó por fast-forward hasta `origin/main` `10f5d36` sin checkout; la rama activa y los archivos locales permanecieron intactos.

**Incidente Dashboard 404 (2026-10-22): corrección de autorización integrada en `main` mediante PR #17 / `10f5d36`.** Los errores de consulta de membresía o centro se propagan como errores internos; sólo la ausencia de una membresía activa o de un centro activo deniega el acceso. El usuario confirmó manualmente el inicio de sesión y el uso del Dashboard con una sesión real. Esta observación no es una prueba automatizada. Las 29 pruebas focales originales y las dos pruebas adicionales de propagación en las rutas se verificaron localmente; no se repitió Gate D ni se ejecutaron validaciones remotas.

**Etapa de interfaz aprobada (2026-10-21), integrada mediante PR #16 / `ed3b9b1`.** Gestión de usuarios, modales de acceso y registro de pacientes, confirmación de descarte, favicon, alineación de acciones y confirmación de cierre de sesión quedaron verificados localmente. El copy final del cierre de sesión es «¿Querés cerrar sesión?» / «Podés volver a ingresar a Salud Plus cuando quieras.». Las evidencias focales de TASK-010 y TASK-014–018 están archivadas; los E2E DEV no se ejecutaron en esa etapa. TASK-011, TASK-012 y `next-env.d.ts` permanecieron fuera de esa integración.

**Estado actual (2026-10-21): TASK-017 confirmación de cierre de sesión en Dashboard — verificación y review focal PASS; sin commit ni push.** El botón del Dashboard abre un diálogo centrado; Cancelar, Escape y fondo no invocan logout, y sólo confirmar llama al `logoutAction` existente. Pending bloquea cierre y duplicados; los errores quedan visibles. Chromium local sintético 1440/390 px, foco/teclado y capturas PASS en `artifacts/task017-logout-confirmation/`; Vitest focal 10/10, TypeScript, ESLint, formato, sintaxis E2E y diff check PASS. El E2E DEV se actualizó pero no se ejecutó por la restricción de no acceder a Supabase. Otros usos de logout y Auth interno siguen iguales. Expediente en `.harness/tasks/archive/TASK-017-LOGOUT-CONFIRMATION/`.

**Estado actual (2026-10-21): TASK-016 alineación de acciones en modales — verificación y review focal PASS; sin commit ni push.** Un grupo visual compartido centra Cancelar/Revisar cambios en Administrar acceso, Seguir editando/Descartar cambios y las acciones de las etapas de Registrar paciente. Chromium local 1440/390 px confirma centros geométricos coincidentes, altura de botones de 44 px, foco visible, teclado, flujos y ausencia de overflow; ocho capturas en `artifacts/task016-modal-actions/`. Vitest focal 43/43, TypeScript, ESLint y formato PASS. Sin acceso Supabase DEV/PROD ni cambios de reglas, contratos, permisos, Auth, RLS, RPC o PostgreSQL. Evidencia en `.harness/tasks/archive/TASK-016-MODAL-ACTIONS/`.

**Estado actual (2026-10-21): TASK-015 ajustes visuales — verificación y review focal PASS; sin commit, push ni merge.** Favicon SVG propio mediante `src/app/icon.svg` (ruta Next `/icon.svg` 200; `/favicon.ico` genérico ausente), descripción de Pacientes en una línea a 1440 px y confirmación de descarte compacta y centrada. Vitest focal 32/32, TypeScript, ESLint focal, formato y Chromium local a 1440/390 px PASS, con capturas en `artifacts/task015-ui-polish/`. Sin acceso Supabase DEV/PROD ni cambios de reglas, contratos, Auth, RLS, RPC o PostgreSQL. Evidencia en `.harness/tasks/archive/TASK-015-UI-POLISH/`.

**Estado actual (2026-10-21): TASK-014 Consistencia de modales — implementación local y review focal PASS; sin commit, push ni merge.** El botón de la tabla dice Administrar acceso. Registrar paciente usa un modal centrado con scroll interno, foco contenido y cierre protegido por X, fondo y Escape; Administración de pacientes conserva su panel lateral. Vitest focal 57/57, TypeScript, ESLint focal y Chromium sintético a 1440/390 px PASS, incluidos alta, vínculo, reactivación, descarte y ausencia de desbordamiento. Sin acceso DEV/PROD ni cambios de contratos, Auth, RLS, RPC, PostgreSQL o permisos. Evidencia en `.harness/tasks/archive/TASK-014-MODAL-CONSISTENCY/` y `artifacts/task014-modal-consistency/`.

**Checkpoint previo (2026-10-21): Gestión de usuarios — limpieza visual del modal Administrar acceso, verificación y review focal PASS; sin commit ni push.** Se retiraron únicamente los divisores entre identidad/campos y campos/acciones, con espacio vertical equilibrado. Vitest focal 21/21, ESLint focal y Chromium sintético a 1440/390 px PASS; capturas inspeccionadas y sin desbordamiento. Sin cambio funcional ni acceso a Supabase. Evidencia en `.harness/tasks/archive/TASK-010-MODAL-CLEANUP/` y `artifacts/task010-modal-cleanup/`.

**Checkpoint previo (2026-10-21): TASK-010 ajustes finales del modal Administrar acceso — implementación local y review independiente PASS; sin commit ni push.** El modal centrado usa `dialog` nativo, X de 40 px y footer con Cancelar/Revisar cambios alineados. X, fondo, Escape y Cancelar comparten protección de cambios sin guardar; el flujo de revisión y confirmación conserva sus operaciones. Vitest focal 21/21, TypeScript, ESLint focal, formato y Chromium sintético a 1440/390 px PASS, con capturas nuevas y sin desbordamientos ni expansión de filas. Sin acceso DEV/PROD ni cambios en Auth, RLS, RPC, PostgreSQL, permisos o Registrar paciente. Evidencia en `.harness/tasks/archive/TASK-010-MODAL-FINAL/` y `artifacts/task010-modal-final/`.

**Checkpoint previo (2026-10-21): TASK-010 Usabilidad de Gestión de usuarios — implementación local y review PASS; sin commit ni push.** Email y Continuar comparten fila y altura en desktop y se apilan en mobile. Administrar abre un modal accesible sin expandir la tabla, preserva rol, estado, vínculo profesional, revisión/confirmación, errores y actualización del listado; cancelar con cambios exige descarte explícito. Vitest focal 29/29, TypeScript, ESLint focal y Chromium sintético a 1440/390 px PASS, con capturas de listado y modal. Sin acceso a DEV/PROD ni cambios en Auth, RLS, RPC, contratos o permisos. Evidencia en `.harness/tasks/archive/TASK-010-USABILITY/` y `artifacts/task010-usability/`.

**Checkpoint previo (2026-10-21): TASK-010 Gestión de usuarios — implementación local y review PASS; sin commit ni push.** `main` sincronizada con `origin/main` en `b066db2` (PR #12–#15 integrados). La auditoría confirmó que listado, alta por email, administración de rol/estado/vínculo profesional y seguridad tenant ya estaban implementados en TASK-005; no se duplicó lógica. Se cambió el nombre visible del módulo y se simplificaron las dos descripciones solicitadas. Vitest focal 62/62, TypeScript, ESLint focal y Chromium sintético desktop 1440/mobile 390 PASS; seis capturas y navegación/controles verificados. El lint global encontró un error en `test-results/dashboard-preview.mjs`, archivo local preexistente fuera de TASK-010. No hubo escrituras DEV/PROD, migrations, RLS ni cambios de permisos. `next-env.d.ts` y los expedientes locales TASK-010/011/012 siguen intactos. Evidencia en `.harness/tasks/archive/TASK-010-GESTION/` y `artifacts/task010-gestion-usuarios/`.

**Checkpoint previo (2026-10-21): TASK-013 Agenda visual — CLOSED / ARCHIVED; integración a main pendiente en ese momento.** La corrida DEV `27fcd681-4cb4-4450-8644-378bf343bcbb` pasó 13/13 escenarios autenticados, con 13 capturas verificadas, cleanup exacto, inventario restaurado y residuo cero. Los ajustes finales mejoran los turnos breves, la navegación por columnas mobile y la posición horaria inicial sin ocultar las 24 horas; el selector largo no desborda. Chromium local 6/6 combinaciones, 7/7 componentes, lint, tipos, build y review PASS. Expediente en `.harness/tasks/archive/TASK-013/`; ledgers operativos sólo locales. TASK-010 Usuarios, TASK-011, TASK-012 y `next-env.d.ts` siguen preservados. Sin nueva operación DEV/PROD, migraciones, RLS o permisos. La integración a main queda pendiente del PR, sus checks y la decisión de merge.

**Checkpoint previo (2026-10-21): TASK-013 Agenda visual — primera corrida DEV autorizada detenida y limpiada.** El runId `4a8f9648-3820-4dc4-9ceb-ff755d4e32b0` registró baseline de 14 recursos; el fixture falló en `public.users.email` antes de ejecutar Playwright (0/13, 0 capturas). La transacción se revirtió, el Auth sintético fue eliminado y el ledger confirma `stage=cleaned`, residuo cero e inventario restaurado. El defecto del fixture se corrigió localmente y la simulación focal pasó. El ledger consumido se preservó en `.harness/tasks/active/TASK-013/attempts/<runId>/validation-ledger.json`. No se inició una segunda corrida; la validación visual poblada necesita nueva autorización expresa. TASK-013 sigue abierta; sin PROD, migraciones, commit, push ni merge.

**Checkpoint previo (2026-10-21): TASK-013 Agenda visual — primer intento de credencial sin acceso DEV.** `main` local sincronizada por fast-forward con `origin/main` en `a1e362a` (PR #12 y #13 integrados). Los originales TASK-010 Usuarios, TASK-011 y TASK-012 se preservan; Agenda usa `.harness/tasks/active/TASK-013/`. La ruta tenant ofrece Día/Semana/Mes, filtros por profesional, ID de especialidad reservable y estado, lectura paginada completa, hora civil del Center y navegación al detalle. En Día/Semana, una franja abre el selector existente de slots de PostgreSQL; sólo un slot ofrecido puede llevarse a Crear turno, donde se revalida antes de preseleccionarlo. Las horas ambiguas o inexistentes por DST se distinguen o se muestran fuera de la grilla. Vitest focal 39/39, lint, tipos, diff check y build PASS. La revisión visual autenticada ADMIN en desktop/mobile confirmó vistas, estado vacío, navegación Mes→Día y contraste; el único Center DEV accesible carece de especialidades, profesionales reservables y turnos, así que falta comprobar visualmente el flujo con slots y eventos reales. El primer corte tuvo review independiente PASS; la continuación tiene revisión focal sin hallazgos bloqueantes locales. No se repitió Gate D de TASK-009 porque sus contratos, DB, permisos y entorno remoto no cambiaron. TASK-013 sigue abierta. Sin acceso PROD, migrations, commit, push ni merge; `next-env.d.ts` permanece preservado.

**Estado previo (2026-10-20): TASK-009 — CLOSED / ARCHIVED.** Gate D recibió dictamen independiente **PASS**, comunicado por el usuario y registrado en [review.md](../.harness/tasks/archive/TASK-009/review.md). Integración: seis grupos PASS reutilizados del run `71c74b49-e099-4c63-9dba-7f8c76989882`. Browser-only final `4889153b-3960-403c-b6c2-26ad6f00e624`: Playwright desktop, mobile y CREATE perdido 3/3 PASS, sin fallos, skips ni reintentos; trazas y JSON de resultados conservados. Cleanup: 13 conjuntos propios eliminados por UUID exacto, baseline de 14 recursos restaurado, 23 migrations; dry-run y lint finales PASS. Reporte, ledger y evidencias permanecen en `.task009-gate-d/`, `test-results/` y archivos por runId. Los mensajes `The destination stream closed early` son observación no bloqueante sin consecuencia material demostrada; no se atribuye smoke humano no documentado. Expediente y [retrospectiva](../.harness/tasks/archive/TASK-009/retrospective.md) archivados. Sin nueva operación DEV/PROD, commit ni push durante el cierre.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, Playwright estabilizado localmente; validación remota pendiente.** El run DEV `8c2618d2-f270-452a-bcc0-476333be7dd7` pasó preflight/setup y reutilizó seis grupos de integración PASS, pero se detuvo en la aserción de Nota del primer test; mobile y reconciliación CREATE no se ejecutaron. `trace.zip` y snapshot muestran que `fill` escribió la nota y el locator exacto `getByLabel` dejó de resolver el textarea sin navegación intermedia. Se corrigió al rol textbox estable. La revisión completa de los tres escenarios corrigió la ambigüedad de horario móvil (opción y resumen), hizo que privacidad compare la nota editada, acotó las esperas de horario y de Server Actions, y añadió aserciones de resultados persistidos tras recarga y de un único CREATE reconciliado para la próxima ejecución. Una prueba local demostró además una carrera de interfaz en Reprogramar: los slots podían habilitarse antes de cargar los catálogos, descartando la selección; se cerró esa carrera sin cambiar reglas de negocio. `pnpm bootstrap`, 22/22 pruebas de componentes, Chromium local para selectores, ESLint, TypeScript, formato y sintaxis PASS. El run consumido conserva ledger/reporte/traza: `stage=cleaned`, 13 conjuntos `owned=cleanup`, residuo cero y 14 huellas finales iguales al baseline; dry-run y lint finales PASS. **Gate D y TASK-009 siguen abiertos**: falta ejecutar los tres escenarios Playwright en DEV con runId nuevo y cleanup verificado, bajo autorización específica. No hubo operación remota, PROD, migrations, cambios RLS/roles, commit ni push en esta estabilización.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, corrida Playwright focal autorizada y pendiente de ejecución con contraseña DEV.** El usuario autorizó un runId nuevo, hasta 8 Auth, 4 centros y 80 turnos sintéticos para validar sólo los tres escenarios Playwright pendientes. `run-browser-only.ps1` valida el PASS de seis grupos y cleanup del run `71c74b49-e099-4c63-9dba-7f8c76989882`, archiva su ledger, reporte y evidencia Playwright con huellas, pide una vez la contraseña DEV preexistente y llama al runner existente en modo navegador. El runner exige baseline READ ONLY antes de escribir, crea fixtures propias con ledger, ejecuta desktop/mobile/reconciliación, reconcilia intents, limpia UUID exactos, compara las 14 huellas y verifica dry-run/lint. No atribuye una nueva ejecución de integración al run focal. Simulaciones locales PowerShell 5.1 de éxito y tres fallos, 11 pruebas de formulario, 4 pruebas de parser/ledger/cleanup, sintaxis, ESLint, TypeScript y formato PASS. Playwright usa `localhost` y timeout de acción de 30 s. Este proceso no dispone de la contraseña PostgreSQL DEV: la operación remota aún no comenzó. Gate D sigue abierto hasta reporte de los tres escenarios, cleanup y review focalizado; sin PROD, migrations, cambios de permisos, commit ni push.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, integración PASS; navegador bloqueado por origen local de Next.** La corrida DEV `71c74b49-e099-4c63-9dba-7f8c76989882` pasó preflight, setup y seis grupos de Auth/RLS/RPC, DST y concurrencia. El primer test Playwright se detuvo en el selector Especialidad deshabilitado; los otros dos no se ejecutaron. El servidor aislado registró que Next bloqueó `/_next/hmr` desde `127.0.0.1`, host que usaba Playwright. Una reproducción local sin credenciales DEV mostró ausencia de hidratación interactiva desde `127.0.0.1` y funcionamiento desde `localhost`. Se cambió sólo el origen del Playwright aislado a `localhost` y se añadieron precondiciones acotadas con diagnóstico del formulario y las acciones; pruebas locales focalizadas PASS. El reporte y ledger consumidos no se modificaron: `stage=cleaned`, 13 conjuntos `owned=cleanup`, residuo cero y las 14 huellas del inventario final idénticas al baseline; dry-run final sin pendientes y lint sin errores. Gate D y TASK-009 siguen abiertos: falta validar Playwright desktop/mobile/reconciliación en una nueva ejecución autorizada y efectuar el review focalizado. No hubo nueva operación DEV, PROD, migration, commit ni push en esta corrección.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, nueva corrida DEV autorizada y launcher preparado.** El run anterior `f943fe75-0cd4-46b1-814e-f92ef8f8066f` quedó limpio, con residuo cero y baseline restaurado. `run-fresh.ps1` preserva ese expediente en un archivo por runId, verifica parser/CA/cleanup y usa el runner existente para una nueva corrida con runId distinto; éste comprueba identidad, 23 migrations y las 14 huellas en modo READ ONLY antes de escribir, ejecuta integración/Playwright y hace cleanup exacto. Las rutas localmente simuladas de éxito y errores, la función real de cleanup con dependencias simuladas y la regresión de precisión temporal pasaron. En ese checkpoint la nueva corrida remota aún no se había ejecutado. Gate D y TASK-009 permanecían abiertos; sin PROD, migrations nuevas, cambios de permisos, commit ni push.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, recuperación ejecutada, integración detenida en CAS de prueba DST.** El runId `f943fe75-0cd4-46b1-814e-f92ef8f8066f` pasó reconciliación read-only, Auth de ocho usuarios sintéticos y matriz inicial de acceso/RLS/RPC. Se detuvo en `America/New_York gap manipulated RESCHEDULE`: el cliente PostgreSQL del runner convertía `updated_at` con microsegundos a `Date` con milisegundos y el RPC recibió un token CAS distinto (`P0001`; el reporte no conserva el mensaje SQL original, pero el flujo apunta a `STALE_APPOINTMENT_STATE`). Se corrigió sólo el parser `timestamptz` del runner para conservar texto exacto; prueba local focalizada PASS. El reporte de recuperación y el ledger muestran cleanup por UUID con residuo cero, inventario final idéntico a las 14 huellas del baseline, dry-run vacío y lint sin errores. Integración DST completa, contratos restantes, carreras y Playwright siguen pendientes. Gate D y TASK-009 permanecen abiertos. El runId consumido no se reutiliza; cualquier nueva corrida con fixtures requiere un runId nuevo y comprobar autorización antes de escribir. Ver `implementation-report.md`.

**Checkpoint previo (2026-10-20): TASK-009 Gate D, recuperación del run original preparada y pendiente de una única ejecución acreditada.** El runId `f943fe75-0cd4-46b1-814e-f92ef8f8066f` falló en `creating` por `EPERM` al reemplazar el ledger en Windows, después del `COMMIT` de setup; los recursos remotos aún no fueron reconciliados. Ledger principal, temporal y reporte originales se conservaron y validaron localmente. Se reprodujo el bloqueo de reemplazo y se corrigió `ledger.mjs` con temporales únicos y reintentos limitados; pruebas locales de bloqueo real y preservación PASS. `resume-existing.ps1` valida el runId y la CA Supabase, pide una sola vez la contraseña DEV y ejecuta recuperación `READ ONLY`, integración pendiente y cleanup exacto mediante scripts existentes; se detiene ante drift y prohíbe reejecución accidental. `pnpm check` PASS (76/76 suites, 601/601 Vitest, 11/11 tooling). No hubo nuevas lecturas/escrituras DEV desde este proceso porque la contraseña sólo está en el PowerShell del usuario. Gate D y TASK-009 siguen abiertos; no se aplicaron migrations adicionales, no se accedió a PROD ni hubo commit/push. Ver `implementation-report.md` de TASK-009.

**Checkpoint previo (2026-10-20): TASK-009 — Gate D POST estructural PASS según capturas manuales del usuario; integración real entonces pendiente.** En `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), el usuario informó 23 versiones aplicadas exactamente en orden (última `20261019170000`), una sola firma `staff_search_appointment_slots(uuid,uuid,uuid,date)` y retorno civil aprobado de seis columnas. La captura POST anterior ya había informado la migration civil una vez, owner `postgres`, `SECURITY DEFINER`, `search_path` vacío y ACL/EXECUTE sólo para postgres/authenticated. Codex no hizo consultas remotas ni cotejó una exportación íntegra de la última lista; el PASS estructural se atribuye a la evidencia manual comunicada. El PRE `dev-hosted` conserva su PASS dentro de su alcance. Faltan dry-run/lint final mediante vía acreditada, Auth/RLS/RPC funcional, tiempos civiles/DST, carreras, Playwright, inventario/cleanup y review independiente de Gate D. La propuesta acotada de fixtures sintéticas, matriz y limpieza está en `.harness/tasks/archive/TASK-009/gate-d-integration-authorization.md`; crear, usar o borrar fixtures en DEV requiere autorización humana separada. No se ejecutó integración ni otra escritura por Codex; Gate D y TASK-009 siguen abiertos. `pnpm bootstrap` local PASS; sin acceso a PROD ni commit/push Git.

**Checkpoint previo (2026-10-20): TASK-009 — Gate D, migration civil aplicada por el usuario a DEV; POST entonces parcial.** El usuario autorizó y ejecutó en PowerShell `20261019170000_add_appointment_slot_civil_time.sql` sólo contra `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`), tras verificar ref, SHA-256 aprobado y dry-run con esa única migration. Supabase CLI 2.117.0 informó aplicación y finalización de `db push`; Codex no ejecutó ni revalidó independientemente el push. SHA-256 local recalculado: `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`. En consulta manual POST de catálogo dentro de transacción `READ ONLY`, el usuario informó 23 migrations aplicadas y la civil una vez, RPC con seis columnas civiles, owner `postgres`, `SECURITY DEFINER`, `search_path` vacío y EXECUTE limitado a `postgres`/`authenticated` (sin acceso de `anon`/`service_role`). Para cerrar el POST de catálogo falta cotejar las **23 versiones exactas** y descartar **sobrecargas** del RPC; el conteo y el retorno aislado no prueban esos dos puntos. El PRE ya acreditó RLS/ACL/roles bajo `dev-hosted`, y el SQL aplicado sólo recrea el RPC y sus grants. La captura focalizada puede hacerse en el SQL Editor con `BEGIN READ ONLY`, timeout, SELECT de metadatos y `ROLLBACK`; no repetir el flujo CLI sin contraseña para obtener lecturas. Dry-run vacío, DB lint, Auth/RLS/RPC real, tiempos civiles, carreras, navegador, inventario y cleanup quedan para Gate D. Fixtures y demás escrituras DEV requieren autorización humana separada; aún no se crearon. Gate D y TASK-009 siguen abiertos, sin acceso a PROD ni commit/push Git por Codex. Ver `.harness/tasks/archive/TASK-009/implementation-report.md` y `gate-d-dev-readonly-preflight.md`.

**Lo siguiente es historial PRE; su solicitud de autorización de la migration ya fue satisfecha.**

**Checkpoint previo (2026-10-20): TASK-009 — Gate D DEV READ-ONLY METADATA PREFLIGHT PASS según captura manual del usuario; autorización de migration entonces pendiente.** El usuario pegó el JSON íntegro exportado del SQL Editor de `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`); Codex lo cotejó con `verifyCatalog(..., dev-hosted)` y el inventario local, sin consultar DEV. La sesión informó base/usuario `postgres`, PostgreSQL 17.6, transacción `READ ONLY` y timeout 5 s. Las 22 versiones aplicadas coinciden exactamente y en orden con las primeras 22 de 23 migrations locales; sólo falta `20261019170000_add_appointment_slot_civil_time.sql` (SHA-256 `4C2068AFD1E591669C39984894C38C6C8AEC34E34BE0D1B3809CCA1C0B312898`). Una sola firma RPC PRE de dos columnas, owner `postgres`, `SECURITY DEFINER`, `search_path` vacío, EXECUTE sólo para postgres/authenticated sin GRANT OPTION, default ACL de owner postgres estrecha, once firmas Appointments exactas y cero dependencias entrantes según consulta manual previa. El perfil ACL hospedado coincide en cuatro roles, ocho aristas de infraestructura más `postgres→authenticated`, grantors/opciones, rutas globales vacías y único superuser `supabase_admin`; `rolvaliduntil` vencido de CLI no borra el rol ni la membresía. Las siete tablas inspeccionadas mantienen RLS; `appointments` no tiene policies ni privilegio agregado de SELECT/INSERT/UPDATE/DELETE para authenticated. El valor agregado `true` en otras tablas no acredita privilegios individuales. Gate C y reviews SQL/security locales conservan PASS independiente; `pnpm bootstrap` y `verify.mjs --local` pasaron. El paquete de autorización humana para aplicar sólo la migration civil a DEV quedó preparado en `gate-d-dev-readonly-preflight.md`, con flujo CLI por contraseña preexistente, dry-run exacto, controles POST y recuperación. Este PASS de preflight no autoriza escribir. No hubo migration, fixtures, integración, Playwright, PROD, commit, push ni cierre de TASK-009.

**Checkpoint previo (2026-10-20): TASK-009 — Gate D DEV infrastructure ACL remediation preparada para re-review independiente.** El `CHANGES_REQUESTED` de `review.md` desde línea 465 sigue vigente. El verificador tiene perfiles cerrados `shadow` y `dev-hosted`; el hospedado exige el grafo exacto de `supabase_realtime_admin` y acepta `cli_login_postgres` sólo si está presente y coincide con el rol temporal observado. Pasaron 14/14 tests de verificador, replay y catálogo real de 23 migrations en PostgreSQL local, los seis mutantes ACL previos y 14 mutantes del fixture hospedado con rollback; el control local volvió a pasar. Este fixture no sustituye una comprobación DEV. El preflight previo tuvo SELECT directos en transacción `READ ONLY`, pero obtuvo la credencial mediante un flujo CLI sin contraseña que puede crear/renovar un rol por API POST; por tanto no se afirma lectura estricta de extremo a extremo. La siguiente captura DEV requiere credencial preexistente sin aprovisionamiento, identidad/ref verificada y sólo SELECT de metadatos bajo `READ ONLY`/timeout/rollback; si no está disponible, queda bloqueada hasta autorización separada del efecto administrado. No hubo DEV/PROD ni migration remota, fixtures, stage, commit, push o cierre en esta ronda. Gate D sigue bloqueado; no pedir aún autorización para aplicar la migration. Evidencia en `.harness/tasks/archive/TASK-009/gate-d-remediation.md` y `implementation-report.md`.

**Checkpoint previo (2026-10-19):** TASK-009 — Appointments / Turnos. **GATE D DEV READ-ONLY PREFLIGHT BLOCKED — ACTION REQUIRED**. El review SQL/security independiente de `review.md` desde línea 437 pasó y cerró D-P1/D-P2/D-P3 dentro de sus límites; Gate C permanece PASS. El preflight remoto verificó `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`, `sa-east-1`), 22 migraciones aplicadas de 23 locales, sólo `20261019170000_add_appointment_slot_civil_time.sql` pendiente en dry-run `--skip-vault`, health y lint PASS. El RPC PRE conserva dos columnas, firma/owner/ACL esperados, cero dependencias entrantes y RLS de `appointments` sin policies ni DML web. **Desvío nuevo:** DEV incluye `cli_login_postgres` y `supabase_realtime_admin` con capacidad `SET ROLE authenticated` no contemplada por el verificador POST aprobado; no hay herencia inmediata de EXECUTE ni acceso efectivo de anon/service_role al RPC actual. Requiere clasificación y review independiente antes de pedir autorización para aplicar la migration. Sólo se consultaron metadatos en transacción READ ONLY; sin DDL/DML, migration, fixtures, E2E, PROD, stage, commit, push ni cierre. Informe en `.harness/tasks/archive/TASK-009/gate-d-dev-readonly-preflight.md`.

**Checkpoint previo:** TASK-009 — Appointments / Turnos. **GATE D SQL/SECURITY SECOND RE-REVIEW CHANGES_REQUESTED; tercera remediación D-P3 preparada para re-review independiente** (2026-10-19). D-P1/D-P2 mantienen PASS limitado al SQL local y Gate C sigue aprobado. Se corrigió el falso FAIL de la ruta legítima `supabase_storage_admin → authenticator → authenticated` mediante atributos y grafo de membresías exactos, sin exceptuar roles adicionales; se corrigió el falso PASS de `rows` local ejecutando conductualmente el módulo de adaptador completo con su helper real. Las 12 pruebas del verificador, `--local` para 23 migrations, replay y catálogo PostgreSQL local pasan; seis mutantes ACL reales fueron rechazados con rollback. `pnpm check` PASS: 601/601 Vitest y 11/11 tooling; `git diff --check` PASS. El SQL de la migration, Appointments/Patients y `review.md` no se modificaron. No hubo acceso a DEV/PROD, fixtures remotos, stage, commit, push ni cierre. Gate D sigue detenido hasta re-review independiente, preflight DEV read-only y autorizaciones posteriores. Evidencia en `.harness/tasks/archive/TASK-009/gate-d-remediation.md` y `implementation-report.md`.

**Checkpoint previo:** TASK-009 — Appointments / Turnos. **GATE C INDEPENDENT REVIEW PASS; GATE D SQL PREFLIGHT REMEDIATION COMPLETE — READY FOR INDEPENDENT SECURITY REVIEW** (2026-10-19). Rama `task/009-appointments`, HEAD `73122b680949acd4dfa905bf79da37e1d3e3205d`; B1-R1 y C-R1–C-R6 CLOSED. Los tres bloqueos técnicos D-P1/D-P2/D-P3 se remediaron localmente: transacción explícita para `DROP/CREATE/REVOKE/GRANT`, revocación explícita a `service_role` y verificador nuevo de 23 migrations/retorno de seis columnas/contrato TS y ACL. PostgreSQL shadow 17.6.1.166 probó rollback de fallo inducido, visibilidad entre conexiones, roles efectivos y catálogo 23/23; Supabase CLI 2.117.0 aplicó sólo la migration 23 en un segundo shadow. `pnpm check` PASS (601/601 Vitest, 11/11 tooling), tests propios del verificador 5/5 y `git diff --check` PASS. El SQL permanece local y **sin aplicar a DEV**. Gate D sigue detenido hasta review SQL/security independiente, preflight DEV read-only y autorización humana explícita antes de cualquier escritura DEV. Auth/RLS/RPC real, tzdata, carreras y navegador siguen pendientes; PROD fuera de alcance. Sin stage/commit/push/PR ni cierre de TASK-009. `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-010–012 intactos. Evidencia en `.harness/tasks/archive/TASK-009/gate-d-remediation.md` y preflight histórico en `gate-d-preflight.md`.

**Checkpoint B1 previo:** TASK-009 — Appointments / Turnos. **GATE B1 IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT SERVER/DOMAIN REVIEW** (2026-10-19). En rama `task/009-appointments`, HEAD y remoto `9ca14e9446e31e30d1279a346602e73b288b4b5a`; `pnpm bootstrap` PASS. Se implementó localmente `src/modules/appointments/`: schemas Zod, adaptadores para las once RPCs aprobadas, lecturas separadas staff/Professional, autorización de sesión, CREATE/RESCHEDULE/STATUS/NOTE, CAS textual exacto, nota `NULL` encapsulada, resultados estables y reconciliación antes de reintentar mutaciones inciertas. Privacidad Professional y contratos se probaron con mocks; la autorización real integrada pertenece a Gate D. `pnpm check` final PASS con 541 Vitest y 11 tooling; lint, typecheck, formato focalizado y diff check separados PASS. DEV permanece en el checkpoint B0 con 22/22 migrations, sin escritura B1; PROD intacto. Sin Gate C, rutas, pantallas, Agenda, stage, commit, push ni PR. `next-env.d.ts` sigue M unstaged con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-010–012 intactos. Ver `.harness/tasks/archive/TASK-009/implementation-report.md`.

**Checkpoint B0-R1 previo:** TASK-009 — Appointments / Turnos, Gate B0-R1 remediado; **REMEDIATION COMPLETE — READY FOR INDEPENDENT RE-REVIEW** (2026-10-19). El review B0 conserva `B0-R1 MEDIUM / CHANGES_REQUESTED` hasta el re-review. Rama `task/009-appointments`, HEAD `2ecb4c195a77f5ebe033d11e910d7b062add9811`. Se endureció sólo `scripts/verify-task009-b0-concurrency.mjs`: 11 carreras con PIDs distintos, primera transacción abierta, espera de lock observada en 10 casos y conflicto temprano demostrado en cancel/create; asserts de resultados exactos y estado persistido tras cada carrera. Pasaron también control negativo secuencial y cancelación con ROLLBACK. Shadow PostgreSQL 17.6.1.166 reconstruido con 21 migrations de DEV + B0, tests SQL B0/históricos/A1 runtime, boundedness con 50.000 filas, `plpgsql_check` 8/8 y `pnpm check` (492 Vitest + 11 tooling), lint y typecheck. DEV `salud-plus-turnos-dev` continúa en A2 con 21/21 migrations; B0 local conserva SHA-256 `A3BAB44E0A3054CA49640DE6BD5C9D490D8AD5B302B455AA07F41DA237C2E677` y **no se aplicó a DEV/PROD**. Sin Gate B1, Server Actions, frontend, Agenda, stage, commit, push ni PR. `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-010–012 intactos. Evidencia detallada en `.harness/tasks/archive/TASK-009/implementation-report.md`.

**Checkpoint A2 previo:** TASK-009 — Appointments / Turnos, `GATE A2 COMPLETE — DB FOUNDATION VERIFIED ON DEV` (2026-10-19). El re-review independiente cerró R1, R2 y A1-SQL-01; Gate A1 SQL/security pasó. Se revalidó `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`, `sa-east-1`, PostgreSQL 17.6), 20/20 migrations previas y dry-run con sólo `20261016190000_add_appointment_foundation.sql`. La migration aprobada SHA-256 `7533F658093ED9F0D5CC689A847028C195842A29D7CC007026FE782CF1C98D45` se aplicó una vez a DEV; después 21/21, sin pendientes, health y DB lint PASS. Catálogo real PASS: siete RPCs, cuatro helpers privados, grants/RLS, trigger CAS, GiST y ambas cotas UTC A1-SQL-01. Matriz SQL DEV de roles, privacidad, historia inactiva, slots y DST PASS con rollback e inventario de 11 tablas idéntico. Tipos TypeScript regenerados desde DEV; `pnpm check` (492 Vitest y 11 tests tooling), lint, typecheck y formato focalizado PASS. La regresión de 50.000 filas y seis planes pertenece al shadow aprobado de Gate A1; `supabase db start` no tiene PASS por la diferencia de imagen `.166/.167`. PROD fuera de alcance. TASK-009 sigue activa, sin Gate B/C/D ni Agenda; próximo Gate B por instrucción separada. Ver `.harness/tasks/archive/TASK-009/implementation-report.md`. `next-env.d.ts` ajeno permanece M unstaged con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.

**Cierre histórico de TASK-008:** Availability / Disponibilidad de profesionales. `MERGED / ARCHIVED`; TASK008-IR-01 y TASK008-IR-02 `CLOSED`. PR #11 integrado en `main` mediante squash merge `c2857308ebf144fd69020636f8021ece4eb258cd`, con CI y final merge review PASS. Contrato, plan, reviews, evidencia y retrospectiva en `.harness/tasks/archive/TASK-008/`. Migration `20261016160000_add_availability_foundation.sql` aplicada sólo a DEV; PROD fuera de alcance. El estado de TASK-007 descrito debajo es histórico.

## TASK-008 — cierre, implementación y verificación (2026-10-16)

- Gate A pasó tras preflight read-only: DEV `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`, `sa-east-1`), 19/19 migrations iniciales, dry-run limpio, health y DB lint. El catálogo vivo de Availability, ProfessionalCenter, Center, membership y appointments coincidió con migrations; no apareció policy, grant, RPC ni constraint inesperado. El único `centers.timezone` existente fue `America/Argentina/Buenos_Aires`, válido. El diff de shadow incluyó ruido de privilegios default del entorno y funciones reemitidas con cuerpo idéntico, sin drift material del contrato.
- Migration incremental aditiva aplicada a DEV: SELECT activo tenant bajo RLS; contexto mínimo de profesionales; RPCs estrechas para alta, edición, retiro lógico y duración; advertencia booleana read-only sobre turnos futuros; trigger CAS monotónico de Availability. No se alteró el esquema ni los datos de appointments. Tipos `database.types.ts` regenerados desde DEV.
- Rutas de índice y detalle, navegación, pantalla semanal responsive, acciones, validación Zod y errores estables implementados. ADMIN y RECEPTION administran; PROFESSIONAL sólo consulta su vínculo; PLATFORM_ADMIN sin membership tenant no accede.
- Verificación: 20/20 migrations final, dry-run sin pendientes, health y DB lint PASS; `pnpm check` PASS (492 Vitest + 11 tests del finalizador TASK-007), build webpack de producción en copia aislada PASS. Integración DEV cubrió roles/RLS, grants, RPCs, GiST, stale, turnos futuros y tres carreras observadas por lock. Smoke Playwright sobre build aislado cubrió cuatro roles, alta/edición/retiro, duración y móvil 390 px; PASS. Auth foundation y TASK-006B DEV PASS. Fixtures propios borrados por UUID, cero residuo y mismo inventario/digest persistente antes/después.
- `next-env.d.ts` ajeno sigue `M`, unstaged e intacto con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. TASK-009 a TASK-012 permanecen ajenos. El check de formato global sigue fallando por formato previo en archivos fuera del alcance; el formato focalizado de código TASK-008 pasa. Ver `implementation-report.md` para evidencia y riesgo residual.

**Fase:** `TASK-007 CLOSED`. Patients completado para el alcance actual del MVP; TASK-007A, 007B y 007C+D cerradas. GATE C y GATE D automatizado PASS. PR #8 integrado en `main` mediante squash merge (`38b02b7aac8d0f384af6f3065934b7a72eb6b234`).
**Tarea archivada:** D1–D8 aprobadas; P007-R1/R2/R3, 007A-IR-1/IR-2, 007B-IR-1/IR-2/IR-3 y TASK-007-FIR-1/FIR-2 `CLOSED`. Artefactos en `.harness/tasks/archive/TASK-007/`, según el patrón de TASK-006.
**Último veredicto independiente:** `TASK-007 FINAL IMPLEMENTATION REVIEW PASS — READY FOR TASK-007 CLOSURE`. El gap histórico entre los digests ampliados sigue en categoría E, inconcluso y no reconciliado. TASK-006 sigue completada y archivada.
**Main al iniciar TASK-007:** `ea620655ee9f75f903dbce2d94bf820e298b7218` (igual a `origin/main` en el preflight). El squash funcional de TASK-006 fue `c127d3b81f73aba5c47d9ecf462529c73df79fcb`.
**Integración previa:** TASK-005 completada y PR #4 integrada en `main`.

<!-- TASK007_FINALIZER_STATUS_START -->

## TASK-007C+D — finalización automatizada

- Run DEV exacto `c9818e40-2d4d-4c1b-a392-14a9404a5111`: integración DB y E2E PASS previos. Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**; no se afirma smoke PASS.
- Ownership por UUID exacto, cleanup y auditoría posterior PASS; inventario DEV restaurado. Sin nuevos fixtures ni E2E.
- Paridad 19/19, dry-run sin pendientes, DB lint, schema/API y Baseline V2 exacto PASS (15/15 componentes; digest `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`).
- `next-env.d.ts` M, unstaged y con SHA exacto. El re-review independiente posterior fue PASS; en ese checkpoint TASK-007 quedó cerrada documentalmente y lista para PR. PR #8 se integró después.

<!-- TASK007_FINALIZER_STATUS_END -->

## TASK-007 — remediación del review final (2026-10-15)

- **FIR-1 CLOSED.** Vitest conserva sus exclusiones default y excluye sólo las tres suites `node:test` del finalizador. `pnpm test` ejecuta las 435 pruebas Vitest en 51 archivos y luego las 11 pruebas del finalizador con `node --test`; PASS, exit code 0.
- **FIR-2 CLOSED.** Cada resolve se asocia al snapshot de nacionalidad, documento y fecha de nacimiento y a una generación. Editar cualquiera de los tres campos invalida la solicitud y limpia resolución/confirmación; respuestas tardías o fuera de orden se descartan. Submit vuelve a comparar el snapshot. Las tres carreras con promesa diferida y los 104 tests focalizados de Patients pasan.
- Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**. El **HISTORICAL VERIFICATION GAP** sigue en categoría **E — insufficient evidence**. El riesgo de inferencia por resolve/create exacto y sus controles de abuso, rate limiting y monitoreo siguen pendientes **PRE-PROD**. No se ejecutaron DEV, Supabase, fixtures, E2E ni baseline en esta remediación; PROD fuera de alcance.

## Cierre documental TASK-007 — 2026-10-15

- `TASK-007 CLOSED`; `TASK-007-FIR-1 CLOSED`; `TASK-007-FIR-2 CLOSED`. El re-review independiente final fue **PASS**, sin findings nuevos. PR #8 integrado en `main`; Patients completado para el alcance actual del MVP.
- Patients incluye listado/búsqueda tenant, registro staged con resolve exacto y caminos NOT_FOUND create, NOT_LINKED link, ACTIVE reuse e INACTIVE reactivate; panel de detalle/administración, edición de datos administrativos, desactivación/reactivación, CAS/stale protection y UI responsive consistente con módulos administrativos.
- 007A foundation y 007B list/search están cerradas; 007C+D completó GATE C y GATE D automatizado. En C+D hubo **zero DB delta**. GATE D dejó ownership/cleanup exacto, inventario restaurado y Baseline V2 exacto PASS.
- Smoke humano **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**; no se cuenta como PASS. **HISTORICAL VERIFICATION GAP: Category E — insufficient evidence**, sin reconciliación. **PRE-PROD:** riesgo de inferencia por exact global resolve/create, rate limiting, protección contra abuso y monitoring/telemetry siguen pendientes.

## Plan de la etapa restante TASK-007C+D (checkpoint histórico previo a implementación)

- Se unificó el workflow de 007C (Patient Management) y 007D (Integration/E2E/Final Verification) sin reducir alcance ni borrar el historial. **GATE C** exige flujo funcional completo y verificación local; **GATE D** sólo empieza tras C PASS e incluye preflight DEV, E2E/integración, smoke humano, cleanup y Baseline V2 exacto. Habrá un plan review independiente y un implementation review final para C+D, seguidos del cierre integral de TASK-007.
- El plan reutiliza exclusivamente las siete RPCs de 007A por `callPatientRpc()`/`patient-rpc-contracts.ts` y propone panel adaptable dentro de `/centers/[centerId]/patients`. ADMIN/RECEPTION administran PatientCenter del Center; PROFESSIONAL no accede y PLATFORM_ADMIN-only no obtiene bypass. La identidad global sigue readonly. Notas administrativas se leen sólo en panel mediante SELECT tenant filtrado por Center e ID con RLS existente.
- El análisis del contrato versionado sostiene **ZERO DB CHANGE**: sin migrations, SQL, RLS, grants, RPCs ni tipos generados. Si preflight/implementación demuestra lo contrario, STOP antes de cambiar DB. Esta instancia no implementó ni consultó/mutó DEV; PROD fuera de alcance.
- Preflight local: rama `task/007-patients`, HEAD `76206deca44853215f666d6bc4dd327ba611e977`, `pnpm bootstrap` PASS. Único cambio inicial `M next-env.d.ts`, unstaged, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, ajeno e intacto. Baseline V2 fijo `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`; el gap histórico sigue categoría E. Riesgo de inferencia global aceptado sólo para MVP DEV; abuso/rate limiting y monitoreo siguen pendientes PRE-PROD. No hay decisión humana de producto abierta identificada en el plan.

## TASK-007C+D — checkpoint de implementación GATE C

- Preflight de implementación exacto: rama y HEAD/base remota `76206deca44853215f666d6bc4dd327ba611e977`; sólo `plan.md`, `review.md`, `docs/status.md` y `next-env.d.ts` modificados. Los tres primeros eran artefactos legítimos del plan/review; `next-env.d.ts` sigue ajeno, unstaged y con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. `pnpm bootstrap` y `git diff --check` PASS.
- `/centers/[centerId]/patients` conserva búsqueda tenant y añade `patient=<UUID>` canónico para panel, acción Administrar en tabla/tarjeta y Registrar explícito. El detalle se obtiene con SELECT tenant filtrado por `center_id` e `id`, join de Person vinculada y proyección acotada. Las notas sólo aparecen en el panel. El panel muestra identidad readonly, edita datos administrativos, desactiva y permite reactivar tras resolve y confirmación con CAS. El diálogo nativo es adaptable a móvil y usa foco inicial, Escape, labels, errores asociados, confirmaciones y pending.
- Las seis Server Actions de resolve/create/link/reactivate/update/deactivate crean cliente de sesión, validan con Zod, reautorizan ADMIN/RECEPTION y delegan al servicio mediante `callPatientRpc()`. Las mutaciones exitosas revalidan la ruta. El flujo staged distingue NOT_FOUND, mismatch, NOT_LINKED, ACTIVE e INACTIVE; no ejecuta resolve por miss de SEARCH. Errores SQL se mapean por par exacto sin exponer texto SQL; stale exige recarga sin retry automático. No hay RPC directa adicional ni DML genérico.
- **GATE C PASS:** 429/429 tests en 51 archivos; `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm security:check:client-bundle`, Prettier focalizado y `git diff --check` PASS. Build y guard se ejecutaron en copia física aislada para no alterar `next-env.d.ts`. Zero migrations, SQL, RLS, grants, RPC definitions o tipos generados modificados.
- **GATE D bloqueado antes de toda escritura DEV:** ref local `ehllxymqyzrofydrvtzo`, 19 migrations locales y SHA del verificador `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c` confirmados. El CLI en este entorno devolvió `LegacyPlatformAuthRequiredError` por falta de autenticación de plataforma; no se pudo obtener paridad viva, dry-run, lint, schema verifier ni Baseline V2. Se requiere evidencia live DEV capturada por la persona en terminal autenticada. No hay fixture manifest ni fixture creado, E2E/smoke/cleanup DEV ni baseline final; no se declara implementación completa ni se stagea/commitea/pushea. PROD fuera de alcance.
- El **HISTORICAL VERIFICATION GAP** permanece categoría **E — insufficient evidence**; el riesgo de inferencia global exacta y los controles de abuso, rate limiting y monitoreo continúan pendientes **PRE-PROD**. El digest V2 `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359` es expectativa fija, no nueva medición DEV en este checkpoint.

## TASK-007C+D — continuación GATE D (2026-10-14)

- En la ejecución DEV `c9818e40-2d4d-4c1b-a392-14a9404a5111`, `setup` creó fixtures y la integración DB reportó PASS. Playwright falló al cargar el spec porque eliminó `test-results` antes de leer el ledger ubicado allí; `No tests found` fue secundario. El inventario read-only humano identificó 6 Auth/Public users, 3 Centers, 6 memberships, 7 Persons, 6 PatientCenters y sus vínculos exactos; las cantidades corresponden al baseline y las referencias externas consultadas son cero. `recover-ledger.mjs` volvió a comparar DEV y reconstruyó el ledger local; `audit` confirmó ownership exacto. El ledger vive ahora fuera de `test-results` y su prueba local de supervivencia pasó. `recover-credentials.mjs` reasignó una contraseña temporal a los seis Auth UUID verificados y el segundo `audit` pasó. El primer E2E reanudado quedó en login por un `expect` de 5 s: Auth aceptó la credencial exacta y una prueba UI aislada completó redirección en 5,226 ms; se amplió a 60 s para login y 30 s para otras aserciones. El audit posterior siguió pasando sin nuevas filas de pacientes. E2E corregido, smoke y cleanup siguen pendientes; GATE D no es PASS.
- Tras ampliar el timeout, Playwright pasó el escenario completo de RECEPTION desktop. El segundo llegó al último chequeo, PROFESSIONAL denied, y falló porque esperaba HTTP 404; la captura mostró la página 404 renderizada y ningún dato de pacientes, con respuesta HTTP 200 por streaming. El spec comprueba ahora el 404 visible y la ausencia de la pantalla/listado de pacientes. El test puntual de sólo lectura verificó esa denegación (1/1 PASS) sin repetir las mutaciones ya hechas; `cleanup-isolated` y `audit` posteriores pasaron. El ledger quedó `e2e_pass`, con ownership de 8 Persons y 8 PatientCenters. Smoke humano, cleanup y baseline final siguen pendientes; GATE D no es PASS.
- Antes del smoke se comprobó por error la ruta antigua `test-results/task007-gate-d/fixture-ledger.json`, que Playwright debe limpiar. El ledger vigente sí existe en `.task007-gate-d/fixture-ledger.json`, SHA-256 `572f62a8875c25682437000df13be9ac5c129c86119677f951f2d2c53fc0297d`, runId/Center IDs exactos, `e2e_pass`, ownership 8/8 y credenciales presentes sin imprimir. `server-temp.json` pertenece sólo al servidor Next; el puerto 31007 estaba abierto y no se ejecutó su cleanup. Se añadieron checks SHA antes/después de `cleanup-isolated` y `audit` y comando local read-only `ledger-status.mjs`. Pruebas locales de ambos lifecycles PASS (2/2). El intento de audit desde Codex no consultó DEV por falta de auth CLI; el audit humano previo pasó y el archivo sigue presente. No hubo recuperación nueva ni escrituras DEV.
- La persona usuaria aportó evidencia **HUMAN-CAPTURED LIVE DEV** de `ehllxymqyzrofydrvtzo`: 19/19 migrations exactas, `db push --dry-run` al día, `db lint` sin errores, schema/API verifier PASS y Baseline V2 exacto PASS (`24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`, estable, sin mismatches ni domain errors). **GATE D PREFLIGHT PASS**; no se repite GATE C.
- Runner y runbook DEV preparados en `scripts/task007-gate-d*`, `tests/e2e/task-007-gate-d.spec.mjs` y `.harness/tasks/archive/TASK-007/gate-d-runbook.md`: inventario/ownership antes de escribir, fixtures propios, integración DB/carreras/privacy, E2E, captura humana por UUID exacto, auditoría/cleanup y verificación final. En este entorno sólo se verificó sintaxis, lint, formato y arranque aislado de Next; la API de tablas responde `42501` con la clave de servicio y falta la sesión CLI de plataforma, por lo que **ningún fixture ni mutación DEV se ejecutó aquí**. La persona usuaria ejecutará el runner desde su terminal autenticado y aportará la evidencia de smoke/cleanup/final gate.
- `next-env.d.ts` continúa `M`, unstaged, SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. GATE D aún no es PASS; no stage, commit, push, PR, merge ni cierre de TASK-007.

## Cierre del review TASK-007B

- 007B-IR-1 **CLOSED — cookie refresh verificado por re-review independiente**: cada `NextResponse.next` recibe un snapshot fresco de `request.headers` y sobrescribe `x-salud-plus-original-search` con `NextRequest.nextUrl.search`. Después de `setAll`, el nuevo snapshot incluye las cookies renovadas y conserva las demás. La prueba con clases reales de Next falló en `1c214bad` por reenviar `session=old` y pasa tras el fix; cubre dos cookies renovadas, una conservada, spoofing y respuesta `Set-Cookie`. Sin refresh, la cookie original y la query real se conservan. La página sigue leyendo el header tras `requireRole`.
- 007B-IR-2 **CLOSED**: la denegación RPC se reconoce sólo con `code=42501` y `message=PATIENT_ACCESS_DENIED` exactos. Subcadenas y otros errores siguen siendo fallos técnicos recuperables.
- 007B-IR-3 **CLOSED**: el test de ruta verifica el contrato `ADMIN`/`RECEPTION`; una prueba separada ejecuta `requireRole` real con roles permitidos y rechazos de PROFESSIONAL, membership/Center inactivos y cross-center.
- Verificación local de la remediación actual: proxy 2/2; IR-1 focalizados 44/44 en 3 archivos; 007B focalizados 86/86 en 7 archivos; suite completa 400/400 en 47 archivos; lint y typecheck PASS. `pnpm build` y `pnpm security:check:client-bundle` PASS en copia física aislada con `pnpm_config_verify_deps_before_run=false`; Prettier focalizado y `git diff --check` PASS. `next-env.d.ts` ajeno conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, unstaged. Zero DB/schema delta; DEV y PROD no consultados ni mutados. TASK-007C no iniciado.

## Implementación TASK-007B

- `/centers/[centerId]/patients` ofrece búsqueda tenant con `q/state/page` canónicos, filtros ACTIVE/INACTIVE/ALL, paginación 25+1 sin COUNT, tabla desktop, tarjetas móviles, loading y estados vacíos/error. ADMIN y RECEPTION acceden; PROFESSIONAL y PLATFORM_ADMIN-only no acceden. La home muestra navegación según rol.
- La única lectura de Patients usa `staff_search_patient_centers` mediante `callPatientRpc()` y cliente Supabase server de la sesión. No hay resolve, registro ni mutaciones.
- Tests focalizados 47/47; suite completa 377/377 en 46 archivos; lint, typecheck, build, Prettier focalizado, `git diff --check` y guard de secretos del bundle cliente PASS. `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, unstaged.
- Zero delta de migrations, SQL, RLS, grants, RPCs y tipos generados. DEV no se consultó ni mutó para 007B; PROD fuera de alcance. E2E de Patients reservado a 007D.

## Remediación de review TASK-007A

El reviewer independiente cerró 007A-IR-1/IR-2 y aceptó evidencia live DEV capturada por la persona usuaria para el gate read-only final. El historial y los resultados técnicos de la remediación se conservan abajo.

- 007A-IR-1: contrato app-facing derivado de Zod y adapter único para las siete RPCs; resolve modela cinco variantes, search conserva email/cobertura NULL y create/link/update aceptan argumentos administrativos NULL. Los tipos de transporte generados siguen intactos. Tests de tipo y payload, guard de firmas/nombres y checks locales PASS.
- 007A-IR-2: comparador V2 comprueba inventario y metadata exacta (`included_fields`, `excluded_fields`, `field_types`, `row_key_fields`) además de filas y digests. Tests sintéticos de columna agregada con `persons` vacía, tipo, clave, exclusión Auth y componente extra PASS. Manifest y verificador V2 intactos; SHA del verificador `f00b3f711549c259617de48881c7a7864b8c80479ca014f184863fcfd50f555c`.
- DEV read-only final: 19 migrations locales == 19 DEV, dry-run sin pendientes, lint de DB y schema verifier PASS. Baseline V2 exacto 15/15 componentes y metadata, digest global `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`. Suite 330/330, lint, typecheck, build, formato y guard de secretos PASS. PROD fuera de alcance.

## Verificación final TASK-006

- Supabase CLI 2.117.0: 17 migrations locales == 17 DEV; `db push --dry-run` sin pendientes;
  `db lint --linked` sin errores. No se crearon ni editaron migrations en TASK-006F.
- Baseline DEV exacto antes y después de regresiones y E2E:
  `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
- TASK-006B DB/RLS/RPC/concurrencia, Auth foundation, B3A invariants, E2E B3D y E2E focalizado
  TASK-006F pasaron con cleanup. Tras la remediación final, `pnpm test` pasó 308/308; lint,
  typecheck, build, Prettier focalizado y guard de secretos del bundle cliente pasaron. El E2E
  ampliado pasó 1/1 y el smoke manual humano 6/6.
- El re-review final independiente cerró FINAL-R1 y FINAL-R2 sin findings nuevos. El finding LOW
  documental del review del PR #6 también quedó corregido y el PR obtuvo REVIEW PASS antes del
  squash merge. TASK-006 está archivada en `.harness/tasks/archive/TASK-006/` con retrospectiva.
  PROD no fue consultado ni modificado durante TASK-006. El cambio local ajeno en `next-env.d.ts`
  permanece unstaged y fuera del cierre.

## Review final inicial TASK-006 (histórico)

- Veredicto: `TASK-006 FINAL REVIEW CHANGES_REQUESTED` (2026-10-13). Hay dos findings MEDIUM
  documentados en `.harness/tasks/archive/TASK-006/review.md`: faltaba administrar la descripción
  opcional de Specialty y completar el mínimo E2E/smoke aprobado en el plan. Ambos quedaron cerrados
  en el re-review final.
- La verificación local independiente pasó: 303/303 unit/component, lint, typecheck, Prettier
  focalizado y `git diff --check`. La evidencia previa de integración DEV y baseline exacto se
  conserva; el review no repitió mutaciones remotas. Sin commit, push, PR, merge ni acceso a PROD.

## Remediación del review final y smoke (histórico)

- `Specialty.description` ya se puede crear, editar, limpiar y ver desde la UI mediante las RPCs
  existentes. Se amplió el E2E para edición, nombre inactivo reservado, stale/refresh, denegación
  de membership inactiva y resolución D4 desde Usuarios. No hay migrations nuevas.
- La verificación DEV de la remediación pasó: CLI 2.117.0, 17 migrations locales y remotas
  iguales, dry-run sin pendientes, E2E ampliado 1/1, DB lint sin errores y baseline BEFORE/AFTER
  exacto `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
  Unit/component 308/308, lint, typecheck, build, Prettier, diff check y guard de secretos pasan.
  El smoke manual humano pasó 6/6. El cleanup de sus fixtures está detenido hasta confirmar el
  ownership exacto de dos Specialties y del usuario de prueba inventariados por UUID; en ese
  momento aún no se había restaurado el baseline DEV posterior al smoke. Los dos findings MEDIUM
  seguían abiertos hasta el re-review.
- Mientras se espera esa confirmación, la verificación read-only de CLI 2.117.0 mantiene
  17 migrations locales == 17 DEV y dry-run sin pendientes. No se ejecutó DELETE.
- Luego la persona usuaria confirmó ownership por UUID de las dos Specialties, el Professional y
  el Auth user del smoke. Se eliminaron exclusivamente esas filas y sus relaciones/operación por
  IDs exactos, tras validar el grafo dentro de una transacción serializable. El baseline DEV
  post-cleanup volvió al SHA-256 aprobado
  `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a`.
  CLI 2.117.0 confirmó 17 migrations locales == 17 DEV y dry-run sin pendientes tras reintentar
  un timeout de conexión aislado. PROD no se consultó ni modificó. Posteriormente el re-review
  independiente cerró FINAL-R1 y FINAL-R2; `review.md` conserva los findings como historial.

## Completado

- Definición de producto y alcance MVP.
- Reglas principales de negocio.
- Stack y arquitectura general.
- Estrategia de seguridad, RLS, testing y observabilidad inicial.
- Estrategia de migrations, zonas horarias, tooling, naming y seeds.
- Harness v1 diseñado.
- Scaffold inicial del repositorio materializado.
- Documentación consolidada dentro de `docs/`.
- Documentación técnica modularizada en `docs/decisions/` y `docs/stack/` para facilitar el context routing.
- Repositorio público de GitHub creado y remoto confirmado.
- Node.js 24 y pnpm 11.26.0 validados en runtime.
- Dependencias instaladas y lockfile congelado verificado.
- Bootstrap, formato, lint, tipos, tests y build verificados.
- TASK-001 aceptada con Review PASS y archivada.
- TASK-002 validó React Big Calendar con mock data determinista en las vistas Día, Semana y Mes,
  incluidas verificaciones visuales a 375 px, 768 px y 1280 px.
- React Big Calendar adoptado como librería base de la agenda para el MVP, con enfoque
  desktop-first y limitaciones responsive/de simultaneidad aceptadas.
- TASK-002 aceptada con Review PASS, decisión humana registrada y archivada.
- TASK-003 configuró el contrato mínimo de entorno, clientes Supabase browser/server no privilegiados,
  health check DEV, tipos generados desde `public` y guía reproducible. Fue aceptada con Review PASS
  funcional, Security y Database y archivada sin crear schema, migrations, Auth, RLS ni datos.
- TASK-004 implementó en Supabase DEV el esquema inicial aprobado mediante migrations SQL
  versionadas: once tablas, integridad multi-centro, normalización documental PostgreSQL,
  exclusion constraints GiST, triggers técnicos y RLS default-deny.
- La suite SQL transaccional, la prueba real de concurrencia, lint/advisor de seguridad y la
  regeneración de tipos desde DEV pasaron; no quedaron datos de prueba persistentes.
- Las tres migrations de TASK-004 están aplicadas y sincronizadas con Supabase DEV; los tipos
  TypeScript generados reflejan las once tablas, enums, relaciones y nulabilidad del schema real.
- TASK-004 dejó inicialmente RLS default-deny en las once tablas, sin policies permisivas ni grants
  de dominio; TASK-005 Fase A abrió después sólo las seis lecturas aprobadas para `authenticated`.
- TASK-004 obtuvo Review PASS independiente de Database/RLS y Security y fue cerrada y archivada.
- TASK-005 completó y obtuvo aprobación humana de su diseño de Auth, secret key moderna, email
  proyectado, autorización tenant, PLATFORM_ADMIN global, `/platform`, bootstrap excepcional, RLS,
  grants, RPCs y pruebas.
- TASK-005 Fase A aplicó exclusivamente en Supabase DEV seis migrations incrementales con email
  proyectado, `platform_admins`, helpers anti-recursión, seis policies SELECT, grants mínimos y RPCs
  estrechas. DB lint y la suite transaccional de catálogo/RLS/grants pasan.
- La infraestructura local incluye cliente Admin `server-only`, refresh SSR, guards de autorización,
  orquestación con compensación, tooling one-shot y suites para Auth/RLS/concurrencia.
- La configuración Auth DEV efectiva fue verificada: signup público OFF, contraseña mínima 10 sin
  composición, Site URL `http://localhost:3000` y redirects de callback/recovery exactos.
- La suite Auth/RLS foundation pasó con concurrencia real y cleanup verificado: cero fixtures de
  dominio, cero usuarios Auth temporales y ningún PLATFORM_ADMIN persistente.
- La remediación de review agregó idempotencia por `operation_id`, reconciliación antes de compensar
  y pruebas reales de response-loss/retry/concurrencia sin ampliar RLS tenant.
- TASK-005A obtuvo `TASK-005A REVIEW PASS`; ambos findings quedaron cerrados y la Fase A se cerró
  formalmente como checkpoint sin cerrar ni archivar TASK-005.
- TASK-005B1 implementó login/logout, recovery/callback/update password, resolución 0/1/N de
  memberships activas en Centers activos, selector, shell tenant protegido y placeholder temporal
  de PLATFORM_ADMIN. Las pruebas unitarias y 9 E2E DEV pasan con cleanup cero.
- TASK-005B1 obtuvo `TASK-005B1 REVIEW PASS` y se cerró formalmente como checkpoint sin cambios de
  schema, migrations, RLS, grants ni RPCs, y sin cerrar ni archivar TASK-005.
- TASK-005B2 implementó `/platform` funcional para listar Centers con contadores agregados, crear
  Center + primer ADMIN y activar/desactivar Centers, reutilizando exclusivamente la foundation
  aprobada de Fase A.
- TASK-005B2 obtuvo `TASK-005B2 REVIEW PASS`; ambos findings quedaron cerrados y B2 se cerró como
  checkpoint sin cambios de schema, migrations, RLS, grants, RPCs ni tipos generados.
- La remediación del bootstrap agregó una RPC de preflight service-only con respuesta exacta,
  revalidación final de `auth.users`, serialización con lock `SHARE`, y pruebas de
  concurrencia/idempotencia sin ampliar grants de dominio.
- La remediación obtuvo `BOOTSTRAP PREFLIGHT REMEDIATION REVIEW PASS`; BP-F1 y BP-F2 quedaron
  cerrados.
- El bootstrap persistente del primer PLATFORM_ADMIN se ejecutó después de su autorización humana.
  El smoke manual real confirmó login, `/platform`, creación de `Centro Médico Salud Plus`
  reutilizando la identidad existente como primer ADMIN, acceso tenant, refresh, logout y redirect
  directo al único Center activo al volver a iniciar sesión.
- TASK-005B3 completó ANALYZE + PLAN y design review. B3-D1 fue aprobada e implementada con máximo
  una membership PROFESSIONAL activa por ProfessionalCenter, preservando asociaciones inactivas
  históricas cuando el modelo actual lo permite.
- TASK-005B3A implementó en DEV el UNIQUE parcial de ProfessionalCenter activo exclusivo y ajustó
  `admin_provision_center_user`/`admin_set_center_membership` con el lock común por Center,
  validaciones state-aware y postcondición concurrente del último ADMIN. La migration 13, las
  regresiones y el baseline persistente pasan.
- TASK-005B3A obtuvo `TASK-005B3A REVIEW PASS`; el finding medio del harness B2 quedó cerrado tras
  verificar la barrera determinística de cleanup, distinguir HTTP 200 de éxito funcional y
  clasificar el fallo aislado B1 como flake preexistente del harness. En ese checkpoint B3B y UI B3
  todavía no se habían iniciado.
- TASK-005B3B implementó el listado tenant read-only `/centers/[centerId]/users`, protegido por
  ADMIN activo del Center, con tabla de identidad/rol/estado/asociación Professional y navegación
  tenant mínima. Reutiliza SELECT + RLS/grants existentes, sin migrations, RPCs, DML ni ampliación de
  permisos. Unit/component, E2E B3B y regresiones B1/B2/B3A pasan con baseline DEV intacto.
- TASK-005B3B obtuvo `TASK-005B3B REVIEW PASS` y se cerró formalmente como checkpoint.
- TASK-005B3C implementó el alta tenant staged por email exacto, reutilización segura de identidad,
  creación de identidad nueva mediante el provisioning reconciliable existente y membership inicial
  `ADMIN`, `RECEPTION` o `PROFESSIONAL`. Conserva un `operation_id` recuperable sin persistir el
  password, bloquea Professional sin ProfessionalCenter elegible y no edita/reactiva memberships.
  No requirió migrations, schema, RLS, grants ni RPCs nuevas. El finding B3C-R1 quedó corregido:
  cada intento limpia el
  password del FormData, DOM y estado React al finalizar, preservando sólo la intención no secreta
  y el mismo operation ID para reconciliación.
- TASK-005B3C obtuvo `TASK-005B3C REVIEW PASS`; B3C-R1 quedó `CLOSED` y B3C se cerró formalmente
  como checkpoint.
- TASK-005B3D implementó administración de memberships existentes en
  `/centers/[centerId]/users`: cambio entre ADMIN/RECEPTION/PROFESSIONAL, activación/desactivación
  lógica y selección/reasignación de ProfessionalCenter, con confirmación explícita y refresh desde
  servidor. Reutiliza `admin_set_center_membership`, reautoriza ADMIN tenant, verifica pertenencia al
  Center y detecta snapshots stale sin reemplazar la autoridad concurrente de DB.
- B3D preserva último ADMIN y self-admin, distingue desactivación pura PROFESSIONAL con vínculo
  inactivo de reactivación/cambio, y no modifica identidad global, otros Centers ni PLATFORM_ADMIN.
  Unit/component 168/168 y E2E B3D 6/6 pasan; B3C/B3B/B3A/Auth/provisioning/schema/B1/B2 y cleanup
  permanecen en PASS con baseline DEV idéntico y 14 migrations sincronizadas.
- TASK-005B3D obtuvo `TASK-005B3D REVIEW PASS`; B3D-R1 quedó `CLOSED` y B3D se cerró formalmente
  como checkpoint. No se inició ninguna subfase adicional.
- El smoke manual B3B pasó: listado ADMIN y navegación Center ↔ Users verificados.
- El smoke manual B3C pasó: nueva identidad RECEPTION, login real, `/users` denegado para RECEPTION,
  `/platform` denegado/redirigido, duplicate membership detectada y PROFESSIONAL bloqueado sin
  ProfessionalCenter; cleanup exacto y baseline restaurado.
- El smoke manual B3D pasó: protección visible del último ADMIN, PROFESSIONAL bloqueado sin
  ProfessionalCenter, transiciones RECEPTION → ADMIN y ADMIN → RECEPTION, Active → Inactive e
  Inactive → Active, `/users` denegado para RECEPTION y permitido para ADMIN; cleanup exacto y
  baseline restaurado.
- El re-review integral independiente cerró `IR-1`, `IR-2` e `IR-3`: lifecycle del password B2,
  cleanup exacto B1 y evidencia manual quedaron verificados sin regresiones nuevas.
- PR #4 se integró mediante squash merge en `main`. El commit
  `374f039a3a11ecb696a7f764a948bbf9a75996aa` conserva exactamente el árbol del HEAD aprobado
  `0effea6885f8b76659a5fa7163e2cfee68f6af5c` y no incluye `next-env.d.ts`.
- TASK-005 y sus checkpoints B3B/B3C/B3D quedaron cerrados y archivados en el Harness.

## Próximo

TASK-021 no tiene requisitos del MVP pendientes dentro de su alcance. Las alertas operativas y el onboarding requieren definición y tareas separadas. El gap histórico `72e4ff...` → `86b6cd...` permanece **E — insufficient evidence**, sin reconciliación retrospectiva. Los controles de inferencia/abuso siguen pendientes PRE-PROD; PROD y su despliegue requieren autorización separada.

## Estado operativo al cierre de TASK-005 (histórico)

- TASK-005 Fase A: `TASK-005A COMPLETED`; B1: `TASK-005B1 COMPLETED`; B2:
  `TASK-005B2 COMPLETED`; remediación de preflight: `COMPLETED`; B3:
  `TASK-005B3A COMPLETED`; B3B/B3C/B3D: `COMPLETED / REVIEW PASS`; B3C-R1 y B3D-R1: `CLOSED`.
- Integration Review: `PASS`; `IR-1 = CLOSED`, `IR-2 = CLOSED`, `IR-3 = CLOSED`.
- PR #4: `MERGED` mediante squash; `main` remoto y local quedaron en
  `374f039a3a11ecb696a7f764a948bbf9a75996aa` al momento del cierre.
- Los artefactos de TASK-005, TASK-005B3B, TASK-005B3C y TASK-005B3D están archivados bajo
  `.harness/tasks/archive/`.
- El Reviewer verificó que B2 limpia password de estado/DOM/FormData en todos los resultados y
  conserva el mismo operation ID; B1 usa ownership/cleanup exclusivo por UUID y baseline
  fail-closed; la evidencia manual B3B/B3C/B3D quedó persistida en el Harness.
- `pnpm bootstrap` y health check DEV: PASS.
- Supabase DEV: `ehllxymqyzrofydrvtzo` (`sa-east-1`). Las once migrations de TASK-005 están
  sincronizadas local/remoto; las tres de TASK-004 permanecen inmutables (catorce versiones totales).
- DB lint: cero resultados. Advisors de seguridad: siete advertencias esperadas por RPCs
  `SECURITY DEFINER` autenticadas más el warning Auth conocido de leaked-password protection; cero
  ERROR y sin nueva superficie pública.
- Suites B3A, schema/concurrencia, catálogo/RLS/grants y Auth foundation: PASS; tipos regenerados
  desde DEV sin drift.
- La existencia de `SUPABASE_SECRET_KEY` moderna se verificó sin exponerla; `.env.local` está ignorado
  y no versionado. La configuración Auth Dashboard fue confirmada mediante comportamiento efectivo.
- Baseline DEV persistente auditado read-only: 1 `auth.users`, 1 `public.users`, 1
  `platform_admins`, 1 Center activo, 1 membership ADMIN activa, 0 Professional, 0
  ProfessionalCenter y 0 Specialty. El User posee, de forma independiente, PLATFORM_ADMIN global y
  ADMIN tenant.
- B3C no cambió DB en su checkpoint; el estado actual conserva catorce migrations locales/DEV
  sincronizadas. Su E2E usa UUIDs propios y
  cleanup exacto por IDs, sin `LIKE` ni prefijos amplios, y reconfirmó el baseline persistente
  idéntico antes/después. B3B/B3A/Auth/provisioning/B1/B2 permanecen en PASS.
- B3D-R1 requirió la migration incremental `20260928120000_make_membership_stale_check_atomic.sql`:
  la única firma de `admin_set_center_membership` recibe expected role/estado/PC y compara el snapshot
  bajo advisory lock + row lock antes de mutar. La firma legacy quedó eliminada. El harness DB probó
  la carrera stale real, además de último ADMIN y PC único; E2E usa UUIDs propios, cleanup exacto y no
  muta el usuario persistente.
- Center persistente: `Centro Médico Salud Plus`
  (`76dcbe41-38be-475d-a590-f4ae6619c1e8`, `America/Argentina/Buenos_Aires`).
- `private.provisioning_operations` conserva dos operaciones reales `SUCCEEDED`: bootstrap
  `352a309e-f137-488e-b6e7-4b53e2cdb7b2` y creación de Center
  `964ec4bf-eeba-4f4f-914a-d2a8ca101934`. Esta última reutilizó la identidad; no creó otra.
- Cero Auth users con namespaces temporales conocidos de TASK-005. Los datos anteriores son
  persistentes de desarrollo y no deben borrarse ni entrar en cleanup de tests.
- PROD permaneció fuera de alcance durante implementación, review, merge y cierre documental.

## Decisiones aprobadas de TASK-005

- `SUPABASE_SECRET_KEY` moderna, server-only y limitada a Auth Admin/compensación/bootstrap.
- `public.users.email` como proyección lowercase, no nula y única; cambio de email fuera de alcance.
- Centro activo por `/centers/[centerId]/...`, sin preferencia persistida.
- `platform_admins` global separado de `membership_role` y sin bypass tenant.
- Bootstrap one-shot únicamente para el primer PLATFORM_ADMIN.
- `/platform` como mecanismo funcional para crear/activar/desactivar Centers y primer ADMIN.
- RPCs administrativas estrechas, seis policies SELECT y grants mínimos.
- Todo Center activo conserva al menos un ADMIN activo con enforcement concurrentemente seguro.
- Recovery DEV con SMTP de desarrollo y redirects explícitos; custom SMTP obligatorio antes de PROD.
- B3-D1 aprobada: un ProfessionalCenter admite como máximo una membership PROFESSIONAL activa. La
  autoridad es un UNIQUE parcial, reforzado por RPCs y el lock común del Center. No se modelan
  cuentas compartidas/delegadas ni quedan decisiones humanas abiertas en B3.

## Decisiones postergadas

- Email/recovery provider definitivo.
- Control concreto de abuso/rate limiting y monitoreo antes de producción pública, incluido el resolve exacto de Person y el create/error de identidad existente de TASK-007.
- Playwright completo en CI cuando E2E tenga entorno aislado.
- Sentry si el producto llega a necesitarlo.

## Pendientes pre-PROD

- Custom SMTP para recuperación/email.
- Control definitivo de abuso/rate limiting y monitoreo del resolve exacto de Person **y** create/error de identidad existente antes de exposición pública. Riesgo residual de inferencia global `ACCEPTED RISK` sólo para MVP DEV; no se implementa rate limiting en TASK-007.
- Revisar y remediar mediante una tarea de seguridad independiente el contrato de resolve de Pacientes: puede devolver `FOUND` y nombres al cliente autorizado con fecha de nacimiento discordante. La advertencia neutral de TASK-028 no elimina la exposición en la respuesta de red. No utilizar datos personales reales en producción antes de resolver este pendiente.
- Leaked-password protection de Auth.

Estos puntos continúan separados de los findings DEV del Integration Review y no se clasifican como
defectos de la remediación IR-1/IR-2/IR-3.
