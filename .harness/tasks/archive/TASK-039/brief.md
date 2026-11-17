# TASK-039 — Seguridad y privacidad de pacientes

**Fase A:** aprobada. **Fase B:** implementación acotada autorizada; la inferencia mediante `resolve`/`create` queda fuera del alcance y permanece bloqueo PRE-PROD.

**Base revisada:** `origin/main` comprobado mediante fetch, commit `5dde7730e33e7eaf499e177cd658033530882bf0`, en worktree aislado `.worktrees/task-039-phase-a`. El checkout habitual contiene cambios ajenos y no se modificó. `pnpm bootstrap` pasó en ese checkout (Node 24.21.0, pnpm 11.26.0). En el worktree nuevo, la instalación de dependencias intentó acceder al registro y fue interrumpida tras errores `EACCES`; no se atribuye allí un bootstrap completo. No se accedió a Supabase remoto ni se ejecutaron pruebas de DB en esta fase. `docs/status.md` en esta base aún describe TASK-038 como pendiente de PR; para TASK-039 prevalece la instrucción actual de que TASK-038 está cerrada.

## Objetivo e impacto

Impedir que una resolución de identidad con fecha de nacimiento discordante entregue nombre, apellido, identificadores o estado del vínculo. La garantía debe existir en la respuesta de PostgreSQL de `staff_resolve_patient_identity`, accesible directamente por un rol autenticado autorizado, además de expresarse en el contrato Zod y en la interfaz. Conservar la deduplicación global de `Person`, la vinculación legítima entre centros y la autorización tenant.

El cambio funcional previsto es una migration **incremental** para `resolve`, más el contrato y los consumidores afectados. Las migrations históricas permanecen intactas. No se amplían RLS, grants, roles ni lecturas globales. El alcance de esta tarea necesita una decisión explícita sobre el riesgo de inferencia de existencia indicado abajo.

## A. Estado actual

1. `persons` deduplica por `nationality_code + normalized_document` mediante `persons_nationality_document_key`; `patient_centers` impide duplicar `(center_id, person_id)`. `Person` es identidad global y `PatientCenter` contiene los datos administrativos privados del centro. El `SELECT` RLS de `persons` sólo permite personas vinculadas a un centro donde el actor es ADMIN/RECEPTION activo; el lookup global de `resolve` se ejecuta como `SECURITY DEFINER` tras `private.patient_center_timezone(p_center_id)`, que exige ese rol y centro activo.
2. `staff_resolve_patient_identity` valida nacionalidad, documento y fecha civil, busca la `Person` global y devuelve `NOT_FOUND` si no existe. Si existe, compara nacimiento, consulta `patient_centers` del centro solicitado y devuelve `FOUND`, `first_name`, `last_name`, `birth_date_matches` y `relationship_state` aun cuando la fecha no coincide. Sólo los tres identificadores técnicos quedan en `NULL` en esa rama.
3. `staff_create_patient_with_center` vuelve a autorizar, normaliza, bloquea identidad y centro, rechaza cualquier `Person` ya existente con `P0001:PATIENT_IDENTITY_ALREADY_EXISTS` y crea `Person` + `PatientCenter` atómicamente si no existe. El UNIQUE protege también la carrera. `staff_link_person_to_center` exige `person_id`, documento, nacionalidad, nacimiento y confirmación, repite comprobaciones bajo locks y crea sólo el vínculo local. `staff_reactivate_patient_center` exige vínculo local, nacimiento, confirmación y CAS por `updated_at`; conserva sus datos administrativos.
4. `patient-rpc-contracts.ts` admite una rama `FOUND`/`birth_date_matches: false` con nombre, apellido y estado `NOT_LINKED|ACTIVE|INACTIVE`. `patient-rpc-adapter.ts` valida la respuesta después de recibirla; por tanto no puede evitar la exposición en la respuesta de la Data API. La Server Action `resolvePatientAction` devuelve la fila al navegador. `patient-workspace.tsx` muestra una advertencia neutral y bloquea mutaciones en el registro con fecha discordante, pero recibe previamente el payload completo. Administración usa `resolve` también antes de reactivar un paciente ya visible en el centro.
5. La migration posterior `20261013200000_remove_patient_rpc_unused_variables.sql` sustituye `search`, `update` y `deactivate`; no altera `resolve`, `create`, `link` ni `reactivate`. La búsqueda y el detalle de pacientes siguen limitados a vínculos del propio centro y no son el lookup global problemático.

## B. Vulnerabilidades confirmadas

