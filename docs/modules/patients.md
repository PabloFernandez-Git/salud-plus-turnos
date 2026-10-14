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

El contrato de aplicación para las siete RPCs vive en `src/modules/patients/api/patient-rpc-contracts.ts` y se valida en `patient-rpc-adapter.ts`. SQL es la autoridad de DB; `database.types.ts` es un artefacto generado de transporte cuya introspección de funciones omite nulabilidad de argumentos y `RETURNS TABLE`. Resolve distingue `NOT_FOUND`, DOB mismatch, `NOT_LINKED`, `ACTIVE` e `INACTIVE`; `NULL` permanece `NULL` en resultados y argumentos administrativos. La futura 007B debe consumir el adapter, no el resultado raw de `supabase.rpc` para pacientes. El guard de tipos confronta nombres y claves de argumentos con los tipos generados; el schema verifier confronta las siete firmas reales en DEV.

**Estado de foundation 007A:** 007A-IR-1 y 007A-IR-2 `CLOSED`; TASK-007A `IMPLEMENTATION REVIEW PASS — READY FOR 007B`. La comparación V2 detecta drift de metadata e inventario incluso en tablas vacías; el reviewer aceptó evidencia live DEV capturada por la persona usuaria para su gate read-only final. TASK-007 completa sigue abierta. La discrepancia histórica del digest ampliado permanece como **HISTORICAL VERIFICATION GAP**, categoría E, sin equivalencia retrospectiva demostrada. El riesgo de inferencia mediante resolve/create está aceptado sólo para MVP DEV; abuso, rate limiting y monitoreo son requisitos PRE-PROD. Véase `.harness/tasks/active/TASK-007/implementation-report.md`.

## TASK-007B — Listado y búsqueda tenant

La ruta `/centers/[centerId]/patients` permite a ADMIN y RECEPTION activos listar y buscar pacientes vinculados a su Center activo. El guard de servidor se ejecuta antes de interpretar filtros. La RPC `staff_search_patient_centers` vuelve a autorizar y se invoca exclusivamente mediante `callPatientRpc()` con el cliente server de la sesión. PROFESSIONAL y PLATFORM_ADMIN-only no reciben acceso por esta ruta.

La URL pública usa `q`, `state` (`ACTIVE` por defecto, `INACTIVE`, `ALL`) y `page` (1 por defecto). Defaults, parámetros desconocidos/repetidos, valores inválidos y whitespace de bordes se canonicalizan mediante redirect. La consulta admite hasta 100 puntos de código tras el edge trim aprobado. La UI pide 26 filas, presenta 25 y usa la última como lookahead; página máxima 401, offset máximo 10000. Una página mayor que 1 sin resultados redirige a página 1 conservando los filtros. No se hace COUNT ni consulta secundaria de vacíos.

Tabla desktop y tarjetas móviles muestran nombre, documento/nacionalidad, fecha civil de nacimiento, teléfono, email, cobertura y estado. Email/cobertura NULL se representan como `—` sólo en UI. Las notas, IDs internos, tokens y datos de otros Centers no se presentan. El formulario GET reinicia la paginación; loading, error de lectura y cuatro estados vacíos se muestran sin iniciar resolve global. La navegación muestra los cuatro destinos a ADMIN, sólo Pacientes a RECEPTION y ninguno a PROFESSIONAL. No se cambiaron guards de rutas existentes.

**Estado 007B:** `IMPLEMENTATION COMPLETE — READY FOR INDEPENDENT IMPLEMENTATION REVIEW`. No hubo delta DB/schema, consultas o mutaciones DEV, ni acceso PROD. Registro, resolve, link, reactivación, edición y desactivación siguen fuera de 007B; E2E se reserva para 007D.
