# Estado actual

**Fase:** TASK-007A implementation review `CHANGES_REQUESTED`; 007A-IR-1 y 007A-IR-2 remediated — pending independent closure. TASK-007 completa sigue abierta; no se inicia 007B.
**Tarea activa:** TASK-007 — Pacientes, en `task/007-patients`. D1–D8 aprobadas; P007-R1/R2/R3 CLOSED. Evidencia de la remediación en `.harness/tasks/active/TASK-007/implementation-report.md`.
**Último veredicto:** `TASK-007A REVIEW FINDINGS REMEDIATED — READY FOR INDEPENDENT RE-REVIEW`. Sólo el reviewer independiente puede cerrar 007A-IR-1/IR-2. El gap histórico entre los digests ampliados sigue en categoría E, inconcluso y no reconciliado. TASK-006 sigue completada y archivada.
**Main al iniciar TASK-007:** `ea620655ee9f75f903dbce2d94bf820e298b7218` (igual a `origin/main` en el preflight). El squash funcional de TASK-006 fue `c127d3b81f73aba5c47d9ecf462529c73df79fcb`.
**Integración previa:** TASK-005 completada y PR #4 integrada en `main`.

## Remediación de review TASK-007A

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

La reanudación autorizada completó seis carreras reales bajo locks observados, matrices DB/RPC/RLS, cleanup exacto por UUID y comparación read-only final con el baseline V2 autoritativo: digest global `24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`, 15/15 componentes y conteos, filas/campos exactos; sin fixtures residuales. Schema/API separado: 19 migrations locales/DEV, dry-run sin pendientes, lint y verificador de catálogo PASS. Focused 15/15, suite completa 323/323, lint, typecheck, build, guard de secretos, formato focalizado y E2E habitual 1/1 PASS. Las dos migrations aplicadas permanecen inmutables; tipos generados desde DEV y sin regeneración adicional. El gap histórico `72e4ff...` → `86b6cd...` sigue **E — evidencia insuficiente**, sin equivalencia retrospectiva. Pendiente review independiente de 007A; no PR, merge ni archivo y TASK-007 completa sigue abierta. PROD fuera de alcance. Evidencia detallada en `implementation-report.md`.

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
