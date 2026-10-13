# TASK-007 — Review independiente de diseño y plan

**Resultado:** `TASK-007 PLAN REVIEW CHANGES_REQUESTED`

**Fecha:** 2026-10-13

**Alcance:** sólo brief/plan y evidencia versionada. Implementación no autorizada.

## Base examinada

- `.harness/tasks/active/TASK-007/{brief,plan}.md` y `docs/status.md` actuales.
- Schema, grants, policies, helpers y RPCs de las 17 migrations versionadas; tipos generados en `src/lib/supabase/database.types.ts`.
- Contratos y reviews de TASK-004, TASK-005 y TASK-006; módulos de pacientes, accesos y turnos; código actual de autorización, normalización, CAS y convenciones de tests.
- `pnpm bootstrap` pasó. No se consultó el catálogo vivo de DEV: paridad de migrations, catálogo y baseline requieren la reconfirmación read-only exigida por el plan antes de la primera migration. DEV no fue mutado; PROD no fue consultado ni mutado.

## Hallazgos abiertos

### P007-R1 — MEDIUM — La búsqueda tenant no fija el contrato de entrada de la RPC directa

**Evidencia.** `plan.md:89,93,97,109` define `p_kind`, `p_query`, `p_limit` y `p_offset`, un máximo de 50 y comparación para NAME/PHONE/EMAIL, pero la validación SQL esencial enumerada en la línea 109 no incluye esos parámetros. Tampoco determina si NAME/EMAIL ignoran mayúsculas, si `%` y `_` son caracteres literales o comodines, ni el comportamiento de consulta vacía. La RPC propuesta es `SECURITY DEFINER` e invocable directamente por cualquier actor `authenticated` autorizado al Center. PostgreSQL interpreta `LIMIT NULL` como ausencia de límite. No hay índices dedicados para nombre/teléfono/email (`brief.md:28,37`; schema inicial:321-324).

**Riesgo.** Un cliente que omita la validación web podría obtener una respuesta tenant sin la cota de 50 o provocar scans costosos, además de resultados distintos de lo que promete la UI. La barrera de Center sigue siendo necesaria y no se considera rota por este hallazgo.

**Cambio esperado.** Fijar en el plan validación **dentro de `staff_search_patient_centers`**: `kind` permitido, `limit` no nulo en `1..50`, `offset` entero no negativo y acotado o paginación equivalente, tamaño de `query`, semántica de vacío, normalización de case y tratamiento literal de comodines. Añadir pruebas de invocación RPC directa para valores nulos, fuera de rango y búsquedas por los cuatro criterios. No exigir un índice nuevo sin medir el plan real.

### P007-R2 — MEDIUM — El contrato de nacionalidad y textos no es igual en Zod y RPC

**Evidencia.** `plan.md:109` promete que Zod verifica un ISO 3166-1 alpha-2 reconocido, pero sólo pide a las RPCs repetir el *formato* de nacionalidad y difiere la regla ISO de DB. `persons` sólo tiene el CHECK `^[A-Z]{2}$` (`20260921150000_initial_domain_schema.sql:117-125`), por lo que una llamada directa a create podría persistir un código de dos letras no reconocido si la RPC copia ese criterio. `persons` y `patient_centers` usan `text` sin límites para nombres, documento, teléfono, email, cobertura y notas (`...initial_domain_schema.sql:103-125,216-234`); `plan.md:107-109` y la matriz `:155-157` no fijan topes ni casos compartidos de email entre servidor y DB. TASK-006 tuvo que remediar una divergencia real de validación de email (`.harness/tasks/archive/TASK-006/review.md:67-89,343-354`).

**Riesgo.** La API `authenticated` puede aceptar identidades o datos administrativos que el servidor web rechaza, o textos desmedidos. Para Person, D2 vuelve la identidad inmutable tras crearla, por lo que un valor inválido no tendría corrección en TASK-007.

