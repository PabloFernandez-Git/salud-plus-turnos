# Personas y pacientes

## Persona

`Person` representa identidad común dentro de la plataforma.

Criterio principal de deduplicación MVP:

```text
nacionalidad + documento normalizado
```

Coincidencia exacta: reutilizar Persona. Coincidencia ambigua: no fusionar automáticamente.

La nacionalidad usa ISO 3166-1 alpha-2. Se conserva el documento original y PostgreSQL genera el
documento normalizado: trim exterior, uppercase, eliminación de whitespace, puntos, guiones y
variantes tipográficas equivalentes. Preserva los demás caracteres y ceros iniciales, no translitera
ni convierte a número y rechaza un resultado vacío.

## PatientCenter

Representa el registro administrativo de una Persona dentro de un centro.

La misma Persona no puede tener dos `PatientCenter` para el mismo centro.

Datos requeridos al registrar:
- nombre;
- apellido;
- documento;
- fecha de nacimiento;
- nacionalidad;
- teléfono.

Opcionales:
- email;
- obra social/prepaga;
- notas administrativas.

Los datos administrativos son privados por centro. La existencia de una Persona común no revela otros centros ni comparte automáticamente turnos/notas/cobertura.

La UI puede presentar la operación simplemente como “Registrar paciente”.

## Foundation DB/API de TASK-007A (review independiente PASS)

Dos migrations incrementales aplicadas a DEV agregan SELECT tenant bajo RLS para ADMIN y RECEPTION activos: PatientCenters de su Center y Persons vinculadas a una relación visible. No hay DML genérico ni directorio global. La RPC de búsqueda acepta una consulta literal, estado `ACTIVE/INACTIVE/ALL`, límite 1..50 y offset 0..10000. Un resultado vacío no inicia resolve global.

El alta staged usa RPCs separadas para resolve exacto, create, link y reactivate. Resolve compara la fecha ingresada y sólo expone nombres, resultado booleano y estado de relación del Center; no devuelve nacimiento almacenado ni datos de otros Centers. Link y reactivate exigen confirmación y vuelven a comprobar identidad/nacimiento. Update modifica sólo teléfono, email, cobertura y notas; deactivate es lógico. Reactivate conserva la misma relación y sus datos. Las mutaciones de relación usan CAS por `expected_updated_at`, no-op sin UPDATE y trigger monotónico.

Los inputs de pacientes usan edge trim explícito para TAB, LF, VT, FF, CR y SPACE; nacionalidad usa un snapshot versionado de 249 códigos ISO alpha-2, y email opcional reutiliza el contrato TASK-006 tras convertir blanco canónico en NULL. La fecha futura se compara con el día local del Center mediante `private.center_local_date_at(timezone, statement_timestamp())`.

El contrato de aplicación para las siete RPCs vive en `src/modules/patients/api/patient-rpc-contracts.ts` y se valida en `patient-rpc-adapter.ts`. SQL es la autoridad de DB; `database.types.ts` es un artefacto generado de transporte cuya introspección de funciones omite nulabilidad de argumentos y `RETURNS TABLE`. Resolve distingue `NOT_FOUND`, DOB mismatch, `NOT_LINKED`, `ACTIVE` e `INACTIVE`; `NULL` permanece `NULL` en resultados y argumentos administrativos. 007B y 007C+D consumen el adapter, no el resultado raw de `supabase.rpc` para pacientes. El guard de tipos confronta nombres y claves de argumentos con los tipos generados; el schema verifier confronta las siete firmas reales en DEV.

**Estado de foundation 007A:** 007A-IR-1 y 007A-IR-2 `CLOSED`; TASK-007A `IMPLEMENTATION REVIEW PASS — CLOSED`. La comparación V2 detecta drift de metadata e inventario incluso en tablas vacías; el reviewer aceptó evidencia live DEV capturada por la persona usuaria para su gate read-only final. La discrepancia histórica del digest ampliado permanece como **HISTORICAL VERIFICATION GAP**, categoría E, sin equivalencia retrospectiva demostrada. El riesgo de inferencia mediante resolve/create está aceptado sólo para MVP DEV; abuso, rate limiting y monitoreo son requisitos PRE-PROD. Véase `.harness/tasks/active/TASK-007/implementation-report.md`.

## TASK-007B — Listado y búsqueda tenant

La ruta `/centers/[centerId]/patients` permite a ADMIN y RECEPTION activos listar y buscar pacientes vinculados a su Center activo. El guard de servidor se ejecuta antes de interpretar filtros. La RPC `staff_search_patient_centers` vuelve a autorizar y se invoca exclusivamente mediante `callPatientRpc()` con el cliente server de la sesión. PROFESSIONAL y PLATFORM_ADMIN-only no reciben acceso por esta ruta.

