# TASK-005 — Remediación del Integration Review

**Fecha:** 2026-09-28

**Baseline:** `fc234d2976ba443334c5b96c894e07140265f176`

**Veredicto vigente del Reviewer:** `TASK-005 INTEGRATION REVIEW PASS` · `TASK-005 READY FOR PR`

**Estado de la tarea:** activa; lista para PR; no cerrada ni archivada; PR no abierto.

Este artefacto registra la remediación del Implementer por separado. No modifica ni reemplaza la
evidencia histórica del Reviewer y no marca los findings como cerrados; ese dictamen corresponde al
re-review.

## Findings recibidos

1. `IR-1 — MEDIUM — CLOSED` — B2 retiene password después del intento.
2. `IR-2 — MEDIUM — CLOSED` — B1 E2E cleanup usa `LIKE`/prefijo global.
3. `IR-3 — LOW — CLOSED` — documentación de smoke tests desactualizada.

El resto del Integration Review pasó.

## IR-1 — lifecycle del password B2

`CreateCenterPanel` aplica el mismo lifecycle aprobado en B3C:

- antes del submit, `adminInitialPassword` existe únicamente en el estado controlado y el input;
- el wrapper de la Server Action lo mantiene en `FormData` sólo durante la llamada;
- `finally` elimina `adminInitialPassword` del `FormData`, vacía el input DOM y limpia el estado
  React en éxito, error funcional, excepción, timeout y resultado ambiguo;
- una excepción se representa como resultado ambiguo con `retryMode: same-operation`;
- la intención durable conserva sólo datos no secretos y el mismo `operation_id`;
- el retry reconcilia primero con ese ID y password vacío. Si Auth todavía necesita crear la
  identidad, la UI vuelve a pedir el password sin emitir un operation ID nuevo.

No se agregó persistencia del password en storage, cookies, URL, payload durable, operación DB,
metadata, logs, errores ni analytics. El snapshot durable sigue validándose fail-closed mediante el
schema estricto preexistente.

Cobertura agregada en `create-center-panel.test.tsx`:

- success: estado/DOM/FormData limpios;
- error funcional: input nuevamente vacío y mismo operation ID;
- excepción/timeout: limpieza y retry de la misma operación;
- response-loss ambiguo: primer intento usa el password, retry usa el mismo operation ID y password
  vacío;
- snapshot durable: no contiene el password.

## IR-2 — ownership y cleanup exacto B1

El harness B1 ya no descubre ni borra fixtures por nombres compartidos:

- se eliminó `cleanupStaleFixtures`;
- se eliminaron queries `LIKE`/prefijo del pre-cleanup y del probe final;
- la corrida genera o registra explícitamente los UUIDs exactos de Auth users, perfiles públicos,
  Centers, memberships y PLATFORM_ADMIN temporal;
- cada `DELETE` usa únicamente el conjunto exacto del tipo correspondiente;
- el probe final consulta únicamente esos UUIDs y exige cero residuos owned;
- antes de crear fixtures se captura y valida el baseline DEV aprobado; cualquier residuo o cambio
  ajeno hace fallar la suite sin borrarlo;
- después del cleanup se vuelve a validar el baseline y se exige igualdad completa con el snapshot
  anterior.

B1 no inicia provisioning ni crea `provisioning_operations`. Sus Server Actions de Auth quedan
esperadas por las aserciones terminales del navegador antes de finalizar cada caso; no existe una
operación provisioning ambigua que reconciliar. El teardown sólo comienza al terminar la suite y no
infiere ownership por email, nombre o namespace.

## IR-3 — evidencia de smoke manual

### B3B — PASS

- listado ADMIN;
- navegación Center ↔ Users.

### B3C — PASS

- nueva identidad RECEPTION;
- login real;
- `/users` denegado para RECEPTION;
- `/platform` denegado/redirigido;
- duplicate membership detectada;
- PROFESSIONAL bloqueado sin ProfessionalCenter;
- cleanup exacto;
- baseline restaurado.

### B3D — PASS

- protección visible del último ADMIN;
- PROFESSIONAL bloqueado sin ProfessionalCenter;
- RECEPTION → ADMIN;
- ADMIN → RECEPTION;
- Active → Inactive;
- Inactive → Active;
- RECEPTION `/users` denegado;
- ADMIN `/users` permitido;
- cleanup exacto;
- baseline restaurado.

No se persisten passwords, secretos ni UUIDs personales innecesarios en esta evidencia.

## Alcance preservado

- Sin cambios de schema, migrations, RLS, grants, contratos RPC, protocolo DB de provisioning ni
  CAS B3D.
- Sin PROD, commit, push, PR, merge, cierre o archivo de TASK-005.
- Sin subfase nueva.
- `next-env.d.ts` permanece como cambio preexistente ajeno y fuera de esta remediación.
- SMTP, rate limiting y leaked-password protection permanecen como pendientes pre-PROD separados,
  no como defectos DEV del Integration Review.

## Verificación