**Cambio esperado.** Definir si la pertenencia a ISO reconocida es requisito del contrato —como lo afirma el plan— y aplicarla también en la RPC de alta, con el mismo conjunto/casos que Zod; o ajustar explícitamente ambos lados a la regla de dos letras aprobada. Fijar límites razonables para nombres, documento, teléfono, email, cobertura, notas y filtros, con validación en servidor y RPC; preservar trim y vacío opcional → `NULL`. Compartir casos de email válido/inválido entre tests de Zod y pruebas SQL/RPC, incluidas invocaciones directas. No hace falta convertir cobertura en catálogo.

### P007-R3 — MEDIUM — “Fecha de nacimiento no futura” carece de día de referencia explícito

**Evidencia.** `plan.md:109` exige validar fecha real/no futura en Zod y RPC; el schema sólo exige `birth_date date NOT NULL` (`...initial_domain_schema.sql:103-108`). `docs/time-handling.md` trata nacimiento como fecha pura y los centros usan zona IANA. El plan no define si “hoy” es el día del Center, UTC, del servidor Next o de la sesión PostgreSQL. Por ejemplo, a las 22:30 de Buenos Aires del día 13, UTC ya es día 14: una comparación SQL con `current_date` en UTC aceptaría el día 14, todavía futuro en el Center.

**Riesgo.** Se puede crear una Person con nacimiento futuro para el flujo operativo del Center mediante invocación directa de la RPC, aun cuando la UI lo rechace. Validación sólo en cliente o sólo en Zod no satisface el contrato.

**Cambio esperado.** Definir el día autoritativo en el plan y usarlo dentro de `staff_create_patient_with_center` —preferiblemente la fecha actual en `centers.timezone`, obtenida del Center autorizado—; alinear Zod con esa regla sin depender del reloj/zona del navegador. Probar borde de medianoche con RPC directa. Una constraint DB dependiente del día no aporta una garantía adicional necesaria para la única ruta de escritura aprobada; no se exige migration estructural.

## Evaluación de D1–D8 y superficies

