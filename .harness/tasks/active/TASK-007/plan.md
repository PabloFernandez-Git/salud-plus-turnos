# TASK-007 — Plan aprobado para review independiente

**Estado:** `DESIGN APPROVED — SECOND PLAN REMEDIATION COMPLETE — AWAITING INDEPENDENT RE-REVIEW — IMPLEMENTATION NOT AUTHORIZED`

El contrato de base es el de `brief.md`. La persona usuaria aprobó D1–D7 y agregó D8 como decisión vinculante. En cada sección siguiente, la recomendación anterior es ahora la **decisión aprobada**; las opciones permanecen como contexto. El segundo re-review mantiene P007-R1, P007-R2 y P007-R3 como MEDIUM/OPEN en `review.md`, sin findings nuevos. Las precisiones de este plan son una segunda remediación propuesta para re-review, **no cierre de los findings**. Este plan no contiene SQL ni autoriza migrations, fixtures, mutaciones DEV, código de producto, commit, push o PR.

## DECISIONES APROBADAS D1–D8

### D1 — Roles y alcance de datos administrativos

- **Problema:** TASK-006 fue ADMIN-only; Recepción necesita registrar pacientes para Turnos. Notas administrativas son privadas.
- **Opciones:** (A) ADMIN y RECEPTION administran todas las operaciones y ven notas; (B) ADMIN administra, RECEPTION sólo busca/crea; (C) ADMIN-only.
- **Decisión aprobada:** A para PatientCenter de su Center activo, incluida lectura/escritura de notas exclusivamente administrativas, nunca clínicas. PROFESSIONAL sin lectura ni administración en TASK-007; PLATFORM_ADMIN-only sin bypass. Guardas server + RLS/RPC aplican lo mismo.
- **Ventajas:** flujo de Recepción completo sin depender del ADMIN; permiso limitado al Center.
- **Riesgos:** exposición de notas a todo el personal de Recepción; requiere evitar contenido clínico y auditar accesos/abuso.
- **Impacto futuro:** Turnos podrá reutilizar este rol para buscar y elegir PatientCenter; permisos de Profesional se decidirán en TASK-009.

### D2 — Mutabilidad de identidad global

- **Problema:** cambiar nombre, apellido, nacimiento o clave documental de Person desde un Center cambia la vista de otros Centers y puede fusionar o desplazar identidades.
- **Opciones:** (A) globales de solo lectura después del alta y corrección posterior separada; (B) permitir nombre/nacimiento con CAS global; (C) permitir también documento/nacionalidad con revisión especial.
- **Decisión aprobada:** A en TASK-007: `first_name`, `last_name`, `birth_date`, `nationality_code`, `document_number` y `normalized_document` no se editan desde Pacientes después del alta. Una corrección futura requiere otro flujo aprobado. Un conflicto de nacimiento bloquea vínculo/reactivación y no sobreescribe la fecha.
- **Ventajas:** evita cambios transversales silenciosos y simplifica CAS a PatientCenter.
- **Riesgos:** datos globales erróneos no se corrigen desde esta UI; necesita procedimiento operativo temporal.
- **Impacto futuro:** definir actor/consentimiento/auditoría para corrección global antes de habilitarla; Turnos seguirá referenciando la misma Person mediante PatientCenter.

### D3 — Divulgación mínima en resolve global

- **Problema:** un exact match de nacionalidad + documento revela existencia de Person global a un actor tenant; hacen falta datos para confirmar identidad.
- **Opciones:** (A) nombre/apellido + coincidencia booleana de fecha de nacimiento ingresada + estado respecto del Center, IDs/tokens técnicos opacos; (B) añadir fecha completa; (C) sólo estado/identificador sin nombre.
- **Decisión aprobada:** A. El criterio global de búsqueda acepta exclusivamente nacionalidad, documento y nacimiento ingresado. `center_id` es contexto técnico de autorización/estado de relación, no criterio de búsqueda global. Devolver `first_name`, `last_name`, `birth_date_matches` y `relationship_state` (`NOT_LINKED`, `ACTIVE`, `INACTIVE`); IDs/tokens estrictamente necesarios sólo de forma opaca. No devolver fecha almacenada. Si ya está vinculado al Center, sus datos se leen por la query tenant ordinaria. Confirmación explícita antes de vincular/reactivar. Nunca devolver teléfono, email, cobertura, notas, documento original/normalizado, otros Centers/PatientCenters ni Users/Auth/memberships.
- **Ventajas:** confirma mejor que nombre solo con menos divulgación que fecha completa; exact match no se vuelve directorio.
- **Riesgos:** aun la respuesta mínima permite probar una clave documental conocida; limitar a ADMIN/RECEPTION autenticados de Center activo, rate limiting/telemetría de abuso cuando el entorno público lo exija. Un error de fecha legítimo requiere revisión.
- **Impacto futuro:** contrato separado de resolución para otros módulos; no copiar literalmente D2 de Professionals.

### D4 — Lecturas tenant y búsqueda

