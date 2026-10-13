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

## Foundation DB/API de TASK-007A (remediación lista para re-review independiente)

Dos migrations incrementales aplicadas a DEV agregan SELECT tenant bajo RLS para ADMIN y RECEPTION activos: PatientCenters de su Center y Persons vinculadas a una relación visible. No hay DML genérico ni directorio global. La RPC de búsqueda acepta una consulta literal, estado `ACTIVE/INACTIVE/ALL`, límite 1..50 y offset 0..10000. Un resultado vacío no inicia resolve global.

El alta staged usa RPCs separadas para resolve exacto, create, link y reactivate. Resolve compara la fecha ingresada y sólo expone nombres, resultado booleano y estado de relación del Center; no devuelve nacimiento almacenado ni datos de otros Centers. Link y reactivate exigen confirmación y vuelven a comprobar identidad/nacimiento. Update modifica sólo teléfono, email, cobertura y notas; deactivate es lógico. Reactivate conserva la misma relación y sus datos. Las mutaciones de relación usan CAS por `expected_updated_at`, no-op sin UPDATE y trigger monotónico.

Los inputs de pacientes usan edge trim explícito para TAB, LF, VT, FF, CR y SPACE; nacionalidad usa un snapshot versionado de 249 códigos ISO alpha-2, y email opcional reutiliza el contrato TASK-006 tras convertir blanco canónico en NULL. La fecha futura se compara con el día local del Center mediante `private.center_local_date_at(timezone, statement_timestamp())`.

El contrato de aplicación para las siete RPCs vive en `src/modules/patients/api/patient-rpc-contracts.ts` y se valida en `patient-rpc-adapter.ts`. SQL es la autoridad de DB; `database.types.ts` es un artefacto generado de transporte cuya introspección de funciones omite nulabilidad de argumentos y `RETURNS TABLE`. Resolve distingue `NOT_FOUND`, DOB mismatch, `NOT_LINKED`, `ACTIVE` e `INACTIVE`; `NULL` permanece `NULL` en resultados y argumentos administrativos. La futura 007B debe consumir el adapter, no el resultado raw de `supabase.rpc` para pacientes. El guard de tipos confronta nombres y claves de argumentos con los tipos generados; el schema verifier confronta las siete firmas reales en DEV.

**Estado:** 007A-IR-1 y 007A-IR-2 `remediated — pending independent closure`. La comparación V2 ahora detecta drift de metadata e inventario incluso en tablas vacías; DEV read-only y tests pasaron. TASK-007 completa sigue abierta y 007B no se inició. La discrepancia histórica del digest ampliado permanece como **HISTORICAL VERIFICATION GAP**, categoría E, sin equivalencia retrospectiva demostrada. El riesgo de inferencia mediante resolve/create está aceptado sólo para MVP DEV; abuso, rate limiting y monitoreo son requisitos PRE-PROD. Véase `.harness/tasks/active/TASK-007/implementation-report.md`.
