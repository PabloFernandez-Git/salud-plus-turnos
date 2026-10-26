# TASK-028 — Refinamiento UX de Pacientes

## Objetivo

Mejorar el registro y la administración de Pacientes para igualar los patrones visuales aprobados en TASK-024 a TASK-027, sin cambiar reglas de negocio, contratos de servidor, permisos ni datos.

## Alcance y aceptación

- Tras crear un paciente, cerrar Registro, conservar `q/state/page`, refrescar el listado y mostrar «Paciente registrado correctamente» sin abrir Administración. Tras vincular, usar «Paciente vinculado correctamente». Un filtro puede ocultar la nueva fila; el aviso no promete visibilidad. El flujo `from=appointment` conserva su destino funcional.
- Nacionalidad usa el catálogo de países existente de Profesionales, con nombres legibles y valores ISO alpha-2; conserva el valor del formulario y las validaciones del servidor.
- Registro conserva identidad, datos y revisión/confirmación, todos los campos y advertencias, con mejor jerarquía, rejilla adaptable, scroll interno y acciones accesibles.
- Guardar cambios sólo se habilita con una diferencia real y valores válidos; se deshabilita al revertir o guardar, no envía sin cambios y evita duplicados. El error conserva el borrador. Los avisos previos se limpian al iniciar otra operación; no se muestra un éxito para `UNCHANGED`.
- Se conservan descarte por X/Escape/fondo, pestañas Datos/Turnos, turnos y acciones de activación/desactivación.

## Inspección funcional inicial

- `PatientsScreen` renderiza listado de servidor, filtros GET y enlaces `patient=<id>` sin copia cliente de la tabla. `PatientWorkspace` controla el modal de Registro, el modal de Administración y el aviso global.
- Registro: `resolvePatientAction` comprueba nacionalidad, documento y nacimiento. `NOT_FOUND` pide nombre y datos administrativos y confirma create; `FOUND/NOT_LINKED` confirma link; `ACTIVE` abre ficha; `INACTIVE` confirma reactivación. Actualmente create/link/reactivate navegan por `patientRegistrationDestination`, que añade `patient=<id>` y abre Administración en el flujo normal. Los errores preservan el formulario.
- Administración: `PatientDetail` separa identidad readonly y datos administrativos; `updatePatientAction` usa CAS. `hasUnsavedChanges` compara el formulario con `savedForm` en bruto. El botón Guardar no usa esa condición y `UNCHANGED` produce el aviso verde «No había cambios para guardar». Descarte y pestañas ya funcionan.
- Nacionalidad en Registro es texto con `AR` inicial. Profesionales ya dispone de `country-options.json` con nombres y códigos; el schema de Pacientes valida ISO alpha-2 en servidor.
- `patient-search-params.ts` conserva filtros y define el destino `from=appointment`. `patient-actions.ts` valida con Zod, autoriza ADMIN/RECEPTION, llama a `patient-management.ts` y revalida la ruta. La lectura de turnos vive en `PatientAppointments` y no requiere cambios.

## Riesgos e impacto

- Un `router.refresh()` debe actualizar el listado manteniendo los filtros sin remount que reabra Registro ni navegación a `patient=<id>`.
- La comparación del formulario debe respetar la normalización del servidor (trim de bordes, email lowercase y vacíos opcionales como NULL), sin enviar cambios aparentes ni perder entradas tras error.
- El aviso de éxito debe vivir fuera del modal que se cierra. `from=appointment` debe seguir dirigiéndose a la creación de turno.
- Solo componentes y pruebas focales de Pacientes, más documentación pertinente. Sin base remota, SQL, RPC, RLS, migrations ni otros módulos funcionales.

## Preparación

- `pnpm bootstrap`: PASS; Node 24.21.0 y pnpm 11.26.0.
- `origin/main` actualizado a `1c6f1fa` con PR #32 y #33 de TASK-027. Rama `codex/task-028-patients-ux` creada desde ese commit en el checkout habitual.
- `localhost:3000` respondió 200 y no se detuvo. `next-env.d.ts`, `.env.local` y todos los archivos locales sin seguimiento se preservan.

## Ajustes finales tras revisión visual de la persona usuaria

La persona usuaria aprobó el refinamiento general de TASK-028 y pidió tres correcciones antes del PR, sin ampliar reglas de negocio:

1. Registro usa `noValidate`, `FormFieldError`, borde rojo único y foco al primer campo inválido. Validación local al perder foco o avanzar, con errores retirados al corregir; schemas de Pacientes y autoridad del servidor permanecen vigentes.
2. La fecha de nacimiento se escribe como fecha civil `DD/MM/AAAA`, con inserción flexible de barras, edición y pegado; se convierte de forma determinística a `YYYY-MM-DD` al llamar las Actions. Debe validar fecha real, bisiestos y futuro según el día local del centro, sin `Date.parse` ni cambio de día por zona horaria.
3. La revisión muestra identidad y datos administrativos reales, con opcionales vacíos discretos, nombre de país y texto distinto para crear/vincular. Usa los mismos valores normalizados que se enviarán al confirmar; editar un campo vuelve a quitar la confirmación sin perder el borrador.

Riesgos: preservar el descarte, el resolve staged y sus respuestas tardías, la identidad compartida de sólo lectura, las rutas de create/link y `from=appointment`; mantener el modal utilizable a 390/556/1440 px. Impacto previsto: componente, helper de fecha y pruebas de Pacientes, fixture visual y documentación. Sin base remota ni contratos nuevos.

## Último ajuste tras aprobación visual del registro

La persona usuaria aprobó validaciones, fecha civil, revisión y responsive. Solicita reemplazar sólo la advertencia visible del resultado `FOUND` con `birth_date_matches: false` por «No pudimos comprobar la identidad con los datos ingresados. Revisá el documento y la fecha de nacimiento». El mensaje no debe aparecer para `NOT_FOUND`, `FOUND` coincidente ni errores de Action; no debe revelar nombres, fecha almacenada, IDs ni otros datos de la identidad. Conservar el estilo actual y el borrador.

Verificar con mocks los cuatro caminos: `NOT_FOUND` permite revisar alta; `FOUND/NOT_LINKED` coincidente revisa y vincula sin crear persona; mismatch bloquea mutaciones y conserva inputs; `FOUND/ACTIVE` abre el panel sin crear vínculo y el outcome `ALREADY_ACTIVE` sigue siendo informativo ante carrera. Impacto: texto de presentación, pruebas focales, fixture visual a 390 px y documentación. Riesgo principal: afirmar garantías de unicidad de DB sin prueba real; las pruebas aisladas comprueban la decisión de la UI y los resultados simulados, mientras las garantías de PostgreSQL quedan fuera del alcance de esta ronda.