- **Problema:** hacen falta lista y búsqueda útiles sin abrir Person global ni notas fuera del Center.
- **Opciones:** (A) policies SELECT sobre PatientCenter y Person vinculada + queries del módulo; (B) RPC de lectura tenant con proyección explícita, sin SELECT directo de Person/PatientCenter; (C) búsqueda global parcial.
- **Decisión aprobada:** A, con SELECT Person permitido únicamente si existe PatientCenter del Center donde el actor tiene ADMIN/RECEPTION activo, y SELECT PatientCenter limitado al mismo Center. La query siempre filtra `center_id`, pagina y proyecta campos. El resolve global exacto usa RPC estrecha separada; no se abre SELECT global. C se descarta.
- **Ventajas:** se alinea con queries internas y RLS existente; listado, búsqueda y edición usan IDs estables.
- **Riesgos:** una policy de Person mal formulada puede revelar personas de otro Center; tests de catálogo, RLS y cross-center son obligatorios. SELECT de PatientCenter concede lectura de notas al rol propuesto aun si la tabla las oculta.
- **Impacto futuro:** búsqueda tenant por documento exacto, nombre/apellido, teléfono o email; no agregar índices de texto ni fuzzy search sin evidencia de planes/volumen. TASK-009 consume el lookup tenant, no el resolve global.

### D5 — Reutilización y reactivación

- **Problema:** el UNIQUE `(center_id,person_id)` impide duplicar PatientCenter, incluso inactivo.
- **Opciones:** (A) activo se abre; inactivo se reactiva explícitamente conservando datos y permitiendo cambios explícitos; (B) inactivo bloquea alta y exige proceso aparte; (C) crear nueva fila, incompatible con schema.
- **Decisión aprobada:** A. Ausencia global produce `NOT_FOUND`; una Person existente usa `relationship_state` `NOT_LINKED`, `ACTIVE` o `INACTIVE` sólo respecto del Center actual. Crear Person+PatientCenter, vincular y reactivar son operaciones transaccionales que revalidan identidad, nacimiento y Center. ACTIVE se abre sin duplicar ni sobrescribir; INACTIVE requiere confirmación y conserva datos. Reactivar no toca User/membership ni otros Centers.
- **Ventajas:** preserva historial, IDs y futura FK de turnos; evita duplicados.
- **Riesgos:** datos de contacto antiguos pueden ser incorrectos; confirmarlos antes de reactivar.
- **Impacto futuro:** turnos históricos conservan `patient_center_id`; TASK-009 debe exigir estado activo al crear turno nuevo.

### D6 — CAS, no-op y atomicidad

- **Problema:** `patient_centers.updated_at` existe, pero su trigger `now()` no garantiza avance monotónico; existen carreras de edición/reactivación.
- **Opciones:** (A) CAS con `expected_updated_at` y trigger monotónico sólo para PatientCenter; (B) columna `version`; (C) last-write-wins.
- **Decisión aprobada:** A. RPC toma lock de identidad cuando corresponde, lock compatible por Center, luego fila PatientCenter `FOR UPDATE`; relee, reautoriza y compara `expected_updated_at` antes de cualquier cambio. Create Person+PatientCenter atómico; identidad global exacta serializada por clave documental/UNIQUE, sin crear Person huérfana si falla vínculo. Si valores son idénticos, retorna estado actual sin UPDATE ni avance de token. Estado stale falla sin mutación parcial, aun para no-op. Trigger monotónico equivalente al de TASK-006 sólo para PatientCenter. Person global no se edita y no necesita CAS de edición.
- **Ventajas:** consistente con TASK-006 y sin columna nueva; detectar edición perdida.
- **Riesgos:** orden de locks y monotonicidad deben probarse con carreras reales; no copiar el aggregate PC–Specialty, que aquí no existe.
- **Impacto futuro:** TASK-009 tendrá su propia concurrencia de reservas; `updated_at` de PatientCenter queda disponible para UX administrativa.

### D7 — Superficie de lista y formulario

- **Problema:** tabla completa con PII/notas es densa en móvil; una página de detalle añade navegación al MVP.
- **Opciones:** (A) listado con panel/modal de alta y administración; (B) listado + detalle dedicado.
- **Decisión aprobada:** A. Tabla desktop con nombre, documento, nacimiento, teléfono, email, cobertura, estado y acción; sin notas en tabla. En móvil tarjetas compactas con nombre/teléfono/estado y drawer adaptable que puede ocupar pantalla completa. Filtro activo/inactivo; buscar desde servidor con límites. Alta staged y confirmación de link/reactivación en panel. No crear página de detalle salvo requisito técnico demostrado.
- **Ventajas:** flujo de Recepción rápido, menor routing, reutilizable como selector futuro.
- **Riesgos:** formulario largo en modal puede ser incómodo; panel lateral o diálogo adaptable con foco/accesibilidad.
- **Impacto futuro:** TASK-009 puede enlazar a la pantalla o reutilizar query de búsqueda; detalle separado sólo si surgen historias más complejas.

### D8 — Verificación de nacimiento al vincular identidad existente

- **Problema:** un documento exacto por sí solo puede asociar accidentalmente al Center una identidad global incorrecta.
- **Opciones:** (A) comparar fecha ingresada en servidor/DB sin devolver la almacenada y bloquear mismatch; (B) permitir vínculo con advertencia; (C) mostrar fecha almacenada para confirmación.
- **Decisión aprobada:** A. Resolve recibe nacimiento ingresado y devuelve sólo `birth_date_matches`. Link y reactivation vuelven a comparar en PostgreSQL bajo locks; mismatch produce error estable y **cero mutaciones**. La fecha almacenada nunca sale del resolve. La confirmación explícita sólo habilita la operación cuando hay match.
- **Ventajas:** segunda verificación sin divulgar el dato global en el resolve.
- **Riesgos:** fecha mal registrada bloquea vínculo legítimo hasta un futuro flujo de corrección; el booleano sigue siendo un oráculo limitado y requiere controles de abuso.
- **Impacto futuro:** cualquier alta inline en TASK-009 deberá respetar el mismo gate; no se implementa en TASK-007.