| Verificación | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0 y proyecto DEV coherente. |
| format / lint / typecheck | PASS. |
| unit/component suite | PASS — 172/172 en 24 archivos. |
| tests focalizados B2/B3C de lifecycle e intención | PASS — 43/43. |
| B1 E2E | PASS — 9/9; cleanup por UUID exacto y baseline completo idéntico. |
| B2 E2E | PASS — 9/9 en la corrida completa válida; work in-flight esperado, reconciliación, cleanup exacto y baseline restaurado. |
| B3C E2E comparativo | PASS — 9/9; password no persistido, mismo operation ID y cleanup exacto. |
| provisioning reconciliation | PASS — response-loss, retry, concurrencia, compensación e identidad existente; cero residuos. |
| provisioning orchestration | PASS — 1/1. |
| Auth/RLS/grants | PASS — incluida concurrencia real de ADMIN y cleanup cero. |
| build aislado + client-bundle secret guard | PASS — Next 16.3.5; centinelas ausentes del bundle cliente. |
| migrations | PASS — 14 locales / 14 DEV, mismas versiones. |
| tipos desde DEV | PASS — regeneración sin diff. |
| `git diff --check` | PASS. |

La primera invocación B1 no alcanzó a conectarse ni crear fixtures porque el sandbox no tenía red;
la corrida autorizada posterior pasó 9/9. En B2, una corrida previa pasó 8/9 y restauró por completo
el baseline, pero el probe causal no observó el waiter advisory dentro de su ventana; la repetición
completa observó el waiter y pasó 9/9. Ninguna de esas corridas dejó residuos.

Baseline DEV final read-only:

- 1 Auth User;
- 1 public User;
- 1 PLATFORM_ADMIN;
- 1 Center activo;
- 1 membership ADMIN activa;
- 2 provisioning operations `SUCCEEDED`;
- 0 Professionals;
- 0 ProfessionalCenters;
- 0 Specialties;
- 0 duplicados PROFESSIONAL activos.

Las 14 migrations locales y DEV permanecen sincronizadas y no existe drift de tipos/schema.

## Re-review independiente del Reviewer — 2026-09-28

### Dictamen de findings

| Finding | Estado | Evidencia independiente |
| --- | --- | --- |
| `IR-1 — MEDIUM` | `CLOSED` | El wrapper ejecuta la Server Action bajo `try/catch/finally`; el `finally` elimina `adminInitialPassword` del mismo `FormData`, vacía el input DOM, solicita el vaciado del estado React y sólo después libera el latch. La intención durable conserva el mismo `operation_id` y excluye el secreto. Los tests ejercitan éxito, error funcional, excepción/timeout y response-loss; inspeccionan `FormData`, DOM, storage y retry con password vacío. B2 E2E pasó 9/9. |
| `IR-2 — MEDIUM` | `CLOSED` | El archivo B1 completo no contiene `LIKE`, `ILIKE`, wildcard, cleanup por prefijo ni adopción por naming. Auth users, perfiles, Centers, memberships y PLATFORM_ADMIN se registran por UUID exacto; cada `DELETE` y el probe final usan únicamente esos IDs. El baseline inicial falla cerrado antes de crear fixtures y el final exige igualdad completa. B1 E2E pasó 9/9 con cero residuos owned. |
| `IR-3 — LOW` | `CLOSED` | `docs/status.md` y este artefacto preservan la evidencia B3B/B3C/B3D solicitada, incluidos permisos reales, invariantes, cleanup y baseline restaurado. SMTP, rate limiting y leaked-password protection siguen diferenciados como pendientes pre-PROD. |

### Regresiones y estado final

- `pnpm bootstrap`, format, lint, typecheck y unit/component: PASS; 24/24 archivos y 172/172 tests.
- B1 E2E: 9/9 PASS; B2 E2E: 9/9 PASS; B3C comparativo: 9/9 PASS en la repetición completa.
  Una corrida B3C previa agotó el timeout de 5 segundos mientras el resolver seguía visible como
  `Verificando…`; no había cambio en B3C, el cleanup restauró el baseline y la repetición completa
  descartó una regresión funcional.
- Provisioning reconciliation, provisioning orchestration y Auth/RLS/grants: PASS. La primera
  invocación local de orquestación no tuvo red por sandbox; la corrida autorizada pasó 1/1.
- 14 migrations locales / 14 DEV, mismas versiones; `database.types.ts` regenerado desde DEV sin
  diff y con una única firma CAS de `admin_set_center_membership`.
- Build aislado y guard de secretos del bundle cliente: PASS. Tres binarios nativos bloqueados por
  el servidor DEV preexistente permanecen exclusivamente bajo `%TEMP%`; no hay binarios ni paths
  temporales del review dentro del checkout.
- Baseline DEV verificado antes y después: 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center
  activo, 1 membership ADMIN activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals,
  0 ProfessionalCenters y 0 Specialties.
- PROD permaneció fuera de alcance. `next-env.d.ts` conserva exactamente el diff preexistente y
  ajeno. HEAD continúa en `fc234d2976ba443334c5b96c894e07140265f176`; no hubo commit, push, PR,
  merge, squash, cierre ni archivo de TASK-005.

### Veredicto final

`IR-1 = CLOSED`

`IR-2 = CLOSED`

`IR-3 = CLOSED`

`TASK-005 INTEGRATION REVIEW PASS`

`TASK-005 READY FOR PR`
