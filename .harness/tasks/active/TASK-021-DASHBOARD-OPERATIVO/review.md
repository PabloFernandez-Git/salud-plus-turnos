# TASK-021 — Revisión independiente focal de la especificación

**Fecha:** 2026-10-22
**Alcance:** `brief.md` y `contract.md`, contrastados con las decisiones aprobadas, los
listados/RPC actuales y las reglas de acceso del Center. Revisión documental, sin ejecutar
SQL, tests, servidor ni conexiones DEV/PROD.

## Hallazgos y resolución

1. **P2, cerrado:** Los conteos y profesionales distintos debían nacer de
   `appointments` filtrada, sin joins de presentación ni filtros `is_active` sobre
   entidades relacionadas. `contract.md` ahora lo exige; los joins sólo enriquecen los
   cinco próximos y no eliminan turnos por desactivación histórica.
2. **P2, cerrado:** La autorización y la lectura debían compartir una fotografía para
   evitar una ventana entre guard y datos. `contract.md` ahora exige snapshot MVCC común,
   diseño `STABLE` con sentencia autorizada y descarta SELECT separados en una función
   `VOLATILE` bajo `READ COMMITTED`.

## Dictamen

**PASS para cerrar la especificación funcional y técnica de esta etapa**, sin hallazgos
bloqueantes. Los documentos reflejan las cuatro decisiones aprobadas, los vacíos distintos,
la referencia temporal PostgreSQL única, el alcance por rol y el orden visual. La
proyección profesional permanece mínima y la navegación existente se conserva.

El PASS es documental: no aprueba crear la migration ni afirma rendimiento o seguridad
verificados en una base real. El futuro gate deberá revisar planes con volumen, bordes de
medianoche/DST, concurrencia y grants/revocación de `EXECUTE` de cada nueva RPC.

## Revisión independiente Next.js/UI (2026-10-22)

Gate C: **PASS local**, después de corregir dos hallazgos P2:

1. La Server Action distinguía inicialmente denegación de membresía y error interno de consulta con el mismo estado. Ahora devuelve `denied` para `AuthorizationError` y `error` para fallos internos. El panel limpia cifras y refresca el contexto ante denegación.
2. Una respuesta solicitada antes de medianoche y recibida después podía mostrar el día anterior. Ahora se compara el día civil del centro al iniciar y recibir sólo para disparar una nueva lectura; `as_of` y `local_date` siguen viniendo de PostgreSQL.

La re-review revisó autorización, proyecciones, estados, enlaces y navegación: sin hallazgos materiales restantes. TypeScript PASS. El reviewer no pudo ejecutar Vitest desde su acceso de sólo lectura por EPERM en `.vite-temp`; la suite focal 26/26 PASS fue ejecutada por el implementador. Evidencia y límites en `implementation-report.md`. No hay aprobación para DEV/PROD.