## Contrato DB/API exacto propuesto para review

### Lecturas: policies y grants

Una migration incremental agregaría exactamente dos policies SELECT y grants de tabla. La condición de `patient_centers` es `private.has_active_center_role(center_id, ARRAY['ADMIN','RECEPTION']::public.membership_role[])`. La condición de `persons` es `EXISTS` sobre `public.patient_centers pc` con `pc.person_id = persons.id` y ese mismo helper aplicado a `pc.center_id`. La policy de PatientCenter no consulta Person, para evitar recursión; el índice `(person_id)` ya soporta el `EXISTS`. El review verificará que una Person sea visible sólo si el actor puede ver al menos una relación de su Center, sin exponer las relaciones de otros Centers.

Se propone `GRANT SELECT ON public.persons, public.patient_centers TO authenticated` y ningún grant a `anon` ni `PUBLIC`. RLS restringe filas; ADMIN/RECEPTION pueden leer todas las columnas de sus PatientCenters, incluidas notas administrativas según D1. No hay policies INSERT/UPDATE/DELETE ni grants DML para roles API. No se toca la policy de `centers`, `center_memberships`, Professionals u otras tablas. `private.normalize_document` conserva sus revocaciones; la RPC `SECURITY DEFINER` puede usarla internamente.

La query interna `listPatientCenters(centerId, {query, state, limit, offset})` invoca la RPC tenant definida abajo y recibe `patient_center_id`, `person_id`, nombre/apellido, nacionalidad, documento, nacimiento, teléfono, email, cobertura, estado y `updated_at`; **no proyecta notas en el listado**. `getPatientCenter` usa SELECT/RLS sobre la relación y Person vinculada y sí lee notas para el panel. La RPC acepta una sola consulta literal, no `kind`, nombres de campo, expresiones SQL, orden ni comodines definidos por el caller. `query` NULL o vacío tras `private.trim_patient_input` significa listado paginado tenant; un miss nunca invoca resolve global. Cada lectura lleva `center_id` explícito además de las barreras RLS/RPC.

**Contrato autoritativo de búsqueda P007-R1.** Zod/server y RPC aplican la misma entrada: `query` opcional (`NULL` o cadena que queda vacía tras `PATIENT_EDGE_WHITESPACE` → listado); si se envía texto, aplicar primero el trim canónico descrito abajo y exigir longitud resultante `<=100` caracteres, sin truncar; `state` opcional, `NULL`/omitido → `ACTIVE`, y sólo `ACTIVE | INACTIVE | ALL`; `limit` omitido → 25, pero NULL explícito o cualquier entero fuera de `1..50` → `22023 INVALID_PATIENT_INPUT`, sin clamp; `offset` omitido → 0, pero NULL explícito o entero fuera de `0..10000` → el mismo error. La RPC valida antes de consultar, incluso en llamada directa. Tipos no enteros o UUID mal formados son rechazados por el tipado de argumentos PostgreSQL antes de entrar en la función (`22P02` u error equivalente) y la capa web los mapea a input inválido; no pueden abrir una búsqueda sin límite. La UI ofrece solamente esos tres estados. Un actor no autorizado falla antes de evaluar identidad o búsqueda. `"   "`, `"\t"`, `"\n"` y `" \t\r\n "` son la misma query vacía y producen listado tenant paginado, nunca resolve global.

Con consulta no vacía, el predicado se aplica **sólo** a PatientCenters del Center autorizado. Documento: `persons.normalized_document = private.normalize_document(query)` si el canónico no es vacío; igualdad exacta, sin prefijos. Nombre/apellido: subcadena literal case-insensitive de `lower(private.trim_patient_input(first_name))` o `lower(private.trim_patient_input(last_name))`, opcionalmente nombre completo concatenado en orden visible. Teléfono: subcadena literal sobre `private.trim_patient_input(phone)`; el MVP no elimina dígitos, signos ni separadores y preserva el valor guardado tras trim. Email: subcadena literal case-insensitive sobre `lower(private.trim_patient_input(email))` cuando no es NULL. Para texto se propone `position(normalized_query in normalized_field) > 0`, sin `LIKE/ILIKE`; `%`, `_` y `\\` son datos literales. Si se cambia a `LIKE/ILIKE` durante implementación, la RPC deberá escapar patrón y probar el mismo contrato literal. La combinación es OR entre esos campos permitidos, sin búsqueda global. Orden determinista `lower(private.trim_patient_input(last_name)), lower(private.trim_patient_input(first_name)), patient_center_id` y después `LIMIT/OFFSET` ya validados. No se propone índice nuevo antes de medir el plan real.

### RPCs de mutación y resolve

Los nombres y firmas siguientes son el contrato propuesto; el review independiente puede señalar una corrección necesaria antes de IMPLEMENT. `p_center_id` es contexto obligatorio de autorización y relación, **no** un cuarto campo del criterio de identidad global. Todas las funciones son `SECURITY DEFINER`, `SET search_path = ''`, referencias calificadas, `auth.uid()` obligatorio, guardas ADMIN/RECEPTION y Center activo antes de leer identidad y tras el lock de Center, `REVOKE ALL ... FROM PUBLIC, anon, authenticated` seguido de `GRANT EXECUTE` por **firma exacta** sólo a `authenticated`.

