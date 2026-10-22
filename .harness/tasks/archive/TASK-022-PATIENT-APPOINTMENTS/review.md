# Review independiente — TASK-022

## Veredicto

**PASS condicionado del diseño; implementación y criterio 13 pendientes (checkpoint histórico).** Revisión focal independiente de `.harness/tasks/archive/TASK-022-PATIENT-APPOINTMENTS/{brief,plan}.md` contra migraciones, servicios y panel existentes. No se revisó SQL nuevo ejecutable porque no existe migration nueva.

## Comprobaciones

- `private.has_active_center_role` requiere membership y Center activos; el plan limita la RPC a ADMIN/RECEPTION y reautoriza antes de leer.
- `appointments` conserva RLS y SELECT revocado a `authenticated`; la FK compuesta y los joins propuestos controlan Center + PatientCenter.
- La proyección excluye `administrative_note` y otros datos personales innecesarios.
- `UPCOMING` e `HISTORY` son complementos disjuntos; una cancelación futura entra en historial.
- `p_as_of` obligatorio y compartido evita que el paso del tiempo cambie el corte entre secciones. Keyset `(starts_at,id)` permite orden estable sobre datos sin cambios; el plan reconoce que no hay snapshot entre solicitudes.
- `centerWallTime` de Agenda muestra `offsetLabel`; la futura UI debe usar un formato con offset para DST.

## Hallazgos/gates

1. **P2 — reinicio del panel:** `PatientWorkspace` usa `detail?.updatedAt` como `key` (`patient-workspace.tsx`, aprox. línea 1132). La carga de turnos deberá usar identidad `(centerId, patientCenterId)` y descartar respuestas tardías, incluso al fallar detalle. Registrado en `plan.md`.
2. **P2 — SQL pendiente:** no hay migration ni RPC nueva para ejecutar pruebas de aislamiento, paginación o planes de índice. Este PASS no valida la implementación; mantener el bloqueo hasta contar con contrato aplicado en un entorno autorizado.

## Cierre del checkpoint de diseño (histórico)

No cerrar TASK-022 todavía. Ejecutar otro review focal de migration, servicio y UI cuando existan, después de pruebas locales y verificación autorizada.

## Checkpoint SQL local — revisión independiente focal

**PASS estático condicionado a ejecución PostgreSQL.** El reviewer inspeccionó `supabase/migrations/20261022120000_add_patient_appointment_history.sql` y `supabase/tests/task-022-patient-appointment-history.sql` contra esquema, migraciones y permisos previos. No encontró defectos bloqueantes de autorización, aislamiento, proyección, clasificación, cursor, joins ni grants.

- `SECURITY DEFINER SET search_path = ''` usa nombres calificados y reautoriza con `auth.uid()` + `private.has_active_center_role` antes de leer PatientCenter. `EXECUTE` queda sólo en `authenticated`; SELECT directo y RLS de appointments no cambian.
- El ID ajeno/inexistente devuelve vacío después del guard de rol. Los joins de profesional/especialidad conservan nombres inactivos y se acotan al Center de la fila.
- Ambas direcciones de keyset usan `(starts_at,id)` y `p_as_of` obligatorio. La CTE limita primero las filas de appointments; el índice nuevo respalda el desempate. Queda pendiente medir planes y decidir si retirar el índice anterior.
- El reviewer detectó inicialmente falta de recorrido del cursor UPCOMING y de pruebas de `infinity`. Se agregaron estos casos y revisó **sólo el delta**: PASS estático; hallazgos P2/P3 resueltos.

**Límite de aquel dictamen estático:** entonces no se habían ejecutado migration, pruebas SQL ni `EXPLAIN`. Docker Desktop no iniciaba y no había `psql` local. El gate de ejecución posterior consta abajo. DEV sigue requiriendo autorización específica.

## Re-review independiente del SQL ejecutado (2026-10-22)

**PASS de ejecución PostgreSQL local.** El reviewer focal cotejó las huellas SHA-256 de la migration (`A846341BD7C252EA782F20793F943EBBEE1010D0A2C64B21BCAF3C782137A6B3`) y la prueba (`BD979AE14FBCDF805931F1A6B812C758DBAFBFC3483430C2CB2070936AF439CC`) con los archivos ejecutados. Revisó la RPC, el helper de roles, la prueba transaccional y la evidencia de catálogo y planes. No encontró defectos materiales bloqueantes.

- La autorización comprueba `auth.uid()` y membership/Center activos ADMIN/RECEPTION antes de leer PatientCenter. El vínculo y los joins mantienen aislamiento por Center, la proyección fija tiene ocho columnas y EXECUTE se limita a `authenticated`; RLS y la revocación de SELECT directo persisten.
- La prueba ejecutada cubre denegaciones, centro/paciente ajeno, IDs inexistentes, paciente y relaciones inactivas, paginación ASC/DESC con empates y `has_more`, clasificación temporal, DST y entradas inválidas. Terminó en `ROLLBACK`; los inventarios posteriores dieron cero fixtures.
- Los cuatro `EXPLAIN` miden SELECTs internos equivalentes a la CTE `page`, **no** el costo completo de la RPC. El índice nuevo aparece en HISTORY y UPCOMING con cursor; UPCOMING inicial escogió `appointments_center_starts_at_idx`. Conviene conservar el nuevo y el previo mientras no haya planes de carga real DEV. Su uso local muestra utilidad, no necesidad universal ni rendimiento DEV.

**Límite:** este PASS acredita el SQL ejecutado en PostgreSQL Supabase local con fixtures sintéticos. No acredita aplicación o carga DEV, integración de UI ni criterio 13 completo. El PASS estático anterior queda como antecedente, no como sustituto de esta ejecución.

## Revisión independiente focal de integración local (2026-10-22)

**PASS de seguridad, comportamiento y presentación del código.** El reviewer verificó reautorización ADMIN/RECEPTION en el servicio antes de RPC, defensa adicional de PostgreSQL, contrato `z.strictObject` de ocho columnas, ausencia de `service_role` y SELECT directo, un `asOf` compartido, cursor `(starts_at,id)`, reinicio por Center/PatientCenter y descarte de respuestas tardías. Confirmó errores y reintentos independientes por sección, offset DST visible y enlace al detalle que reautoriza. Sus observaciones sobre fallo parcial inicial y texto de error se corrigieron antes del dictamen.

El reviewer ejecutó Vitest focal 33/33, TypeScript y `git diff --check`: PASS. La inspección visual real en Chromium a 1440/390 px fue realizada por el implementador con fixture local aislado; no forma parte del review independiente. Este dictamen no constituye prueba funcional remota con fixtures ni acceso directo a DEV.