| Área | Evaluación |
| --- | --- |
| D1 autorización | Coherente: ruta, queries, Actions y operaciones usan ADMIN/RECEPTION del Center activo; RPC y policies revalidan. `private.has_active_center_role` exige membership y Center activos (`20260922121000_add_auth_access_helpers_and_policies.sql:35-55`). PROFESSIONAL, PLATFORM_ADMIN-only, inactivos, cross-center y anon quedan denegados. Un PLATFORM_ADMIN con membership tenant válida opera por esa membership, no por bypass global. |
| D2 identidad | Coherente: sólo create inserta Person; no update, merge, override ni corrección global. La protección por grants/RLS impide DML genérico. |
| D3/D8 privacidad | Resolve exige nacionalidad, documento y nacimiento ingresado, con `center_id` sólo para autorización/relación. Retorno mínimo aprobado; DOB almacenada, contacto, documento, otros Centers y Auth quedan fuera. Con mismatch, IDs/tokens nulos; link y reactivación vuelven a comparar en DB y abortan sin crear PatientCenter. |
| Enumeración | **Aceptable para el MVP con riesgo residual explícito.** `FOUND/NOT_FOUND`, nombres y booleano de DOB permiten a personal ADMIN/RECEPTION probar claves globales y adivinar DOB mediante repetición; create/error de identidad existente es otro oráculo equivalente. El contrato aprobado requiere esa distinción para vincular y evita búsqueda parcial/global, acceso anon y exposición de otros Centers. No se justifica reabrir D3/D8 ni diseñar aquí rate limiting genérico. Antes de producción pública permanece el gate de control concreto de abuso en `docs/status.md:244-255`; cualquier mitigación futura deberá cubrir resolve **y** create/error sin romper el flujo de confirmación. No registrar PII en logs. |
| D4 RLS/grants | Dos SELECT policies tenant y grants `SELECT` a `authenticated` son consistentes con el schema default-deny; la policy de Person exige relación visible y no abre directorio global. No DML genérico; resolve global sólo por RPC. Las siete firmas requieren `EXECUTE` exacto, `search_path=''`, nombres calificados y autorización interna. Search `SECURITY DEFINER` necesita especialmente las cotas de R1. |
| D5 reuse | `UNIQUE(center_id,person_id)` (`...initial_domain_schema.sql:232`) cubre inactivos. Alta nueva atómica, link con confirmación, ACTIVE reutilizado, INACTIVE reactivado en la misma fila con confirmación; no sobrescribe los cuatro campos administrativos. |
| D6 CAS/concurrencia | Lock de identidad canónica → Center → fila; edición/baja Center → fila. Relectura bajo lock, reautorización y CAS antes de no-op/mutación. El trigger actual usa `now()` (`...initial_domain_schema.sql:32-41,374-376`), así que el reemplazo monotónico propuesto coincide con TASK-006 (`20261009130000_enforce_task006_cas_monotonicity.sql`). UNIQUE global y por Center siguen siendo autoridad final. Los outcomes create/create, create/link, link/link y reactivate/reactivate son deterministas y sin estado parcial si se implementan tal como está escrito. |
| Normalización | `private.normalize_document` elimina whitespace, puntos y guiones aprobados, conserva letras/ceros (`...initial_domain_schema.sql:17-30`); espejo Zod sólo valida y PostgreSQL calcula la clave. La matriz incluye numérico, alfanumérico, `00123` y sólo separadores, evitando D-R1. |
| PatientCenter | Teléfono requerido; email, cobertura y notas opcionales con trim/vacío → `NULL`. Las notas sólo en panel. Falta cerrar límites y paridad de validación (R2). |
| Search | Separación tenant/global explícita; un miss no dispara resolve. Documento exacto, otros criterios sólo del Center, límite 50 y paginación propuestos. Falta cerrar la semántica y defensa de RPC directa (R1). |
| UI | Listado y drawer adaptable son suficientes; no hace falta página de detalle. Contempla búsqueda, alta, resolve, miss, match/mismatch, ACTIVE, INACTIVE, stale, éxito/error, loading, vacío y móvil. |
| RPC/errores | Siete RPCs con responsabilidades acotadas; definer justificado para resolve/mutaciones sin grants DML. Autorización antes de existencia y errores cross-center genéricos. `P0001` se distingue por token estable; `ALREADY_ACTIVE` y no-op son outcomes, no fallas. La divergencia SQL/Zod y límites de R1/R2/R3 se deben cerrar antes de implementar. |
| Tests | Matriz separa unit/component, DB/RLS/RPC, concurrencia real, E2E y smoke. Incluye roles permitidos/denegados, privacidad, mismatch sin mutación, UNIQUE, CAS, no-op, cleanup y baseline. Agregar los casos directos indicados en R1–R3; las carreras deben usar barreras/locks observables según `docs/decisions/09-testing.md`, no sleeps como sincronización. |
| Turnos/scope | `appointments` ya referencia `(patient_center_id,center_id)` (`src/lib/supabase/database.types.ts:51-57`); ID, Center, estado y datos administrativos quedan estables para TASK-009. No se diseña Availability, slots, Appointments, Agenda, clínica, billing, booking público, reminders, catálogo de seguros ni corrección global. |

## Estado de cierre del review

