# Personas y pacientes

## TASK-028 — Refinamiento UX integrado

El registro conserva las etapas de identidad, datos y confirmación en un modal con encabezado visible durante el desplazamiento, campos en dos columnas desde `sm` y una columna en móvil. Nacionalidad muestra nombres del catálogo utilizado por Profesionales y envía códigos ISO alpha-2 sin cambiar la validación de servidor. Tras crear o vincular en el flujo normal, se cierra Registro, se refresca el listado con los mismos filtros y se muestra una confirmación específica; Administración se abre sólo mediante su acción existente. El flujo iniciado desde crear turno conserva la navegación al turno.

El registro valida los campos al perder el foco o al avanzar, con `noValidate`, error junto al campo, `aria-invalid`/`aria-describedby` y foco en el primer valor inválido. La fecha de nacimiento se escribe como fecha civil `DD/MM/AAAA`; admite dígitos seguidos o fecha con barras, permite borrar y reemplazar partes, y se convierte a `YYYY-MM-DD` antes de llamar las Actions. La validación local comprueba fecha real y que no sea futura según el día del centro; los schemas y el servidor siguen siendo la autoridad. La revisión de creación y vínculo muestra los valores normalizados de identidad y datos administrativos que se enviarán al confirmar, con nombres de país y opcionales vacíos discretos. «Corregir datos» vuelve al formulario con el borrador intacto; en el vínculo, nombre y apellido proceden de la identidad compartida y permanecen de sólo lectura.

Cuando resolve informa `FOUND` con `birth_date_matches: false`, Registro muestra la advertencia neutral «No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha de nacimiento». Conserva los campos para corregirlos y bloquea alta/vínculo sin mostrar datos de la identidad resuelta. Los errores de validación, permisos o red conservan sus mensajes propios. La comprobación local de esta ronda usa mocks para los cuatro resultados de identidad; no acredita por sí sola la unicidad ni la autorización de PostgreSQL en una sesión real.