| Función propuesta | Argumentos en orden | Retorno mínimo / semántica |
| --- | --- | --- |
| `public.staff_search_patient_centers` | `(p_center_id uuid, p_query text DEFAULT NULL, p_state text DEFAULT NULL, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)` | Lista paginada sólo de PatientCenters del Center autorizado. `p_state` NULL equivale a ACTIVE; `p_limit`/`p_offset` NULL explícitos son inválidos. Predicado literal y cotas P007-R1 dentro de la RPC; proyección sin notas ni Persons no vinculadas. |
| `public.staff_resolve_patient_identity` | `(p_center_id uuid, p_nationality_code text, p_document_number text, p_birth_date date)` | Si no existe, `identity_status=NOT_FOUND` sin identidad. Si existe: `identity_status=FOUND`, `first_name`, `last_name`, `birth_date_matches boolean`, `relationship_state=NOT_LINKED/ACTIVE/INACTIVE`. `person_id`, `patient_center_id` y `patient_center_updated_at` son técnicos opacos **sólo cuando birth_date_matches=true**; con mismatch son NULL. Nunca fecha almacenada ni datos de otros Centers. |
| `public.staff_create_patient_with_center` | `(p_center_id uuid, p_first_name text, p_last_name text, p_birth_date date, p_nationality_code text, p_document_number text, p_phone text, p_email text, p_insurance_name text, p_administrative_notes text)` | Crea Person sólo si la clave global no existe y su PatientCenter en la misma transacción; retorna `person_id`, `patient_center_id`, `updated_at`, `outcome=CREATED`. Si apareció identidad, `PATIENT_IDENTITY_ALREADY_EXISTS` y rollback íntegro; exige nuevo resolve. |
| `public.staff_link_person_to_center` | `(p_center_id uuid, p_person_id uuid, p_nationality_code text, p_document_number text, p_birth_date date, p_phone text, p_email text, p_insurance_name text, p_administrative_notes text, p_confirmed boolean)` | Revalida clave global y nacimiento; `p_confirmed=true` obligatorio. Si no hay relación, crea una y retorna `LINKED`. Si ya está ACTIVE, retorna ID/estado `ALREADY_ACTIVE` sin sobrescribir datos. Si está INACTIVE, exige RPC de reactivación; no altera datos. Mismatch siempre aborta antes de crear relación. |
| `public.staff_reactivate_patient_center` | `(p_center_id uuid, p_patient_center_id uuid, p_nationality_code text, p_document_number text, p_birth_date date, p_expected_updated_at timestamptz, p_confirmed boolean)` | Revalida Person y nacimiento bajo locks; si INACTIVE y CAS coincide, pone `is_active=true` conservando phone/email/insurance/notes. Si ya ACTIVE y snapshot actual coincide, no-op; snapshot stale falla. |
| `public.staff_update_patient_center` | `(p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz, p_phone text, p_email text, p_insurance_name text, p_administrative_notes text)` | Edita sólo cuatro campos propios del Center. Puede editar relación activa o inactiva con CAS; no toca Person ni estado. Valores idénticos son no-op. |
| `public.staff_deactivate_patient_center` | `(p_center_id uuid, p_patient_center_id uuid, p_expected_updated_at timestamptz, p_confirmed boolean)` | Requiere confirmación y CAS; marca `is_active=false` sin borrar ni tocar Person. Ya inactiva con token actual es no-op. No exige DOB porque reduce actividad y no vincula identidad. |

Las RPCs retornan sólo la proyección o el estado y los IDs/tokens necesarios para refrescar UI; las de mutación nunca devuelven notas ni datos globales de otros Centers. El resolve no se invoca desde la búsqueda cotidiana. El servidor valida el `confirmed` de link/reactivación/desactivación; el booleano SQL exige intención explícita en la llamada pero no sustituye la confirmación visible en la UI.

### Validación y normalización

**PATIENT_EDGE_WHITESPACE — contrato propio de TASK-007.** El conjunto exacto para quitar caracteres sólo de ambos extremos es: U+0009 TAB, U+000A LF, U+000B VT, U+000C FF, U+000D CR y U+0020 SPACE. No incluye otros caracteres Unicode ni depende de locale. En TypeScript, el helper compartido `trimPatientInput(value)` tiene semántica exacta `value.replace(/^[\u0009-\u000D\u0020]+|[\u0009-\u000D\u0020]+$/g, "")`; Zod/server debe usarlo y no `String.trim()`. En PostgreSQL, `private.trim_patient_input(text)` elimina de ambos extremos exactamente el mismo conjunto mediante `btrim(value, explicit_character_set)` o expresión equivalente, nunca `btrim(value)` sin segundo argumento. El helper vive en schema privado, es determinista para el mismo input y no concede `EXECUTE` a actores API. Un TAB interno permanece como dato del helper; cada validador de campo decide si lo admite (email no lo admite).

El trim canónico se aplica **antes** de validar o normalizar `first_name`, `last_name`, documento crudo, `phone`, email opcional, `insurance_name`, `administrative_notes` y query tenant. Para documento, el orden es trim canónico → longitud del valor crudo ya recortado `1..100` → `private.normalize_document` → canónico documental no vacío. La función documental PostgreSQL sigue siendo autoridad final de canonicalización y UNIQUE; el helper de borde no modifica su algoritmo ni las claves existentes. `nationality_code` usa también el mismo edge trim antes de uppercase y validación ISO, evitando otra divergencia en ese input.