- `brief.md`, `plan.md`, `docs/status.md`, migrations, código y tests no fueron editados en esta instancia. Sólo se creó este `review.md`.
- `next-env.d.ts` permaneció modificado, **unstaged** y fuera de TASK-007; SHA-256 comprobado: `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- No hubo stage, commit, push, PR ni implementación. Cero mutaciones DEV; cero consultas y mutaciones PROD.
- Corregir R1–R3 en un turno posterior de planificación y pedir un nuevo review antes de solicitar autorización de implementación.

## TASK-007 PLAN RE-REVIEW — 2026-10-13

**Resultado:** `TASK-007 PLAN REVIEW CHANGES_REQUESTED`. Este re-review se limita a P007-R1/R2/R3 y regresiones de su remediación. El resultado y los tres findings MEDIUM anteriores permanecen arriba como historial; no se reescriben.

### P007-R1 — MEDIUM — OPEN

**Resuelto en el plan:** `plan.md:89-93,101,183` elimina `kind` y cualquier selección de campo, orden o expresión del caller. Define una sola query literal tenant; `ACTIVE/INACTIVE/ALL`, default ACTIVE; `limit` default 25, rango `1..50`; `offset` default 0, rango **`0..10000`**; NULL explícito para límite/offset falla sin clamp. La RPC valida antes de buscar. Documento usa igualdad exacta con `normalized_document`; nombre/apellido y email usan subcadena case-insensitive, teléfono subcadena del valor trimmed. `position()` trata `%`, `_` y `\` como literales; el orden termina en `patient_center_id`. NULL/vacío lista el tenant paginado, sin resolve global; el predicado y joins se restringen al Center autorizado. La matriz incluye llamadas RPC directas, límites y orden.

**Pendiente concreto.** `plan.md:91,93,125,127` afirma que Zod/server y RPC aplican la misma normalización de `query`, pero especifica `trim` en TypeScript y `btrim` en PostgreSQL. `btrim(text)` sin conjunto explícito elimina espacios ASCII de los extremos; `String.prototype.trim()` también elimina tabulaciones y otros whitespace. Con `query = '\t'`, Zod la convierte en vacía y lista el tenant, mientras la RPC propuesta conserva una query no vacía y busca literalmente el tab. La semántica de vacío no es idéntica para una llamada directa.

**Riesgo.** Dos superficies autorizadas producen resultados distintos para el mismo input; el límite de tenant no se rompe, pero el contrato final de búsqueda no está cerrado de forma simétrica.

**Cambio esperado para CLOSED.** Fijar un único conjunto de caracteres de trim en Zod y RPC, o rechazar explícitamente whitespace no admitido en ambas. Añadir al contrato y a la matriz query sólo tabs/newlines y query con whitespace mixto en extremos, por web y RPC directa. Mantener las cotas y la búsqueda literal ya resueltas.

### P007-R2 — MEDIUM — OPEN

**Resuelto en el plan:** `plan.md:113-127,184` propone un snapshot ISO versionado y un helper privado PostgreSQL, compara el conjunto completo con TypeScript, rechaza `ZZ`, y usa la regla en resolve/create/link/reactivate. Reutiliza el validador y la matriz de email de TASK-006 (`lower(btrim(email))`, total 320, local 64, dominio 255, un solo `@`, estructura DNS/TLD), con NULL/vacío opcional → NULL. Fija máximos exactos: nombres 100, documento crudo 100, teléfono 50, email 320, cobertura 160, notas 4000 y query 100; compara `char_length` con code points, prueba máximo y máximo+1, evita truncamiento y conserva `private.normalize_document`/UNIQUE como autoridad. Teléfono sólo requiere trim, no vacío y <=50, sin normalización internacional.

**Pendiente concreto.** La misma divergencia `trim`/`btrim` afecta campos de Person y PatientCenter. En particular, `phone = '\t'` es vacío tras `String.prototype.trim()` pero **no** tras `btrim()` y pasa el CHECK existente `btrim(phone) <> ''` (`20260921150000_initial_domain_schema.sql:231`). Un `insurance_name` o `administrative_notes` compuesto por tabulaciones puede persistirse en la RPC en vez de convertirse en NULL. Para `email = '\t'`, la RPC lo rechazaría como inválido mientras el requisito del re-review pide que whitespace-only sea NULL. Reusar el contrato TASK-006 no soluciona este punto: `normalizeProfessionalEmail()` sólo quita espacios ASCII (`src/modules/professionals/schemas/professional-email.ts:7-9`) y el helper SQL usa `btrim`; la remediación de TASK-006 no prometía opcional whitespace-only → NULL para PatientCenter.

**Riesgo.** La invocación directa puede persistir un teléfono sin contenido útil o guardar opcionales que deberían ser NULL; web y RPC no aceptan/normalizan los mismos valores.

**Cambio esperado para CLOSED.** Definir exactamente los caracteres considerados whitespace/trim y hacer que Zod y RPC coincidan para todos los campos, incluidos opcionales. Si se adopta sólo espacio ASCII, especificar qué ocurre con tab/newline y cómo se cumple whitespace-only → NULL; si se adopta un conjunto mayor, implementarlo explícitamente en PostgreSQL y TypeScript. Añadir casos directos de tabs/newlines y mixtos, además de la matriz de email y los bordes de longitud ya previstos. No se requiere tabla nueva ni validación telefónica internacional.

### P007-R3 — MEDIUM — OPEN

**Resuelto en el plan:** `plan.md:129-133,185` define la autoridad de la RPC como `(statement_timestamp() AT TIME ZONE center.timezone)::date`, con Center previamente autorizado y zona IANA leída de su fila. `CURRENT_DATE`, zona de sesión, reloj del navegador y tiempo de inicio de una transacción anterior quedan descartados. Create rechaza nacimiento posterior antes de INSERT, con cero Person/PatientCenter; resolve/link/reactivate aplican la misma validación. No hace falta CHECK dependiente del reloj. La matriz enumera ayer/hoy/mañana, UTC-3 alrededor de medianoche, dos Centers con distinto día local, zona inválida y bypass RPC directo.

**Pendiente concreto.** La matriz enumera esos casos, pero no explica cómo probar **determinísticamente** el borde de medianoche de la misma lógica que ejecutará la RPC. `statement_timestamp()` no admite un instante de prueba en la firma pública, y esperar al reloj real no es una prueba reproducible. La consigna de re-review exige registrar este vacío si no hay estrategia explícita.

**Riesgo.** La implementación podría terminar con tests que sólo validan una expresión duplicada o que dependen del momento real, sin cubrir que la RPC use la conversión correcta en el boundary.

**Cambio esperado para CLOSED.** Especificar una estrategia determinista sin parámetro de reloj controlado por el caller en la RPC pública. Por ejemplo, factorizar el cálculo en un helper privado que recibe `timestamptz` y zona, probarlo con instantes fijos a ambos lados de medianoche y comprobar que create/resolve/link/reactivate llaman ese helper con `statement_timestamp()`; complementar con llamadas RPC directas para hoy/mañana y cero mutación. Cualquier enfoque equivalente que pruebe la misma ruta de cálculo es válido.

### Regresiones y gates

- D1–D8 siguen intactas: ADMIN/RECEPTION tenant, Person inmutable, resolve mínimo con DOB booleana, SELECT tenant y grants acotados, reuse/reactivation explícitos, locks/CAS/no-op, UI listado/drawer y bloqueo de birth mismatch. No se agregaron tablas de producto, catálogo de seguros, acceso Professional, corrección global, Turnos, Agenda, Availability, billing ni clínica.
- Riesgo de inferencia por resolve exacto y create/error registrado como `ACCEPTED RISK` para MVP DEV (`plan.md:159-161`, `brief.md:65`). `docs/status.md:244-255` exige protección concreta de abuso/rate limiting y monitoreo para **ambas** vías antes de PROD pública, fuera de TASK-007. No hay nueva divulgación por la taxonomía: `INVALID_PATIENT_INPUT`, `PATIENT_ACCESS_DENIED`, `PATIENT_BIRTH_DATE_MISMATCH`, `ALREADY_ACTIVE` como outcome y `STALE_PATIENT_CENTER_STATE` están distinguidos; `NOT_FOUND` no devuelve Person y los errores de Center ajeno siguen genéricos.
- La matriz conserva roles permitidos/denegados, privacidad, create/reuse, mismatch sin mutación, reactivación, CAS/no-op, concurrencia, cleanup y baseline; añade los casos R1/R2/R3 salvo los bordes de whitespace y el mecanismo temporal determinista indicados arriba.
- `plan.md:193` obliga **antes de crear o aplicar la primera migration** a restaurar acceso read-only al CLI, verificar paridad local/DEV, catálogo vivo relevante y baseline DEV. Esta instancia no ejecutó ese gate ni afirma paridad actual.
- Sólo se añadió esta sección a `review.md`. `brief.md`, `plan.md`, `docs/status.md`, migrations, source y tests no se modificaron aquí. `next-env.d.ts` conserva el SHA-256 esperado `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`, permanece unstaged y fuera de TASK-007. Sin stage, commit, push, PR, implementación, mutaciones DEV ni acceso a PROD.

## TASK-007 SECOND PLAN RE-REVIEW — 2026-10-13

**Resultado actual:** `TASK-007 PLAN REVIEW PASS — READY FOR IMPLEMENTATION AUTHORIZATION`. Este veredicto cierra exclusivamente los tres findings del plan; no autoriza IMPLEMENT. Permanecen intactos arriba el `TASK-007 PLAN REVIEW CHANGES_REQUESTED` inicial, el primer re-review `CHANGES_REQUESTED` y los textos históricos `P007-R1/R2/R3 — OPEN`. No se hizo un review nuevo de implementación porque no existe implementación.

### P007-R1 — CLOSED — búsqueda tenant y paridad de query

- `plan.md:89-93,101,113-128,142,202-203` define `PATIENT_EDGE_WHITESPACE` exactamente como U+0009 TAB, U+000A LF, U+000B VT, U+000C FF, U+000D CR y U+0020 SPACE. El helper TypeScript usa una expresión con ese conjunto explícito; `private.trim_patient_input(text)` lo usa en PostgreSQL con un segundo argumento explícito de `btrim` o equivalente. El contrato ya no presupone equivalencia entre `String.trim()` y `btrim(text)`.
- `NULL`, `""`, `" "`, `"\t"`, `"\n"`, `"\r\n"` y `" \t\r\n "` son query vacía después del mismo trim en UI/Zod/server y RPC directa: listado tenant paginado. No disparan resolve global, error de búsqueda inconsistente ni búsqueda literal de tabs. La matriz exige paridad en ambas capas.
- Estado `ACTIVE | INACTIVE | ALL` (default `ACTIVE`); límite default 25, rango entero `1..50`; offset default 0, rango entero `0..10000`; query canónica `<=100`. La RPC valida también llamadas directas y rechaza NULL explícito para límite/offset, rangos o estados inválidos, sin clamp. Documento equivale a `normalized_document` por igualdad exacta; nombre y email usan subcadena literal case-insensitive, teléfono subcadena tenant según el valor recortado. `position()` preserva `%`, `_` y `\` como datos. El predicado queda en el Center autorizado y el orden termina con `patient_center_id` como desempate estable. Un miss tenant no llama resolve global.

### P007-R2 — CLOSED — normalización de inputs

- `plan.md:113-144,203` obliga a aplicar el mismo edge trim antes de validar nombre, apellido, documento crudo, teléfono, email opcional, cobertura, notas y query; también antes de uppercase/ISO de nacionalidad. No queda un camino TASK-007 de decisión de vacío basado en `String.trim()` o `btrim()` sin conjunto explícito. Zod/server y cada RPC que recibe esos campos repiten límites y rechazos; no truncan.
- Teléfono requerido, canónico no vacío y `<=50`: `" "`, `"\t"`, `"\r\n"` inválidos; `" 123 "` persiste `"123"`. No se añade validación internacional. Email opcional sigue la secuencia edge trim → detección de vacío → `NULL` si vacío → contrato TASK-006 si no vacío. Espacio, TAB, CRLF y mezclas producen `NULL` en ambas capas. Para email no vacío, permanece lowercase, total `<=320`, un solo `@`, local `<=64`, dominio `<=255`, sin whitespace interno, estructura de puntos válida, etiquetas DNS ASCII `<=63` y TLD alfabético de al menos dos letras. Se reutilizan el validador SQL y la matriz versionada de TASK-006, con el paso de trim TASK-007 previo.
- Cobertura `<=160` y notas `<=4000`: edge trim y vacío, incluso TAB o mezclas, a `NULL`; sin truncamiento. Nombre y apellido `1..100`, documento crudo recortado `1..100`; sólo separadores documentales es inválido, `normalized_document` debe ser no vacío y `private.normalize_document`/UNIQUE de PostgreSQL son la autoridad final. Nacionalidad: edge trim, uppercase y pertenencia al snapshot versionado de ISO 3166-1 alpha-2 oficialmente asignado en TS y SQL; `ZZ` se rechaza, con prueba del conjunto completo.
- La matriz contractual `plan.md:117-128` da los mismos resultados esperados para ambos helpers: `""`, espacio, TAB, LF, CRLF y bordes mixtos → `""`; `" abc "`, `"\tabc\t"`, `"\nabc\r"` → `"abc"`; TAB interno en `"a\tb"` permanece. `plan.md:203` exige probar helper TS y helper PostgreSQL con esos resultados, además de RPC directa y bordes de longitud.

### P007-R3 — CLOSED — día local y prueba determinista

- `plan.md:146-152,204` fija una sola primitiva privada `center_local_date_at(p_timezone text, p_instant timestamptz) -> date`, con `(p_instant AT TIME ZONE p_timezone)::date`. Producción y test A usan esa misma función. Las RPC públicas no reciben timezone, fecha actual ni instante: autorizan el Center, leen `centers.timezone` y calculan `center_local_date_at(authorized_center.timezone, statement_timestamp())`. `birth_date` posterior al día local produce `INVALID_PATIENT_INPUT` antes de insertar o revierte íntegramente: cero Person, cero PatientCenter y cero estado parcial.
- Test A invoca la función DB con instantes fijos de `America/Argentina/Buenos_Aires`: `2026-10-14T02:59:59Z` → `2026-10-13`; `2026-10-14T03:00:00Z` → `2026-10-14`. El primero también cubre fecha UTC distinta de la del Center. No usa reloj real ni espera medianoche.
- Test B inspecciona catálogo/cuerpo para confirmar que create, resolve, link y reactivate usan esa misma función con `statement_timestamp()` y timezone del Center autorizado. Además invoca RPC real para aceptar hoy local y rechazar mañana local, con cero mutación parcial. No introduce otra implementación temporal sólo para tests. Zona inválida del Center falla cerrada, sin fallback ni creación de datos; no amplía la administración de timezones.

### Regresiones, riesgo y gates

- `plan.md:9-79,81-109,154-180` y `brief.md:39-65` conservan D1–D8: ADMIN/RECEPTION tenant; Person global inmutable tras alta; resolve mínimo y comparación DOB; SELECT tenant/RLS y grants estrechos; reuse/reactivation de la misma fila; locks, CAS y no-op; listado/drawer; mismatch sin vínculo. El schema versionado conserva UNIQUE documental global y `(center_id,person_id)`, y los tipos generados reflejan Person/PatientCenter. No se añadió acceso Professional a pacientes, corrección global, catálogo de seguros, Availability, Appointments, Agenda, clínica, facturación ni implementación de rate limiting.
- La inferencia por resolve exacto y create/error sigue como `ACCEPTED RISK — MVP DEV` (`plan.md:180`, `brief.md:65`). Control concreto de abuso/rate limiting y monitoreo de ambas vías siguen siendo `PRE-PROD REQUIRED` (`docs/status.md`, Pendientes pre-PROD); no son parte de TASK-007.
- `plan.md:184,208,212` mantiene un gate previo a la primera migration: acceso read-only al Supabase CLI, verificar **17 migrations locales == 17 DEV**, catálogo vivo relevante y baseline DEV exacto por IDs/contenido, sin asumir que el digest histórico de TASK-006 aún vale. Este re-review no ejecutó ese gate, no afirma paridad DEV actual y no consultó PROD.

**Findings restantes de plan:** ninguno. Se verificó sólo el contrato documental y la evidencia versionada; los helpers, RPCs y pruebas descritos siguen pendientes de IMPLEMENT autorizado y de review posterior. `pnpm bootstrap` pasó como chequeo local. En esta instancia se modificó exclusivamente `review.md`; no se editaron brief, plan, status, migrations, source ni tests. `next-env.d.ts` sigue modificado y unstaged con SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`; no se tocó. Sin stage, commit, push, PR ni mutaciones DEV; cero acceso a PROD.
