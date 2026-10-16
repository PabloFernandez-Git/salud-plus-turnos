# TASK-008 — Availability · Implementation report

**Estado:** TASK-008 IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT REVIEW. No PR. No PROD.

## Base y Gate A

- Rama `task/008-availability`; HEAD, `main` y `origin/main` iniciales: `6e5e4f46fe7871966557ee1822ac08e2575ac22b`. `pnpm bootstrap` PASS. `next-env.d.ts` preexistente permaneció `M`, unstaged e intacto; SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. TASK-009–012 no se tocaron.
- DEV aprobado: `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, región `sa-east-1`, link y health correctos. Antes de aplicar: 19/19 migrations, dry-run sin pendientes y `db lint --linked` sin resultados.
- Se comparó el catálogo vivo de `availabilities`, `professional_centers`, `center_memberships`, `centers` y `appointments`: columnas, FK, checks, índices y exclusiones GiST, triggers, RLS/policies, grants y firmas/cuerpos de funciones/RPC. Sin drift inesperado ni grants/policies extra en el contrato. `db diff --from migrations --to linked` mostró sólo ruido de privilegios default del entorno y cuerpos de funciones reemitidos idénticos; ninguna diferencia material de tablas, constraints, índices o policies. No se aplicó reparación del baseline.
- El único valor de `centers.timezone` fue `America/Argentina/Buenos_Aires`; validado contra la base de zonas. La inspección fue read-only y no cambió datos.

## Implementación

- `20261016160000_add_availability_foundation.sql` reemplaza el trigger de `availabilities.updated_at` por el CAS monotónico existente. Añade policy SELECT de franjas activas con alcance tenant, grant SELECT sólo a `authenticated`, contexto mínimo por RPC, helper privado de advertencia read-only y cuatro RPCs de mutación con autorización y locks. Revoca EXECUTE público/anon; no concede DML genérico. La migration no modifica filas previas ni appointments. Fue probada en shadow antes de aplicarse a DEV y luego se aplicó una vez a DEV; no se reescribió.
- Tipos de Supabase regenerados con `pnpm db:types`. `src/modules/availability/` contiene schemas Zod, queries con cliente de sesión, servicios, Server Actions delgadas, mapeo seguro de errores y pantalla responsive. Las rutas son `/centers/[centerId]/availability` y `/centers/[centerId]/professionals/[professionalCenterId]/availability`. La navegación y Profesionales enlazan a Availability según rol.
- La UI muestra siete días y duración habitual del mismo `ProfessionalCenter`, permite franjas contiguas y múltiples, edición inline, confirmación antes de quitar, estados vacíos, foco y feedback. Un stale exige recarga. La advertencia sólo expresa si hay turnos futuros fuera del horario, sin datos de pacientes; no cambia appointments.
- Los SQL tests de Auth/TASK-006B recibieron las expectativas exactas de Availability y las policies/grants de Patients ya versionadas. El test histórico de TASK-007 se acotó a sus 19 versiones para que una migration posterior no cambie su fixture. El runner TASK-006B ahora revierte una transacción abortada antes de cleanup, conservando la auditoría de baseline.

## Evidencia de verificación

- DEV final: 20/20 migrations exactas, `db push --dry-run --linked` sin pendientes, health PASS, `db lint --linked` sin resultados; catálogo de policy/grants/trigger y cinco RPCs públicas verificado por `scripts/verify-task008-availability.mjs`.
- Integración DEV: ADMIN/RECEPTION leen y mutan; PROFESSIONAL sólo lee su vínculo; PLATFORM_ADMIN sin tenant, vínculos/centros/memberships inactivos y cross-center se deniegan. SELECT no incluye inactivas; no hay DML genérico. Varias franjas, adyacencia y días diferentes admitidos; overlap `23P01`, input inválido, stale update/deactivate y duración 5–480/step/no-op probados. Advertencia dentro/fuera/CANCELLED y appointments inalterados. Carreras con espera de lock observable: dos inserts GiST, dos updates de la misma fila y desactivación de ProfessionalCenter frente a create.
- Smoke Playwright contra build de producción aislado: ADMIN navegó índice/detalle y creó, editó, quitó una franja y cambió duración; RECEPTION encontró controles; PROFESSIONAL sólo vio su detalle; PLATFORM_ADMIN sin membership no accedió. A 390 px no hubo scroll horizontal. El build webpack aislado PASS y generó ambas rutas. La copia aislada se eliminó sin tocar `next-env.d.ts`.
- `pnpm check` PASS: lint, typecheck, 492 tests Vitest en 63 archivos y 11 tests `node:test` históricos. `pnpm db:test:auth-foundation:dev` y `pnpm db:test:task006b:dev` PASS; este último conserva digest de baseline `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a` antes/después. Prettier focalizado del código TASK-008 y `git diff --check` PASS; el check de formato global encuentra formato previo en archivos ajenos y no se reformateó el repositorio completo.
- Fixtures Auth y dominio se reservaron por run ID y UUID exactos, con manifiesto local durante cada corrida. Cleanup borró sólo IDs propios, auditó cero residuo y comparó conteos y digests de 13 tablas persistentes antes/después. Los intentos de diagnóstico fallidos también cerraron con cleanup o se recuperaron desde manifiesto; no queda manifiesto activo.

## Riesgos y siguiente gate

- La advertencia habitual no reemplaza reglas de Agenda/slots ni resuelve DST o turnos fuera de horario; TASK-009 deberá definir esos comportamientos. No se reactiva ni lista historia de franjas inactivas.
- Review independiente de implementación pendiente. No cerrar/archivar TASK-008 hasta ese veredicto. No abrir PR en esta fase.