| Input | `trimPatientInput` y `private.trim_patient_input` |
| --- | --- |
| `""` | `""` |
| `" "` | `""` |
| `"\t"` | `""` |
| `"\n"` | `""` |
| `"\r\n"` | `""` |
| `" \t\r\n "` | `""` |
| `" abc "` | `"abc"` |
| `"\tabc\t"` | `"abc"` |
| `"\nabc\r"` | `"abc"` |
| `"a\tb"` | `"a\tb"` |

**Contrato compartido P007-R2.** Zod y cada RPC que acepta un campo usan el helper de borde anterior y repiten las mismas normalizaciones, límites y rechazos; ninguna llamada directa puede saltarlos. No se truncan valores. Exceso de longitud o combinación inválida produce `22023 INVALID_PATIENT_INPUT` antes de mutar. La constraint actual de Person comprueba sólo dos letras; la migration de implementación añadirá `private.is_valid_patient_nationality_code(text)` con el conjunto de códigos **oficialmente asignados** ISO 3166-1 alpha-2, excluyendo códigos reservados/privados como `ZZ`, inmutable y sin grants a roles API. El conjunto se fija en un snapshot versionado al implementar, con su fecha/fuente registradas; TypeScript/Zod usa la misma lista versionada y tests contractuales comparan el conjunto completo SQL/TS, además de casos representativos. No se crea tabla/catálogo de países. Trim canónico + uppercase preceden al check en ambas capas: `AR`, `US` y minúsculas normalizables son válidos; `ZZ`, longitud distinta de dos y caracteres no alfabéticos son inválidos. Esta función se usa en resolve, create, link y reactivate; un código no reconocido nunca alcanza la creación de Person.

Para email opcional de PatientCenter hay **dos pasos separados**: (1) aplicar PATIENT_EDGE_WHITESPACE; si el resultado es vacío, persistir NULL; (2) si es no vacío, aplicar sin cambios el contrato probado de TASK-006, incluida normalización lowercase y validación con `private.is_valid_professional_email(text)` en RPC y los mismos casos de `src/modules/professionals/schemas/professional-email.ts` y `professional-email-contract-cases.json` en Zod. No se modifica TASK-006. La normalización final es `lower(patient_edge_trim(email))`; el `btrim` interno del helper existente no sustituye el paso 1. Total `<=320`, exactamente un `@`, local no vacío `<=64`, dominio no vacío `<=255`, sin whitespace interno; local ASCII `[a-z0-9_+.'-]`, sin punto inicial/final/doble ni apostrofe final; dominio sin punto inicial/final/doble, etiquetas ASCII DNS de `<=63` sin guion inicial/final y TLD alfabético de al menos dos letras. La RPC rechaza email no vacío inválido aunque se invoque directamente. No introducir una regex nueva divergente.

| Campo | Regla Zod y RPC idéntica |
| --- | --- |
| `first_name`, `last_name` | Edge trim canónico; longitud resultante `1..100`. Vacío tras trim, incluidas tabulaciones/saltos de línea solos, es inválido. |
| `document_number` | Edge trim canónico → longitud cruda recortada `1..100` antes de canonizar → `private.normalize_document` no vacío. Separadores-only inválido; ceros iniciales preservados. |
| `phone` | Edge trim canónico, requerido, longitud resultante `1..50`; `"   "`, `"\t"` y `"\r\n"` son inválidos; `" 123 "` persiste como `"123"`. No validar números internacionales ni quitar signos/separadores. |
| `email` | Edge trim canónico; vacío (también TAB/CR/LF y mezclas) → NULL; de otro modo contrato TASK-006 y `<=320`. |
| `insurance_name` | Edge trim canónico, `<=160`; vacío (también TAB/CR/LF y mezclas) → NULL. Texto, no catálogo. |
| `administrative_notes` | Edge trim canónico, `<=4000`; vacío (también TAB/CR/LF y mezclas) → NULL. Sólo uso administrativo. |
| `query` tenant | Edge trim canónico, longitud resultante `<=100`; NULL/vacío (también TAB/CR/LF y mezclas) → listado tenant paginado. |

Los máximos se miden en caracteres/code points (`char_length` en PostgreSQL y `Array.from(value).length` en TypeScript, no `string.length` UTF-16); los tests incluyen bordes ASCII y Unicode. La autoridad de `normalized_document` y unicidad sigue en PostgreSQL; TypeScript sólo replica la validación temprana. Las RPCs validan también UUID/contexto, booleanos de confirmación, estado allowlisted y parámetros de página según P007-R1.

### Día local autoritativo P007-R3

`birth_date` es una fecha civil pura. La única primitiva temporal de TASK-007 será `private.center_local_date_at(p_timezone text, p_instant timestamptz) -> date`, con semántica exacta `(p_instant AT TIME ZONE p_timezone)::date`. Vivirá en schema privado, sin grants tenant ni parámetro de reloj en las RPC públicas. Su resultado es determinista para zona e instante fijos bajo la base de zonas instalada. La RPC autoriza primero y lee `centers.timezone` IANA del Center autorizado; después fija `v_center_local_today = private.center_local_date_at(authorized_center.timezone, statement_timestamp())`. El cliente nunca controla timezone, instant ni today. No usar `CURRENT_DATE`, timezone de sesión, reloj del navegador ni `now()` de una transacción iniciada antes. Si la zona del Center es inválida, fallar cerrado; no asumir UTC ni modificar administración de timezones. Para crear Person, `birth_date > v_center_local_today` produce `22023 INVALID_PATIENT_INPUT` antes de INSERT o revierte íntegramente la transacción: cero Person, cero PatientCenter y cero estado parcial. Resolve, link y reactivate consumen la misma primitiva/regla al validar la fecha ingresada; la comparación D8 con la fecha almacenada sigue siendo obligatoria y separada.

