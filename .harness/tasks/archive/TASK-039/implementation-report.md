# TASK-039 — Fase B: informe de implementación

**Estado:** implementación local completa; pendiente de review independiente y de cualquier autorización posterior para aplicar la migration. Base: `origin/main` `5dde7730e33e7eaf499e177cd658033530882bf0`. Sin commit, push, merge, deploy ni acceso a Supabase remoto. DEV, DEMO, PROD y portfolio intactos.

## Contrato implementado

`staff_resolve_patient_identity` conserva firma, ocho columnas, `SECURITY DEFINER`, `search_path`, guard de ADMIN/RECEPTION del centro activo y grants. Si el documento y nacionalidad encuentran una `Person` pero el nacimiento no coincide, retorna inmediatamente una fila con `identity_status = UNVERIFIED`, `birth_date_matches = false` y `NULL` en `first_name`, `last_name`, `relationship_state`, `person_id`, `patient_center_id` y `patient_center_updated_at`. La consulta de `patient_centers` ocurre sólo después de comprobar la fecha. `NOT_FOUND` y los tres estados `FOUND` verificados conservan su semántica.

La unión Zod rechaza cualquier dato de identidad o vínculo no nulo en `UNVERIFIED`, así como el payload inseguro legacy `FOUND`/DOB falso. Registro mantiene el mensaje neutral y bloquea alta, vínculo y reactivación con `UNVERIFIED`; Administración bloquea la confirmación de reactivación con ese resultado. Los tipos de resultado de servicio y Action se derivan del contrato Zod y no precisaron cambios propios. `database.types.ts` tampoco cambia: firma y columnas SQL son idénticas y la introspección no conserva la nulabilidad condicional.

## Archivos modificados

- `supabase/migrations/20261117124426_protect_unverified_patient_identity.sql`: reemplazo incremental de la RPC, sin tocar migrations históricas.
- `src/modules/patients/api/patient-rpc-contracts.ts` y `.test.ts`: variante `UNVERIFIED` estricta y pruebas de rechazo de los seis campos protegidos y del payload legacy.
- `src/modules/patients/components/patient-workspace.tsx` y `.test.tsx`: bloqueo y advertencia en Registro y Administración; regresiones de flujos verificados.
- `scripts/verify-task039-local.mjs`: replay de 29 migrations en PostgreSQL Docker descartable, comprobación del catálogo, RPC directa, roles y create/link/reactivate, con cleanup de contenedor.
- `scripts/task007-gate-d/integration.mjs`: expectativa actualizada para el contrato nuevo cuando se autorice ejecutar integración contra un entorno actualizado.
- `scripts/task028-patients-visual.mjs`: fixture de mismatch alineada con la respuesta segura; sin cambio visual de producto.
- `docs/modules/patients.md`, `docs/status.md` y `.harness/tasks/archive/TASK-039/{brief,plan,implementation-report}.md`: estado, alcance y riesgo residual. El smoke de TASK-007A conserva su aserción histórica porque reproduce la migration original, no la de TASK-039.

## Verificación

| Gate | Resultado |
| --- | --- |
| RPC directa en PostgreSQL local aislado | `TASK039_LOCAL_RPC_PASS`; 29 migrations reproducidas. `UNVERIFIED` sin datos personales para `Person` sin vínculo, vinculada sólo a otro centro, ACTIVE e INACTIVE en el centro consultado. |
| Catálogo y permisos | OID, firma, ACL, `SECURITY DEFINER` y `search_path` idénticos antes/después de la migration. `authenticated` conserva EXECUTE; `anon` no lo obtiene. ADMIN/RECEPTION activos operan; anon, ADMIN de otro centro, PROFESSIONAL, membership inactiva y PLATFORM_ADMIN sin membership quedan denegados. |
| Flujos DB | `NOT_FOUND` y `FOUND` correctos; create existente no duplica `Person`; create nuevo, link de identidad existente y reactivación con CAS pasan. |
| Vitest focal | 55/55, cuatro archivos: contrato RPC, componente, Actions y servicio. Incluye rechazo Zod de datos en `UNVERIFIED` y bloqueo de reactivación en Administración. |
| TypeScript | `pnpm typecheck` PASS. |
| Lint | `pnpm lint` PASS, cero errores y un warning preexistente en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238` fuera de alcance. |
| Build | `pnpm build` PASS. |
| Formato y diff | Prettier focal y `git diff --check` PASS. |

`pnpm bootstrap` se ejecutó en el worktree, pero su chequeo de configuración falló porque allí no existe `.env.local`; no se copió ningún secreto ni se usó el proyecto remoto. Las dependencias fijadas por lockfile se instalaron sólo en el worktree y los gates de código pasaron. Docker devolvió errores 500 transitorios durante la preparación y la comprobación de cleanup; el run final pasó y una consulta posterior confirmó cero contenedores con la etiqueta de TASK-039.

## Compatibilidad y riesgos residuales

- **Migration nueva + aplicación anterior:** el Zod anterior no admite `UNVERIFIED`; `resolvePatientAction` devuelve un error de validación y el registro con fecha discordante pierde su advertencia específica durante esa ventana. No devuelve los datos protegidos, pero es una incompatibilidad funcional temporal.
- **Aplicación nueva + DB anterior:** el Zod nuevo rechaza el payload antiguo `FOUND`/DOB falso y la Action lo convierte en error; sin embargo, la RPC directa de la DB anterior todavía expone nombres y estado a clientes autenticados autorizados. Por eso el build nuevo por sí solo no remedia el problema. La aplicación y la migration requieren coordinación de despliegue y verificación de la función efectiva antes de declarar la protección operativa.
- La diferencia `NOT_FOUND`/`UNVERIFIED` y el error de identidad existente de `create` siguen permitiendo **inferir existencia**. Este riesgo quedó expresamente fuera de TASK-039 y permanece bloqueo PRE-PROD junto con los controles de abuso/rate limiting/telemetría. La fecha de nacimiento es una señal limitada de verificación.
- Sólo se verificó PostgreSQL local con fixtures sintéticas. No se afirma que DEV, DEMO o PROD ejecuten la nueva función. La revisión independiente de seguridad/DB y cualquier despliegue son fases posteriores.

TASK-039 PHASE B — IMPLEMENTATION COMPLETE
