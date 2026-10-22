# PR propuesto — TASK-022

## Título

`feat(patients): mostrar próximos turnos e historial en la ficha (TASK-022)`

## Descripción

### Qué cambia

- Agrega la RPC de lectura `staff_list_patient_appointments` con proyección
  mínima de ocho columnas, autorización ADMIN/RECEPTION en PostgreSQL,
  aislamiento Center/PatientCenter, clasificación temporal y paginación por
  `(starts_at,id)`. Conserva el índice anterior y agrega el índice compuesto
  aprobado.
- Integra Próximos turnos e Historial en el modal `PatientWorkspace`, con un
  `asOf` común por lectura, horarios en la zona IANA del centro con offset DST,
  carga incremental, errores/vacíos y enlace al detalle autorizado.
- Completa los ajustes de usabilidad aprobados para Pacientes y la alineación
  del guion sin profesional asociado en Gestión de usuarios.
- Incluye pruebas SQL transaccionales, pruebas locales de contrato/servicio/UI,
  escenario Chromium autenticado y procedimientos reproducibles de validación
  y cleanup DEV.

### Evidencia

- PostgreSQL Supabase local: migration y prueba SQL PASS; rollback sin
  residuos; EXPLAIN focal revisado independientemente.
- DEV estructural: 24 migrations con TASK-022 aplicada, según la ejecución
  controlada confirmada por la persona usuaria.
- DEV funcional: checks RPC reales del run
  `5597e6db-ddfb-43fa-8b99-5a8406a6ab16` PASS; tres escenarios Chromium
  aprobados en ese run según su salida informada. El escenario de cuatro
  actores cerró PASS en el run `9b581bb1-e2be-44e4-b33d-77efbc594982`.
  El ledger de cierre registra `residue=0`, 4 Auth ausentes, UUIDs y
  relaciones ausentes e inventarios idénticos en 14 recursos.
- Pruebas locales focales y revisión independiente de seguridad,
  comportamiento y presentación: PASS. Las capturas sintéticas desktop y
  mobile están en `artifacts/task022-patient-history/`.

### Alcance operativo

La migration ya fue aplicada en DEV bajo autorización separada. Este PR no
autoriza ni ejecuta aplicación en PROD. No se incluyen credenciales, JWT,
fixtures remotos, ledgers ni reportes operativos crudos.

## Checklist propuesto

- [x] RPC, guard de servidor y proyección mínima revisados.
- [x] Autorización y aislamiento verificados con sesiones reales en DEV.
- [x] Paginación, clasificación, DST, vacíos, errores y respuestas tardías
      verificados en sus gates correspondientes.
- [x] Chromium autenticado: escenarios aprobados y cuatro actores del gate
      focal PASS.
- [x] Cleanup por UUID/identidad y comparación de 14 recursos PASS.
- [x] Revisión independiente focal PASS.
- [x] Revisar el diff seleccionado antes de crear commit/PR.
- [ ] Decidir despliegue o aplicación fuera de DEV mediante autorización
      separada.

## Archivos a incluir al preparar el PR

- Producto y pruebas: `src/app/centers/[centerId]/patients/page.tsx` y su
  prueba; `src/modules/patients/actions/patient-appointment-actions.ts`;
  `src/modules/patients/api/patient-appointment-rpc.ts` y su prueba;
  `src/modules/patients/server/patient-appointments.ts` y su prueba;
  `src/modules/patients/components/patient-appointments.tsx` y su prueba;
  `patient-workspace.tsx`, `patients-screen.tsx` y sus pruebas; el ajuste
  aprobado de `src/modules/access/components/center-users-table.tsx` y su
  prueba.
- Base de datos: `supabase/migrations/20261022120000_add_patient_appointment_history.sql`
  y `supabase/tests/task-022-patient-appointment-history.sql`.
- Validación reproducible: `tests/e2e/task-022-functional-dev.spec.mjs`,
  `playwright.task022.config.ts`, `scripts/task022-dev/`,
  `scripts/task022-functional-dev/` y
  `scripts/task022-patient-history-visual.mjs`.
- Documentación y evidencia curada: `.gitignore`, `docs/status.md`,
  `docs/modules/access.md`, `docs/modules/appointments.md`,
  `docs/modules/patients.md`,
  `.harness/tasks/active/TASK-022-PATIENT-APPOINTMENTS/` y
  `artifacts/task022-patient-history/`.

## Excluir expresamente

- `.task022-functional-dev/`: planes, ledgers, reportes, errores y resultados
  operativos locales. Está ignorado por Git y se conserva para auditoría local.
- `.env.local`, `.env*`, certificados, contraseñas, claves y JWT.
- `next-env.d.ts` y cualquier otro cambio preexistente ajeno a TASK-022.
- `artifacts/` de otras tareas, archivos de TASK-021 y expedientes de
  TASK-019/TASK-020 u otros trabajos paralelos.

El estado de Git y del PR se informa por separado; este borrador fija el alcance y la evidencia.