Zod/servidor puede dar feedback temprano usando una fecha local calculada en servidor a partir de `center.timezone` y el instante de esa solicitud, nunca desde el navegador. El borde de medianoche puede invalidar ese precheck mientras se completa el formulario: la RPC vuelve a calcular el día al iniciar la invocación y prevalece. La UI actualiza el mensaje según el error DB. No se agrega CHECK estructural dependiente del reloj a `persons.birth_date`.

La prueba temporal se divide en dos niveles. **A — contrato determinista:** invocar directamente `private.center_local_date_at` en DB con instantes fijos, sin esperar al reloj real: `America/Argentina/Buenos_Aires` + `2026-10-14T02:59:59Z` → `2026-10-13`, y `2026-10-14T03:00:00Z` → `2026-10-14`. El primer instante también demuestra que en UTC es 14 mientras en el Center aún es 13. **B — integración RPC real:** comprobar por catálogo/review de cuerpo que create, resolve, link y reactivate llaman **esa misma primitiva** con `statement_timestamp()` y timezone obtenido del Center autorizado, sin instante de caller; invocar la RPC directamente para aceptar hoy local y rechazar mañana local, verificando cero mutaciones parciales. B no intenta forzar medianoche; A prueba la frontera exacta de la función compartida que B usa.

### Locks, CAS y resultados concurrentes

Orden único de locks para operaciones que resuelven identidad y mutan relación: advisory lock de `salud-plus:patient-identity:<nationality>:<normalized-document>` → advisory lock existente `salud-plus:center:<center-id>` → `SELECT ... FOR UPDATE` del PatientCenter si existe. Los locks de identidad usan el documento canónico derivado por `private.normalize_document`, no el input crudo. Edición y desactivación, que no tocan identidad, toman Center → fila. Ninguna ruta toma Center antes de identidad. Tras Center lock se reautoriza; bajo row lock se releen Person/PatientCenter, se compara nacimiento para link/reactivation y luego CAS. El UNIQUE global y el UNIQUE `(center_id,person_id)` siguen siendo la defensa final, incluidos clientes concurrentes que no respeten advisory locks.

`staff_create_patient_with_center` inserta ambas filas en una única transacción SQL; un conflicto no deja Person huérfana. `create/create` produce un CREATED y un conflicto de identidad que pide re-resolve. `create/link` se serializa por la misma clave y el perdedor re-resuelve; no se vincula por sorpresa. `link/link` produce LINKED y ALREADY_ACTIVE, sin sobrescribir los datos del ganador. `reactivate/reactivate` produce una reactivación y un error stale para el snapshot antiguo. En toda mutación sobre fila existente se compara `expected_updated_at` **antes** de decidir no-op. El trigger PatientCenter se reemplazaría por el patrón monotónico aprobado `greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond')`; Person conserva su trigger actual porque no se edita aquí. Ninguna RPC hace UPDATE artificial cuando el estado solicitado ya coincide.

### Taxonomía de errores propuesta

| SQLSTATE / mensaje estable | Condición | Respuesta UI |
| --- | --- | --- |
| `42501 PATIENT_ACCESS_DENIED` | Sin sesión, rol/membership/Center no permitido | Denegado, sin información de identidad. |
| `22023 INVALID_PATIENT_INPUT` | Bypass directo de Zod, filtro/límite/offset inválido, ISO no reconocido, longitud o email inválidos, fecha futura según Center, documento vacío tras normalización u otro input inválido | Mostrar campos a corregir, sin mutación ni truncamiento. |
| `P0001 PATIENT_IDENTITY_ALREADY_EXISTS` | Create perdió carrera o identidad ya existe | Volver a resolve explícito; no link automático. |
| `P0001 PATIENT_IDENTITY_MISMATCH` | `person_id` no coincide con clave documental recibida | Reiniciar resolve; no revelar otro Person. |
| `P0001 PATIENT_BIRTH_DATE_MISMATCH` | Fecha ingresada difiere de la almacenada | Bloquear vínculo/reactivación; nunca mostrar fecha almacenada. |
| `P0001 STALE_PATIENT_CENTER_STATE` | Token CAS difiere o estado esperado cambió | Refrescar y pedir nueva confirmación. |
| `P0001 PATIENT_RELATIONSHIP_INACTIVE` | Link encontró relación inactiva | Mostrar camino de reactivación, conservando datos. |
| `P0002 PATIENT_CENTER_NOT_FOUND` | ID inexistente o ajeno al Center | Mensaje genérico y refresh; sin revelar ownership. |
| `23505` manejado de forma estrecha | UNIQUE global o por Center aun bajo carrera no cooperativa | Mapear a re-resolve/stale según constraint; nunca ignorar ni reintentar con otra identidad automáticamente. |

En mismatch, no se devuelven datos de contacto, DOB almacenada ni estado de otros Centers. Las operaciones resuelven autorización antes de reportar errores de existencia. Logs no incluyen documento completo, notas ni fecha de nacimiento.