En Administración, Guardar cambios requiere un valor válido distinto del último confirmado según la normalización existente del schema. Se deshabilita al revertir y tras guardar, conserva el borrador ante error y evita anunciar `UNCHANGED` como guardado. Los avisos del modal permanecen junto a los datos del paciente. Descarte, pestañas y acciones de estado conservan el comportamiento anterior. La persona usuaria aprobó la revisión visual de TASK-028 en `localhost:3000`; el cambio funcional se integró mediante el [PR #34](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/34). El [cierre documental](../../.harness/tasks/archive/TASK-028/closure.md) está propuesto en una rama aparte.

**Privacidad PRE-PROD pendiente:** el contrato de resolve puede devolver `FOUND` y nombres al cliente autorizado aun si `birth_date_matches` es falso. La advertencia neutral sólo evita mostrar esos datos en pantalla; la respuesta de red conserva una exposición potencial. Se requiere una tarea independiente de seguridad antes de utilizar datos personales reales en producción. TASK-028 no remedió este contrato ni autoriza ese uso.

## TASK-022 — Turnos en la ficha

El panel administrativo `PatientWorkspace` muestra Próximos turnos e Historial del `PatientCenter` seleccionado. La RPC `staff_list_patient_appointments` autoriza ADMIN/RECEPTION activos y aísla Center + PatientCenter en PostgreSQL; el servicio vuelve a autorizar en servidor y usa el cliente de sesión. Cada sección se pagina con cursor `(starts_at,id)` y comparte un instante `asOf` capturado al abrir o actualizar la ficha. Próximos comprende turnos futuros PENDING/CONFIRMED; Historial comprende el complemento, incluidas cancelaciones futuras. Se muestran sólo las ocho columnas aprobadas, con horario IANA del Center y offset DST, estados, reintentos independientes y enlace al detalle que reautoriza. La persona usuaria confirmó PASS estructural DEV de la migration y ejecutó el gate funcional DEV con PASS; el ledger local acredita cleanup con residuo cero e inventarios de 14 recursos coincidentes.

La ficha se abre como modal centrado con dos pestañas, «Datos del paciente» y «Turnos». La primera conserva el formulario administrativo y las acciones existentes; la segunda conserva las dos listas, actualización y paginación. Los paneles permanecen montados al cambiar de pestaña para mantener el borrador y el estado de turnos. X, Escape y fondo comparten el descarte de cambios; una operación pendiente bloquea el cierre. El modal bloquea el scroll de fondo y desplaza su propio contenido en móvil. En el listado, «Administrar paciente» usa la presentación de botón secundario de Gestión de usuarios y conserva la navegación por URL.

El listado oculta la leyenda de página cuando no hay páginas adyacentes; si las hay, ubica Anterior/Página actual/Siguiente debajo de la tabla o tarjetas sin calcular un total. El modal vuelve al listado al cerrarse, por lo que no muestra un enlace redundante «Ver en listado». «Desactivar paciente» usa un botón secundario rojo separado de Guardar cambios y conserva su confirmación. «Actualizar turnos» usa un botón secundario azul, alineado a la derecha del encabezado cuando hay espacio; la lectura autorizada, el estado de carga y la paginación no cambian.

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
En la interfaz actual, Registrar paciente se presenta en un modal centrado, adaptable al viewport y
con scroll interno para las etapas largas. X, fondo y Escape comparten confirmación de descarte si
hay datos sin guardar; una operación pendiente impide cerrar. La Administración de pacientes usa el
modal centrado descrito arriba.

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

El plan C+D recibió review independiente PASS y autorización conjunta. **GATE C PASS:** la ruta existente añadió Registrar paciente explícito y Administrar por fila/tarjeta. `patient=<UUID>` canónico abre la ficha sin cambiar `q/state/page`; permite inspeccionar un registro aunque no esté en la página o filtro visibles. En GATE C la Administración funcionaba como panel lateral; TASK-022 la convirtió en el modal centrado descrito arriba. El listado sigue siendo una lectura server y no se mantiene una copia de la tabla en el cliente.

Registrar comprueba nacionalidad, documento y fecha ingresada mediante resolve exacto; SEARCH miss nunca inicia resolve. NOT_FOUND crea Person y PatientCenter atómicamente tras revisar nombres y datos administrativos; mismatch de nacimiento bloquea mutación sin revelar la fecha almacenada; NOT_LINKED vincula sólo con confirmación; ACTIVE reutiliza la relación sin mutar; INACTIVE reactiva con confirmación y CAS conservando datos administrativos. La pantalla sólo usa la proyección mínima de resolve y nunca muestra IDs técnicos, datos de otro Center ni fecha almacenada en esa respuesta.

El detalle lee PatientCenter por `center_id` e `id` con RLS y reautorización ADMIN/RECEPTION, y sólo los campos de Person vinculada requeridos para identidad readonly. Notas administrativas se leen y editan sólo dentro del panel, con aviso de no registrar información clínica. La edición afecta únicamente teléfono, email, cobertura y notas; desactivar es lógico y requiere confirmación. Reactivar desde el panel inactivo vuelve a comprobar identidad con DOB ingresada y exige confirmación. Mutaciones con CAS no reintentan ni sobreescriben ante stale; Recargar datos obtiene un token nuevo.

Las seis Server Actions validan Zod, crean cliente de sesión, reautorizan ADMIN/RECEPTION y delegan al servicio `server-only`; todas las RPCs pasan por `callPatientRpc()`. Los resultados y errores se traducen sin SQL ni PII. `UPDATED`, `UNCHANGED`, `DEACTIVATED`, `REACTIVATED` y `ALREADY_ACTIVE` se manejan como outcomes. No se cambiaron migrations, SQL, RLS, grants, RPCs ni tipos generados. Verificación local final: 435/435 tests Vitest y 11/11 tests `node:test`, lint, typecheck y diff check PASS; build y guard de secretos PASS en el gate de implementación previo.

**GATE D automatizado PASS:** integración DB, privacidad multi-Center, carreras/CAS y E2E pasaron. Cleanup por UUID exacto y auditoría posterior restauraron el inventario DEV; paridad 19/19, dry-run, lint, schema/API y Baseline V2 exacto pasaron (`24e7b314358764556d9692ba6301eae67d4010eb722814595ef536eb63817359`). Smoke humano: **DEFERRED — non-blocking for current portfolio MVP due to harness/session fixture friction**; no se afirma smoke PASS. El review independiente final fue **PASS**: TASK-007-FIR-1 y FIR-2 `CLOSED`. **TASK-007 CLOSED — READY_FOR_MERGE**; artefactos en `active/` hasta el merge, como TASK-006. **HISTORICAL VERIFICATION GAP: Category E — insufficient evidence**. **PRE-PROD:** exact global resolve/create inference risk, rate limiting, abuse protection y monitoring/telemetry pendientes. PROD fuera de alcance.