**Exposición directa:** con nacionalidad y documento correctos y nacimiento incorrecto, la respuesta SQL entrega nombres y apellidos de la identidad global. Entrega también si hay vínculo en el centro solicitado y si está activo. Para una `Person` todavía no vinculada a ese centro, esos datos atraviesan la barrera que de otro modo impone RLS. No entrega fecha almacenada ni los UUID en esa rama. La advertencia visual de TASK-028 no cambia esta respuesta ni la de la Server Action.

**Inferencia de existencia, separada:** `NOT_FOUND` frente a `FOUND` con `birth_date_matches: false` permite deducir que el par nacionalidad/documento existe; la variante `create` devuelve `PATIENT_IDENTITY_ALREADY_EXISTS` para ese mismo par aun si se saltea el flujo UI. Su mapeo a `identity_race` y su mensaje visible forman otra señal. Los resultados `FOUND` con nacimiento correcto y las diferencias de error de `link` también pueden funcionar como oráculos bajo sus precondiciones. La propuesta de contrato de esta fase **no elimina** la inferencia por `resolve`/`create`; no se declarará resuelta por retirar nombres y apellidos. La fecha de nacimiento sola tampoco constituye una prueba fuerte de identidad; es una condición del flujo MVP existente.

## C. Contrato de respuesta propuesto

Conservar las ocho columnas y la firma de entrada de `resolve` para un cambio acotado; definir estas variantes estrictas y mutuamente excluyentes:

| Resultado | `identity_status` | `birth_date_matches` | `first_name`, `last_name`, `relationship_state`, `person_id`, `patient_center_id`, `patient_center_updated_at` |
| --- | --- | --- | --- |
| Sin coincidencia de nacionalidad/documento | `NOT_FOUND` | `NULL` | todos `NULL` |
| Identidad encontrada, nacimiento discordante | `UNVERIFIED` | `false` | todos `NULL` |
| Identidad y nacimiento coincidentes | `FOUND` | `true` | nombres y `person_id` presentes; estado sólo del centro solicitado; IDs del vínculo y CAS presentes sólo para `ACTIVE`/`INACTIVE` |

`UNVERIFIED` evita llamar `FOUND` a una identidad no verificada, pero **sigue distinguiéndose de `NOT_FOUND` y por ello revela existencia**. El SQL debe retornar la fila de discordancia inmediatamente después de comparar fechas, antes de consultar la relación; el contrato Zod debe rechazar cualquier dato no nulo en esa variante. El servicio y la Action entregarán sólo la fila validada; la garantía principal es el retorno SQL, no una limpieza posterior en TypeScript. `create`, `link`, `reactivate` y sus resultados de éxito conservan semántica y condiciones DB mientras se decide la mitigación de inferencia.

## D. Archivos afectados previstos

- Nueva migration en `supabase/migrations/` creada con el comando CLI correspondiente, para `CREATE OR REPLACE FUNCTION public.staff_resolve_patient_identity(...)` sin modificar las migrations de 2026-10-13. Verificar firma, `SECURITY DEFINER`, `search_path`, guard de rol/centro y grants efectivos.
- `src/modules/patients/api/patient-rpc-contracts.ts` y `.test.ts`: unión Zod y pruebas negativas de los siete campos confidenciales/nulables. `src/lib/supabase/database.types.ts`: revisar si la introspección regenerada refleja algún cambio; los tipos de transporte no acreditan nulabilidad del `RETURNS TABLE` y pueden quedar sin delta.
- `src/modules/patients/components/patient-workspace.tsx` y `.test.tsx`: tratar `UNVERIFIED` como bloqueo en Registro y Administración; preservar advertencia neutral, borrador, reintento y rutas verificadas. `src/modules/patients/server/patient-management.ts`, `src/modules/patients/actions/patient-actions.ts` y sus tests: revisar tipos derivados y paso de respuesta sin datos extra; ajustar sólo lo necesario. `src/modules/patients/server/patient-errors.ts` y tests: evaluar conjuntamente el oráculo de `create`, sin prometer remediarlo con un cambio cosmético.
- Pruebas SQL focales de `scripts/verify-task007a-migration-smoke.mjs` y `scripts/task007-gate-d/integration.mjs`; inspeccionar y actualizar las expectativas de mismatch y de la proyección exacta. Las fixtures de `scripts/task028-patients-visual.mjs` usan la variante insegura y requieren actualización si se reutilizan. `scripts/verify-task007a-schema-v2.mjs` sólo si el catálogo o el verificador de firma cambia.
- `docs/modules/patients.md` y `docs/status.md` al cierre aceptado para reflejar el contrato efectivo, la evidencia y el riesgo residual. `docs/architecture.md`/`docs/technical-decisions.md` sólo si se adopta una decisión de flujo o autorización nueva.

## E. Plan de implementación tras aprobación

