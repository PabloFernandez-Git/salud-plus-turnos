# TASK-028 — Cierre documental

**Fecha:** 2026-10-26

**Estado:** `CLOSED / ARCHIVED` propuesto en esta rama documental; pendiente de integración del PR de cierre.

## Resultado integrado

El [PR #34](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/34) fue fusionado en `main` mediante el squash `971e6553172cb368daef6a92fe049d2a32441927`. GitHub confirmó `merged=true`, base `main` y [CI de implementación](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40366070407) `success`. Esta rama documental parte de ese `origin/main`; su cierre todavía requiere revisión y merge propios.

Registro se cierra tras crear o vincular, vuelve al listado sin abrir automáticamente Administración, refresca los resultados conservando filtros y muestra mensajes distintos para creación y vínculo. El flujo iniciado desde Crear turno conserva su destino. Nacionalidad muestra nombres legibles y mantiene códigos ISO alpha-2 internamente. Los campos siguen las validaciones de Salud Plus y el patrón compartido de errores accesibles. Nacimiento admite `DD/MM/AAAA` con separadores automáticos y conserva la conversión y validación civil antes de llamar las Actions.

La etapa de revisión presenta identidad y datos administrativos antes de confirmar, diferencia creación de vínculo y permite «Corregir datos» sin perder el borrador. En Administración, Guardar cambios sólo se habilita con modificaciones válidas; los errores conservan las entradas. Continúan la confirmación de descarte, las pestañas Datos del paciente y Turnos, el historial y las acciones existentes. En móvil, el listado usa tarjetas y el formulario se adapta; el encabezado del modal permanece visible durante el desplazamiento. Las comprobaciones sintéticas a 390, 556 y 1440 px no detectaron desbordamiento horizontal.

Los cuatro archivos originales del expediente se conservan íntegros: [brief.md](brief.md), [plan.md](plan.md), [implementation-report.md](implementation-report.md) y [review.md](review.md). La [revisión documental](closure-review.md) verifica sus Git blob SHA.

## Evidencia y límites

- [PR #34](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/34): `merged`; CI de GitHub Actions `success`. La descripción del PR registra `pnpm check` con 824/824 Vitest, 31/31 pruebas de tooling, TypeScript y ESLint PASS; Prettier focal PASS. El [informe de implementación](implementation-report.md) y el [review independiente](review.md) registran 167/167 pruebas finales de Pacientes y review PASS.
- Las pruebas automatizadas de Pacientes y la fixture Chromium usaron mocks y datos sintéticos. Chromium se comprobó a 390/556/1440 px. La revisión visual manual de la persona usuaria en `localhost:3000` fue aprobada en escritorio y móvil de 390 px; es evidencia distinta de la fixture.
- No hay evidencia de prueba de integración real contra Supabase DEV/PROD para TASK-028. No se repitieron comprobaciones remotas durante este cierre. Los resultados locales no acreditan el estado de PostgreSQL desplegado.

## Riesgo de privacidad abierto antes de producción

El contrato preexistente de resolución de identidad puede devolver `FOUND` y nombres al cliente autorizado aunque la fecha de nacimiento no coincida. La advertencia neutral aprobada evita mostrar la existencia de esa identidad en la interfaz, pero **no elimina su exposición potencial en el payload de red** ni remedia el contrato. El riesgo de inferencia continúa pendiente. Requiere una tarea independiente de seguridad antes de utilizar datos personales reales en producción; el cierre funcional de TASK-028 no autoriza ese tratamiento. Consta también en [docs/status.md](../../../../docs/status.md) y [docs/modules/patients.md](../../../../docs/modules/patients.md). No se creó una tarea numerada ni un Issue.

Este PR documental no cambia el módulo Pacientes, Actions, RPC, RLS, migraciones ni código funcional. No se accedió a Supabase, no se desplegó y no se intervino el servidor local. El merge del PR documental queda pendiente de aprobación humana.
