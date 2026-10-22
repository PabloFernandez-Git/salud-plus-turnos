# TASK-022 — Turnos en la ficha administrativa del paciente

## Objetivo

Completar el criterio 13 de `docs/mvp.md`: mostrar próximos turnos e historial real, seguro y paginado del `PatientCenter` del centro activo dentro del panel administrativo existente.

## Contexto relevante

- PR #19 / `69c1cd0` está integrado en `main`; el árbol del checkout de partida coincide con `main`.
- `staff_list_appointments` limita el rango a 31 días civiles y no acepta `PatientCenter`; `staff_get_appointment` exige un ID de turno. No hay lectura de historial por paciente.
- `appointments` tiene RLS habilitado, SELECT revocado a `authenticated` y ninguna policy; el acceso existente se concede mediante RPCs estrechas.
- El panel `PatientWorkspace` ya contiene la ficha administrativa, con apertura, cierre, descarte y presentación responsive aprobados.

## Criterios de aceptación

- [x] ADMIN y RECEPTION activos consultan únicamente turnos del `PatientCenter` dentro de su Center activo; PROFESSIONAL y otros centros no obtienen acceso.
- [x] Próximos turnos e historial se separan mediante una regla temporal y de estado explícita, incluyendo cancelaciones futuras en historial.
- [x] Cada fila muestra fecha/hora en la zona IANA del Center, profesional, especialidad, estado y enlace al detalle autorizado; las horas DST ambiguas se distinguen por offset.
- [x] Historia completa por páginas de SQL con orden determinista; se conservan nombres de profesionales/especialidades inactivos y estados históricos.
- [x] Estados vacíos y errores de lectura se muestran en el panel existente sin revelar notas ni datos de otro centro.
- [x] Pruebas focales de contrato, servicio, roles/aislamiento, paginación, estados, zona/DST y componente; inspección visual 1440/390 cuando exista UI funcional.
- [x] Review independiente focal PASS antes del cierre.

## Impactos

- Security: sí — nueva proyección mínima sin nota administrativa.
- Authorization: sí — guard de aplicación más reautorización en RPC; sin acceso PROFESSIONAL.
- Database: sí — nueva RPC de lectura y migration incremental para índice/capacidad; no aplicar sin autorización expresa.
- Documentation: sí — contrato propuesto y estado del bloqueo.
- Testing: sí — SQL y pruebas locales focales cuando el contrato esté disponible.

## Riesgos

- Filtrar en React las páginas de `staff_list_appointments` omitiría datos y podría mezclar centros; prohibido.
- Una página debe conservar el mismo instante de corte para impedir que el paso del tiempo cambie la clasificación entre solicitudes.
- `starts_at`/`ends_at` son instantes; en DST el mismo reloj local puede ocurrir dos veces.
- `RESCHEDULE` sobrescribe el horario del turno; no existe un log de slots anteriores. «Horario original» se interpreta como el horario almacenado del turno antes de un cambio de estado, no como una auditoría de reprogramaciones.

## Fuera de alcance

Historia clínica, notas administrativas en las nuevas lecturas, rediseño de Pacientes, cambios de reglas de Turnos o Dashboard, aplicación de migrations, escrituras DEV/PROD, commit, push y merge.

Las autorizaciones posteriores ampliaron el gate para aplicar la migration y
ejecutar fixtures sintéticos únicamente en DEV. Ambas intervenciones se
completaron con cleanup acreditado; PROD, commit, push y merge siguen fuera
del alcance de esta preparación de PR. Ver `focused-dev-revalidation.md`.
