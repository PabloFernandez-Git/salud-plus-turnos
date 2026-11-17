# TASK-039 — Cierre de seguridad y privacidad de pacientes

**Estado:** integración y cierre autorizados tras aprobación de fases A, B, C y D. El cierre `CLOSED / MERGED / ARCHIVED` se hace efectivo al fusionar por squash el PR de TASK-039 con CI exitoso. Fecha: 2026-11-17.

## Alcance resuelto

La migration incremental `20261117124426_protect_unverified_patient_identity.sql` hace que `staff_resolve_patient_identity` devuelva `UNVERIFIED`, `birth_date_matches=false` y `NULL` en nombres, apellidos, identificadores y estado del vínculo ante nacimiento discordante. La función retorna antes de consultar el vínculo con el centro. Conserva firma, grants y autorizaciones. Zod rechaza datos personales en `UNVERIFIED`; Registro y Administración mantienen el mensaje neutral y bloquean mutaciones con identidad no verificada. Permanecen los flujos legítimos de alta, deduplicación, vinculación y reactivación.

## Evidencia y fases

- [Brief](brief.md) y [plan](plan.md): diagnóstico, alcance y criterios de aceptación. La persona usuaria aprobó Fase A y autorizó la implementación acotada de Fase B.
- [Informe de implementación](implementation-report.md): PostgreSQL local descartable, contratos, pruebas focales, TypeScript, lint y build pasaron. Fase B quedó completa.
- [Registro de revisión](review.md): la revisión técnica independiente de Fase C fue `APPROVED`, sin hallazgos bloqueantes, según la aprobación de la persona usuaria.
- [Validación DEV](dev-validation-report.md): sólo la migration aprobada se aplicó a DEV; paridad final 29/29, sin pendientes. Sesiones Auth ficticias confirmaron privacidad, permisos, aislamiento y flujos create/link/reactivate. Registro y Administración pasaron en localhost. Cleanup por IDs exactos dejó residuo cero.
- La persona usuaria aprobó las fases A–D y autorizó commit, push, PR, verificación de CI y squash merge sujeto a CI y ausencia de bloqueos.

## Integración

El [PR #52](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/52) integra la corrección y este expediente hacia `main`. El squash merge queda condicionado a CI exitoso, ausencia de conflictos y de hallazgos bloqueantes. DEMO, PROD y portfolio no se modifican en este cierre.

## Riesgos residuales

La diferencia `NOT_FOUND`/`UNVERIFIED` de `resolve` y el error de identidad existente de `create` permiten **inferir existencia**. Ese riesgo es un bloqueo PRE-PROD independiente; TASK-039 sólo elimina la exposición directa de datos personales ante fecha discordante. DEV tiene la migration; DEMO y PROD requieren autorización separada para cualquier aplicación. Una app anterior con la migration nueva rechaza `UNVERIFIED` por Zod y degrada UX; una app nueva contra DB anterior rechaza el payload legacy en la Action, mientras la RPC directa todavía expone datos. La coordinación de versión de DB y app sigue siendo necesaria en cada entorno.
