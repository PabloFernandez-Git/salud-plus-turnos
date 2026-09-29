# TASK-005B3D — Re-review independiente

**Resultado:** `TASK-005B3D REVIEW PASS`

## B3D-R1 — CLOSED

El stale check ahora es un compare-and-swap atómico dentro de la única firma existente de
`public.admin_set_center_membership`.

### Evidencia

- La migration incremental `20260928120000_make_membership_stale_check_atomic.sql` elimina la firma
  legacy de cinco argumentos y crea una única firma de ocho argumentos. No modifica migrations
  históricas, RLS ni tablas y no agrega una función administrativa paralela.
- El orden autoritativo es: advisory lock del Center → autorización ADMIN activa → resolución y
  `SELECT ... FOR UPDATE` de la membership same-Center → comparación expected/current → invariantes
  ProfessionalCenter → `UPDATE` → postcondición de último ADMIN.
- El CAS compara bajo el row lock `role`, `professional_center_id` e `is_active`. Las tres
  comparaciones usan `IS DISTINCT FROM`, por lo que cubren de forma null-safe `NULL/NULL`,
  `NULL/UUID`, `UUID/NULL` y UUID distintos.
- Un mismatch aborta antes del `UPDATE` con `P0001 / STALE_MEMBERSHIP_STATE`. El wrapper lo convierte
  en `CenterMembershipMutationError("STALE")`; la Server Action devuelve feedback recuperable sin
  exponer detalles SQL y la UI solicita actualizar/revisar el estado.
- El precheck de aplicación permanece sólo como optimización UX. La prueba DB-backed llama la RPC
  directamente y demuestra que la protección no depende de ese precheck.

### Catálogo y grants DEV

La consulta directa a `pg_catalog` sobre `ehllxymqyzrofydrvtzo` confirmó:

- exactamente una función llamada `admin_set_center_membership`;
- firma única
  `admin_set_center_membership(uuid,uuid,membership_role,uuid,boolean,membership_role,uuid,boolean)`;
- firma legacy inexistente y cero wrappers/aliases que invoquen la RPC;
- `SECURITY DEFINER` y `search_path=""`;
- `PUBLIC`: sin `EXECUTE`;
- `anon`: sin `EXECUTE`;
- `authenticated`: con `EXECUTE`;
- cuerpo real con advisory lock, `FOR UPDATE`, tres comparaciones null-safe y stale antes del update.

### Concurrencia real

El harness PostgreSQL determinístico pasó observando el advisory lock pendiente en `pg_locks`:

1. estado inicial A = `RECEPTION / activo / NULL`;
2. T1 confirma B = `PROFESSIONAL / inactivo / UUID` y conserva el lock hasta commit;
3. T2 ya intentaba C = `ADMIN / activo / NULL` con expected A y queda bloqueada;
4. después del commit de T1, T2 observa B bajo lock y recibe
   `P0001 / STALE_MEMBERSHIP_STATE`;
5. estado final = B y final != C.

La misma corrida revalidó las carreras de dos ADMIN dejando el rol y dos memberships intentando el
mismo ProfessionalCenter: sobrevive al menos un ADMIN activo y como máximo una membership
PROFESSIONAL activa obtiene el PC.

## Regresiones y scope

- B3D focalizados: 38/38.
- Suite unitaria/componentes completa: 168/168.
- B3D E2E: 6/6 con cleanup exacto y baseline persistente idéntico.
- Auth/RLS/grants y concurrencia real: PASS con cleanup cero.
- B3A invariants/concurrency/CAS: PASS con baseline verificado antes y después.
- Format, lint, typecheck, DB lint, build aislado y client-secret guard: PASS.
- `database.types.ts` coincide exactamente con los tipos generados y formateados desde DEV.
- 14 migrations locales y 14 DEV sincronizadas hasta `20260928120000`; cero drift.
- Migrations históricas sin cambios; el diff adicional de R1 se limita a migration CAS, callers,
  tipos generados, pruebas y documentación.
- No se introdujeron cambios funcionales fuera de B3D ni se inició otra subfase.

## Estado final

- Baseline DEV: 1 Auth User, 1 public User, 1 PLATFORM_ADMIN, 1 Center activo, 1 membership ADMIN
  activa, 2 provisioning operations `SUCCEEDED`, 0 Professionals, 0 ProfessionalCenters y
  0 Specialties.
- Cero sesiones residuales de los harnesses.
- El temporal Windows reportado está fuera del checkout y contiene sólo los tres binarios nativos
  `next-swc`, `tailwindcss-oxide` y `lightningcss`; no contiene fuentes, configuración, `.env` ni
  material que deba versionarse.
- `next-env.d.ts` conserva únicamente el cambio preexistente `.next/types/...` →
  `.next/dev/types/...` y no fue modificado por el review.
- PROD, commit, push, PR, merge, cierre y archivo de TASK-005 permanecieron fuera de alcance.
