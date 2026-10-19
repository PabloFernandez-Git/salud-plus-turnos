# Estado actual

**Tarea activa:** TASK-009 — Appointments / Turnos. **GATE B1 IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT SERVER/DOMAIN REVIEW** (2026-10-19). En rama `task/009-appointments`, HEAD y remoto `9ca14e9446e31e30d1279a346602e73b288b4b5a`; `pnpm bootstrap` PASS. Se implementó localmente `src/modules/appointments/`: schemas Zod, adaptadores para las once RPCs aprobadas, lecturas separadas staff/Professional, autorización de sesión, CREATE/RESCHEDULE/STATUS/NOTE, CAS textual exacto, nota `NULL` encapsulada, resultados estables y reconciliación antes de reintentar mutaciones inciertas. Privacidad Professional y contratos se probaron con mocks; la autorización real integrada pertenece a Gate D. `pnpm check` final PASS con 541 Vitest y 11 tooling; lint, typecheck, formato focalizado y diff check separados PASS. DEV permanece en el checkpoint B0 con 22/22 migrations, sin escritura B1; PROD intacto. Sin Gate C, rutas, pantallas, Agenda, stage, commit, push ni PR. `next-env.d.ts` sigue M unstaged con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-010–012 intactos. Ver `.harness/tasks/active/TASK-009/implementation-report.md`.

**Checkpoint B0-R1 previo:** TASK-009 — Appointments / Turnos, Gate B0-R1 remediado; **REMEDIATION COMPLETE — READY FOR INDEPENDENT RE-REVIEW** (2026-10-19). El review B0 conserva `B0-R1 MEDIUM / CHANGES_REQUESTED` hasta el re-review. Rama `task/009-appointments`, HEAD `2ecb4c195a77f5ebe033d11e910d7b062add9811`. Se endureció sólo `scripts/verify-task009-b0-concurrency.mjs`: 11 carreras con PIDs distintos, primera transacción abierta, espera de lock observada en 10 casos y conflicto temprano demostrado en cancel/create; asserts de resultados exactos y estado persistido tras cada carrera. Pasaron también control negativo secuencial y cancelación con ROLLBACK. Shadow PostgreSQL 17.6.1.166 reconstruido con 21 migrations de DEV + B0, tests SQL B0/históricos/A1 runtime, boundedness con 50.000 filas, `plpgsql_check` 8/8 y `pnpm check` (492 Vitest + 11 tooling), lint y typecheck. DEV `salud-plus-turnos-dev` continúa en A2 con 21/21 migrations; B0 local conserva SHA-256 `A3BAB44E0A3054CA49640DE6BD5C9D490D8AD5B302B455AA07F41DA237C2E677` y **no se aplicó a DEV/PROD**. Sin Gate B1, Server Actions, frontend, Agenda, stage, commit, push ni PR. `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; TASK-010–012 intactos. Evidencia detallada en `.harness/tasks/active/TASK-009/implementation-report.md`.

**Checkpoint A2 previo:** TASK-009 — Appointments / Turnos, `GATE A2 COMPLETE — DB FOUNDATION VERIFIED ON DEV` (2026-10-19). El re-review independiente cerró R1, R2 y A1-SQL-01; Gate A1 SQL/security pasó. Se revalidó `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`, `sa-east-1`, PostgreSQL 17.6), 20/20 migrations previas y dry-run con sólo `20261016190000_add_appointment_foundation.sql`. La migration aprobada SHA-256 `7533F658093ED9F0D5CC689A847028C195842A29D7CC007026FE782CF1C98D45` se aplicó una vez a DEV; después 21/21, sin pendientes, health y DB lint PASS. Catálogo real PASS: siete RPCs, cuatro helpers privados, grants/RLS, trigger CAS, GiST y ambas cotas UTC A1-SQL-01. Matriz SQL DEV de roles, privacidad, historia inactiva, slots y DST PASS con rollback e inventario de 11 tablas idéntico. Tipos TypeScript regenerados desde DEV; `pnpm check` (492 Vitest y 11 tests tooling), lint, typecheck y formato focalizado PASS. La regresión de 50.000 filas y seis planes pertenece al shadow aprobado de Gate A1; `supabase db start` no tiene PASS por la diferencia de imagen `.166/.167`. PROD fuera de alcance. TASK-009 sigue activa, sin Gate B/C/D ni Agenda; próximo Gate B por instrucción separada. Ver `.harness/tasks/active/TASK-009/implementation-report.md`. `next-env.d.ts` ajeno permanece M unstaged con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.

**Última tarea cerrada:** TASK-008 — Availability / Disponibilidad de profesionales. `MERGED / ARCHIVED`; TASK008-IR-01 y TASK008-IR-02 `CLOSED`. PR #11 integrado en `main` mediante squash merge `c2857308ebf144fd69020636f8021ece4eb258cd`, con CI y final merge review PASS. Contrato, plan, reviews, evidencia y retrospectiva en `.harness/tasks/archive/TASK-008/`. Migration `20261016160000_add_availability_foundation.sql` aplicada sólo a DEV; PROD fuera de alcance. El estado de TASK-007 descrito debajo es histórico.

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

TASK-007 está cerrada y archivada tras el merge del PR #8. Próximo paso: merge del PR documental `task/007-post-merge-archive` hacia `main`. El gap histórico `72e4ff...` → `86b6cd...` permanece **E — insufficient evidence**, sin reconciliación retrospectiva. Los controles de inferencia/abuso siguen pendientes PRE-PROD; PROD fuera de alcance.

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
- Leaked-password protection de Auth.

Estos puntos continúan separados de los findings DEV del Integration Review y no se clasifican como
defectos de la remediación IR-1/IR-2/IR-3.