La taxonomía interna distingue `INVALID_PATIENT_INPUT`, `FORBIDDEN` (`PATIENT_ACCESS_DENIED`), `BIRTH_DATE_MISMATCH`, `PATIENT_ALREADY_ACTIVE` (`ALREADY_ACTIVE`, outcome sin error) y `STALE_PATIENT_CENTER` (`STALE_PATIENT_CENTER_STATE`). UI y llamada directa reciben la misma regla DB; Zod sólo adelanta feedback. `NOT_FOUND` del resolve es necesario para el alta staged y no devuelve campos de Person. No agregar códigos que permitan distinguir un Person o Center ajeno más allá de la respuesta mínima D3.

### Límite de privacidad y contrato con el schema

No hay contradicción estructural entre D1–D8 y las columnas/constraints versionadas: `birth_date` ya es NOT NULL global; `patient_centers` ya es único por `(center_id,person_id)` y conserva los cuatro campos administrativos aprobados. El schema no impide `birth_date` futura por sí solo; la RPC la rechaza usando el día local del Center. El exact resolve conserva capacidad residual de inferir existencia global con intentos repetidos, y el error de create por identidad existente es un oráculo equivalente. **ACCEPTED RISK para MVP**, según el review: requiere actor autenticado con membership ADMIN/RECEPTION activa, clave exacta nacionalidad+documento, no hay directorio global, respuesta mínima y mismatch sin fecha real. **Hardening obligatorio PRE-PROD:** control concreto de abuso/rate limiting y monitoring del resolve **y** create/error antes de exposición pública; no se implementa en TASK-007. No se modifica D3/D8. Una Person ya vinculada puede verse por lectura tenant aprobada, incluida su DOB; esa lectura no amplía la salida del resolve global.

## Secuencia de implementación propuesta, pendiente de review y autorización

1. **Gate de baseline:** releer brief/plan y review independiente; verificar rama, único cambio ajeno, 17 migrations y catálogo DEV read-only. Capturar baseline DEV por IDs/contenido y comprobar CLI/ruta DEV antes de planificar aplicación de migrations. Ninguna consulta a PROD. Si el catálogo o baseline difieren, detener IMPLEMENT y revisar plan.
2. **DB/API:** migration incremental para las dos policies/grants SELECT aprobados, siete RPCs estrechas detalladas arriba y trigger monotónico PatientCenter. `SECURITY DEFINER`, `search_path=''`, nombres calificados, `auth.uid()` + rol/Center activos, `REVOKE` público y `GRANT EXECUTE` por firma a `authenticated`. No DML genérico ni SELECT global para resolver. Outcomes y errores estables; IDs ligados a Center y clave confirmada. Regenerar tipos desde DEV sólo en IMPLEMENT autorizado.
3. **Módulo server:** en `src/modules/patients/`, schemas Zod de resolve/create/link/reactivate/update/deactivate y filtros; queries server-only tenant; operaciones server-only que autorizan con `requireRole(centerId, ['ADMIN','RECEPTION'])`, invocan RPC y mapean errores. Mantener el cliente Supabase de sesión del actor; no usar secret key/service role como atajo.
4. **Adaptadores web y UI:** `src/app/centers/[centerId]/patients/page.tsx` sólo valida ruta, aplica guard y compone la pantalla; loading opcional. Server Actions delgadas en el módulo validan FormData, reautorizan, delegan y revalidan ruta tras commit. No Route Handler para la app propia. `patients-screen` y drawer adaptable concentran presentación, no reglas de DB.
5. **Verificación y review de implementación:** tests focalizados y regresiones; verificación DEV con fixtures propios y cleanup exacto; review funcional, Database/RLS y Security; sólo entonces actualizar `docs/modules/patients.md`, arquitectura/decisiones si cambian, `docs/status.md` y considerar cierre. Este paso es futuro y no está autorizado por este documento.

## Estados de UI y límites de exposición

La ruta muestra listado `loading`, vacío sin pacientes, resultados filtrados, cero coincidencias tenant, error recuperable y paginación; permite incluir inactivos. La acción **Registrar paciente** abre el drawer: (1) nacionalidad/documento/nacimiento, (2) resolve solicitado expresamente, (3a) NOT_FOUND → formulario de nueva Person y datos administrativos, (3b) FOUND + DOB match → nombre/apellido y relación de este Center, confirmación de vínculo o reactivación, (3c) DOB mismatch → bloqueo sin datos adicionales ni botón de mutación. ACTIVE abre el registro existente. Un stale refresca el snapshot y exige repetir confirmación. Tras commit se revalida desde servidor; no hay actualización optimista de datos sensibles. El panel de administración muestra los globales de solo lectura y edita sólo PatientCenter; las notas se etiquetan como administrativas. En móvil el drawer ocupa pantalla completa con foco, cierre y mensajes accesibles.

El listado desktop proyecta email opcional y cobertura; las notas nunca aparecen en la tabla ni en resultados de búsqueda. La búsqueda diaria no dispara resolve global al quedar vacía. El resolve no recibe nombre, teléfono ni email como criterio y no retorna DOB almacenada. La UI nunca muestra IDs/tokens opacos.

## Matriz mínima de verificación para IMPLEMENT