La URL pública usa `q`, `state` (`ACTIVE` por defecto, `INACTIVE`, `ALL`) y `page` (1 por defecto). Defaults, parámetros desconocidos/repetidos, valores inválidos y whitespace de bordes se canonicalizan mediante redirect. La consulta admite hasta 100 puntos de código tras el edge trim aprobado. La UI pide 26 filas, presenta 25 y usa la última como lookahead; página máxima 401, offset máximo 10000. Una página mayor que 1 sin resultados redirige a página 1 conservando los filtros. No se hace COUNT ni consulta secundaria de vacíos.

Tabla desktop y tarjetas móviles muestran nombre, documento/nacionalidad, fecha civil de nacimiento, teléfono, email, cobertura y estado. Email/cobertura NULL se representan como `—` sólo en UI. Las notas, IDs internos, tokens y datos de otros Centers no se presentan. El formulario GET reinicia la paginación; loading, error de lectura y cuatro estados vacíos se muestran sin iniciar resolve global. La navegación muestra los cuatro destinos a ADMIN, sólo Pacientes a RECEPTION y ninguno a PROFESSIONAL. No se cambiaron guards de rutas existentes.

**Estado 007B:** listado y búsqueda tenant implementados; `IMPLEMENTATION COMPLETE — VERIFICATION COMPLETE — INDEPENDENT REVIEW PASS — CLOSED`. 007B-IR-1/IR-2/IR-3 `CLOSED`. No hubo delta DB/schema, consultas o mutaciones DEV, ni acceso PROD en este checkpoint. Registro, resolve, link, reactivación, edición y desactivación correspondieron a 007C+D.

## TASK-007C+D — Administración de pacientes

El plan C+D recibió review independiente PASS y autorización conjunta. **GATE C PASS:** la ruta existente añade Registrar paciente explícito y Administrar por fila/tarjeta. `patient=<UUID>` canónico abre un panel sin cambiar `q/state/page`; el panel permite inspeccionar un registro aunque no esté en la página o filtro visibles. En móvil el diálogo ocupa la pantalla y en desktop funciona como panel lateral. El listado sigue siendo una lectura server y no se mantiene una copia de la tabla en el cliente.

Registrar comprueba nacionalidad, documento y fecha ingresada mediante resolve exacto; SEARCH miss nunca inicia resolve. NOT_FOUND crea Person y PatientCenter atómicamente tras revisar nombres y datos administrativos; mismatch de nacimiento bloquea mutación sin revelar la fecha almacenada; NOT_LINKED vincula sólo con confirmación; ACTIVE reutiliza la relación sin mutar; INACTIVE reactiva con confirmación y CAS conservando datos administrativos. La pantalla sólo usa la proyección mínima de resolve y nunca muestra IDs técnicos, datos de otro Center ni fecha almacenada en esa respuesta.

El detalle lee PatientCenter por `center_id` e `id` con RLS y reautorización ADMIN/RECEPTION, y sólo los campos de Person vinculada requeridos para identidad readonly. Notas administrativas se leen y editan sólo dentro del panel, con aviso de no registrar información clínica. La edición afecta únicamente teléfono, email, cobertura y notas; desactivar es lógico y requiere confirmación. Reactivar desde el panel inactivo vuelve a comprobar identidad con DOB ingresada y exige confirmación. Mutaciones con CAS no reintentan ni sobreescriben ante stale; Recargar datos obtiene un token nuevo.

Las seis Server Actions validan Zod, crean cliente de sesión, reautorizan ADMIN/RECEPTION y delegan al servicio `server-only`; todas las RPCs pasan por `callPatientRpc()`. Los resultados y errores se traducen sin SQL ni PII. `UPDATED`, `UNCHANGED`, `DEACTIVATED`, `REACTIVATED` y `ALREADY_ACTIVE` se manejan como outcomes. No se cambiaron migrations, SQL, RLS, grants, RPCs ni tipos generados. Verificación local final: 435/435 tests Vitest y 11/11 tests `node:test`, lint, typecheck y diff check PASS; build y guard de secretos PASS en el gate de implementación previo.

**GATE D automatizado PASS:** integración DB, privacidad multi-Center, carreras/CAS y E2E pasaron. Cleanup por UUID exacto y auditoría posterior restauraron el inventario DEV; paridad 19/19, dry-run, lint, schema/API y Baseline V2 exacto pasaron (`24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`). Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**; no se afirma smoke PASS. El review independiente final fue **PASS**: TASK-007-FIR-1 y FIR-2 `CLOSED`. **TASK-007 CLOSED — READY_FOR_MERGE**; artefactos en `active/` hasta el merge, como TASK-006. **HISTORICAL VERIFICATION GAP: Category E — insufficient evidence**. **PRE-PROD:** exact global resolve/create inference risk, rate limiting, abuse protection y monitoring/telemetry pendientes. PROD fuera de alcance.