1. Fijar la decisión sobre alcance de inferencia. Si se exige que un cliente no pueda deducir existencia, diseñar antes de implementar un flujo nuevo de registro que no distinga ausencia de discordancia por `resolve` ni por `create`; mantener la deduplicación y resolver cómo autorizar la creación/vinculación sin exponer el resultado. La rama acotada de `UNVERIFIED` sólo remedia exposición directa.
2. Crear una migration incremental que conserve la firma y privilegios de `resolve`, mueva el retorno de discordancia antes del lookup del vínculo y retorne `NULL` tipados en nombre, apellido, estado del vínculo, ambos UUID y token CAS. No alterar el UNIQUE global, las políticas tenant, ni las comprobaciones bajo lock de `create`/`link`/`reactivate`.
3. Actualizar la unión Zod discriminada y consumidores para que cualquier dato de identidad/vínculo en `UNVERIFIED` falle la validación. Mantener los caminos `NOT_FOUND`, `FOUND/NOT_LINKED`, `FOUND/ACTIVE` y `FOUND/INACTIVE`; adaptar Registro y reactivación de Administración al nuevo estado sin abrir confirmaciones indebidas.
4. Ajustar pruebas focales y documentación. Revisar con una prueba SQL local el payload **de la RPC directa** y con pruebas de Action/UI la respuesta de red de la aplicación. Pasar review de seguridad/DB independiente antes de cerrar. No aplicar la migration a DEMO, DEV o PROD bajo la autorización de esta fase.

## F. Criterios de aceptación y validación proporcional

- Para ADMIN/RECEPTION activo del centro A, una `Person` existente sólo en B o sin vínculo, consultada con DOB incorrecta, produce exactamente `UNVERIFIED`, `false` y `NULL` en nombres, estado, UUID y CAS en la **RPC PostgreSQL directa**; tampoco aparece fecha de nacimiento almacenada ni dato de otro centro. Repetir para `Person` vinculada ACTIVE/INACTIVE en A: idéntico payload de discordancia, sin distinguir el vínculo.
- `NOT_FOUND` conserva su fila nula; nacimiento correcto conserva `FOUND` y únicamente el estado/IDs del centro solicitado. `create` no crea duplicados de `Person` y `link` reutiliza la misma identidad entre centros; `reactivate` conserva vínculo y CAS. La carrera de create sigue protegida por UNIQUE y locks.
- Actor `anon`, PROFESSIONAL, PLATFORM_ADMIN sin membership, miembro de otro centro y miembro desactivado no pueden usar la RPC para obtener información; el rol ADMIN/RECEPTION activo sigue autorizado sólo en centro activo. RLS de lecturas tenant, grants y ausencia de DML genérico permanecen.
- Zod rechaza payloads `UNVERIFIED` con cualquiera de los campos protegidos no nulos. La Server Action y la interfaz reciben sólo la proyección segura, muestran la advertencia neutral y bloquean create/link/reactivate con identidad no verificada. El cambio de identidad descarta resultados tardíos; el flujo desde Crear turno y el panel del paciente verificado continúan operativos.
- Verificación prevista: tests de contrato y componentes focales; SQL transaccional en PostgreSQL local/aislado con fixtures sintéticas para las ramas anteriores, permisos, multi-centro y concurrencia relevante; revisión del payload PostgREST/Action en entorno local si está disponible; typecheck, lint y diff check focales. No confundir mocks ni inspección estática con prueba de la función desplegada. Una comprobación remota posterior requerirá autorización separada.
- Revisión independiente de seguridad/DB de la migration y del contrato, con evidencia registrada en el Harness. Sólo después de implementar, verificar y revisar se actualizará el estado de TASK-039 como completado.

## G. Riesgos residuales y decisiones necesarias

1. **Decisión de alcance:** aprobar la corrección acotada de exposición directa con `UNVERIFIED` y mantener la inferencia `resolve`/`create` como bloqueo PRE-PROD explícito, o exigir la eliminación del oráculo de existencia en TASK-039. La segunda opción requiere rediseñar el flujo staged y sus respuestas de error; no basta con cambiar textos, añadir rate limiting o esconder campos en la UI.
2. La combinación nacionalidad/documento/DOB permite a quien conoce o adivina esos datos obtener una identidad verificada y vincularla a otro centro; el contrato propuesto preserva ese comportamiento MVP. Su suficiencia como prueba de identidad requiere decisión de producto/seguridad antes de datos reales en producción.
3. El límite de frecuencia, la detección de abuso y la telemetría para `resolve` y `create` siguen pendientes PRE-PROD. Reducen explotación, pero no sustituyen un contrato que no revele existencia si esa garantía se exige.
4. Esta fase sólo examina código y migrations versionadas. No verifica la definición efectiva de una base remota ni autoriza uso de datos personales reales en PROD.

TASK-039 PHASE A — READY FOR REVIEW