| Capa | Escenarios imprescindibles |
| --- | --- |
| Unit/component | normalización numérica/alfanumérica, `00123`, espacios/puntos/guiones, sólo separadores, ISO y fecha real/no futura; trim y opcional vacío → NULL; alta staged, DOB match/mismatch, confirmación explícita, lista móvil, email opcional visible, notas fuera de tabla, búsqueda vacía sin resolve, stale/no-op y errores de colisión. |
| DB catálogo/RLS/RPC | dos policies, SELECT grants, siete firmas EXECUTE exactas, ninguna escritura genérica; `anon` deny, ADMIN y RECEPTION allow, PROFESSIONAL y PLATFORM_ADMIN-only deny, membership/Center inactivos deny, cross-center deny, Person vinculada visible sólo donde corresponde; búsqueda tenant y salida exacta del resolve sin DOB almacenada/otros Centers. |
| P007-R1 búsqueda directa | `limit` omitido=25, 1 y 50 aceptados; NULL explícito, 0 y 51 rechazados; `offset` 0/10000 aceptados, negativo/10001/NULL rechazados; query NULL/vacía/solo TAB/solo LF/whitespace mixto lista tenant; longitud tras trim >100 rechazada; estado ACTIVE/INACTIVE/ALL y filtro no admitido rechazado; `%`, `_` y `\\` literales; documento exacto canónico, nombre case-insensitive, teléfono con edge trim, email lowercase, orden determinista y aislamiento tenant. Invocación RPC directa y Zod deben coincidir. |
| P007-R2 contratos directos | Matriz PATIENT_EDGE_WHITESPACE idéntica para helper TS y SQL: vacíos, espacio, TAB, LF, CRLF, mixto en bordes, `" abc "`, `"\tabc\t"`, `"\nabc\r"`, TAB interno preservado. Phone sólo TAB/CRLF inválido; email/cobertura/notas sólo TAB/CRLF → NULL; edge whitespace mixto igual en ambas capas. ISO `AR`, `US`, minúsculas válidas; `ZZ`, longitud distinta de dos y símbolos inválidos; paridad ISO completa. Reusar matriz TASK-006 de email válido/inválido y límites. Cada longitud máxima aceptada y máxima+1 rechazada para nombre, documento ya recortado, teléfono, email, cobertura, notas y query; separadores-only rechazado; Unicode/code points, sin truncar ni bypass RPC. |
| P007-R3 día local | Test A: helper privado con instantes fijos BA `2026-10-14T02:59:59Z` → 13 y `2026-10-14T03:00:00Z` → 14; mismo instante UTC con distinto día civil del Center. Test B: catálogo/cuerpo verifica que RPC usa helper + `statement_timestamp()` + timezone autorizado; RPC directa acepta hoy local y rechaza mañana con cero Person/PatientCenter/estado parcial. Zona IANA inválida falla cerrada; no esperar medianoche real. |
| Integridad/concurrencia | UNIQUE global y por Center; documento con variantes, nacionalidad distinta, separadores-only, DOB futura; create/create, create/link, link/link, reactivate/reactivate bajo locks observados; active reuse, inactive reactivation que preserva cuatro campos; mismatch en link/reactivate con cero cambios; stale edit/deactivate/reactivate; no-op sin token nuevo; `updated_at` monotónico; rollback sin Person huérfana. |
| E2E | Recepción lista/busca por cuatro criterios/crea/vincula/reactiva/edita/desactiva y lee notas; Admin permitido; Professional denegado; filtros y móvil; DOB mismatch bloqueado; confirmación, refresh/stale y no auto-resolve tras búsqueda sin resultados. Fixtures propios por UUID. |
| Manual smoke | Recepción en desktop/móvil, email y notas administrativas, confirmación de identidad, mismatch y recarga; registrar evidencia humana separada de Playwright. |
| DEV hygiene | snapshot baseline DEV antes/después por IDs y contenido, ownership y cleanup exacto por UUID en orden FK, sin borrar datos persistentes; 17 migrations de partida, dry-run/lint DEV y tipos generados sin drift. Sin PROD. |

## Estrategia de baseline y cleanup para IMPLEMENT futuro

**Gate antes de crear o aplicar la primera migration:** restaurar acceso read-only del Supabase CLI, verificar paridad de migrations locales/DEV, catálogo vivo relevante (tablas, triggers, policies, grants y firmas) y baseline DEV por IDs/contenido. Si falla cualquiera, detenerse y revisar el plan. Antes de ejecutar pruebas con escritura, identificar el proyecto DEV por ref; comparar también dry-run y snapshot persistente, no sólo conteos. El digest histórico `e25c76ea22daa7c50273affef4d7b2c22b73883d047db5b3ebb6b3ccc6158e7a` es evidencia de TASK-006; no asumir que sigue siendo el baseline actual sin una lectura nueva. Inventariar exactamente Center/User/membership y cualquier Person/PatientCenter persistente antes de crear fixtures.

Las pruebas transaccionales SQL hacen rollback cuando sea posible. E2E y concurrencia que requieran commits usan namespace e IDs propios y guardan ownership de cada Auth User, membership, Person y PatientCenter creado. Cleanup por UUID exacto y orden FK inverso; antes de borrar, verificar el grafo de ownership y ausencia de referencias ajenas o turnos. Si hay ambigüedad, detener cleanup y pedir decisión humana sobre esos IDs; jamás usar `LIKE`, prefijos amplios, reset ni borrado de datos persistentes. Comparar snapshot/digest después de cleanup con el baseline aprobado y registrar cualquier diferencia. Nunca consultar ni mutar PROD.

## Gate final de este PLAN

D1–D8 tienen aprobación humana. P007-R1/R2/R3 permanecen abiertos en `review.md` hasta que un **re-review independiente** valide esta segunda remediación; este plan no los marca CLOSED. La aprobación de diseño no autoriza SQL, código ni mutaciones DEV. Estado: `DESIGN APPROVED — SECOND PLAN REMEDIATION COMPLETE — AWAITING INDEPENDENT RE-REVIEW — IMPLEMENTATION NOT AUTHORIZED`.
