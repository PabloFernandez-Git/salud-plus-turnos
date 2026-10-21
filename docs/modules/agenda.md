# Agenda

Es el corazón operativo del producto.

## Día

- un día;
- profesionales como columnas;
- vista principal de Recepción;
- slots libres interactivos;
- click en slot inicia nuevo turno preseleccionado.

## Semana

- días como columnas;
- uno o varios profesionales filtrables;
- turnos simultáneos de distintos profesionales deben verse lado a lado dentro del mismo día/franja;
- profesional claramente identificable.

## Mes

- resumen por día;
- no representa cada slot horario;
- muestra actividad/profesionales de forma compacta;
- click en día lleva a una vista detallada.

## Filtros

- profesional;
- especialidad;
- estado.

Administrator/Reception ven centro completo. Professional ve solo agenda propia.

Los turnos cancelados no bloquean disponibilidad y no necesitan ocupar la agenda operativa activa.

No hay drag & drop, impresión/exportación ni sincronización externa en MVP.

## Decisión técnica para el MVP

React Big Calendar es la librería base adoptada para la agenda. La implementación será
desktop-first y conservará una experiencia operable en anchos menores mediante scroll horizontal
cuando sea necesario.

La configuración se adaptará por vista: Día usará profesionales como recursos, Semana mantendrá los
días como columnas principales sin recursos de la librería y Mes usará un resumen diario
personalizado. Esta decisión técnica no modifica las reglas funcionales anteriores.

Detalle y limitaciones aceptadas: [`docs/decisions/10-agenda-calendario.md`](../decisions/10-agenda-calendario.md).

## Implementación local de TASK-013 (2026-10-21)

`/centers/[centerId]/agenda` ofrece Día, Semana y Mes con navegación por fecha,
filtro de ProfessionalCenter activo para staff, filtro por ID de especialidad
activa y reservable, filtro de estado y acceso al
detalle. Usa exclusivamente los RPC de listado autorizados en TASK-009; consume
todas las páginas del período (Día: 1, Semana: 7, Mes: máximo 31 días civiles) o
informa error sin mostrar una Agenda parcial. Oculta CANCELLED por defecto.
El servidor reautoriza el Center en cada lectura, y el rol PROFESSIONAL recibe
sólo su proyección mínima.

El renderer convierte los instantes a campos civiles de la zona del Center antes
de pasarlos a React Big Calendar. En Día los ProfessionalCenter son recursos;
Semana mantiene los días como columnas; Mes muestra conteo y profesionales por
día y permite abrir Día. Si una hora válida del Center cae en un salto DST del
navegador, o se repite por DST en el Center o navegador, la Agenda no la ubica
en una franja equívoca: muestra el turno en una lista con fecha/hora civil,
desplazamiento UTC y enlace al detalle; Mes lo incluye en el conteo. Los anchos
menores usan scroll horizontal.

El filtro por ID se resuelve en servidor mediante el catálogo autorizado de
especialidades reservables. Como el RPC de listado devuelve `specialty_name`
pero no ID, el servidor consume todas las páginas y aplica el nombre único por
Center; no modifica el contrato de TASK-009 ni filtra una página incompleta.
Una especialidad desactivada o eliminada no se ofrece como filtro.

En Día y Semana, señalar una franja abre el selector existente de turnos. La
grilla no certifica disponibilidad: sólo `staff_search_appointment_slots`
ofrece horarios elegibles según Availability y las reglas de TASK-009. El slot
elegido se lleva a Crear turno con Center, profesional, especialidad, fecha e
instante. El alta vuelve a consultar PostgreSQL antes de preseleccionarlo y
avisa si dejó de estar disponible. Los horarios del selector muestran el
desplazamiento UTC derivado de los campos civiles de PostgreSQL para distinguir
horas repetidas. Mes conserva resumen y abre Día para seleccionar.

La validación autenticada sintética de TASK-013 pasó 13/13 escenarios en
1440×900 y 390×844: Día/Semana/Mes poblados, filtros, DST repetido, slot
PostgreSQL, preselección y CREATE reconciliado. Las 13 capturas y el cleanup de
residuo cero están en `validation-report.md` del expediente. Los eventos breves
usan dos líneas (paciente y horario/profesional/estado), con unos 46 px de alto
para 30 minutos. Una lista desplegable conserva nombres completos y enlaces
al detalle cuando la simultaneidad obliga a truncar texto en Semana. Los
eventos también abren el detalle con Enter o Espacio.

La grilla conserva las 24 horas dentro de una altura acotada; abre 30 minutos
antes del primer horario representable del período, o a las 08:00 sin turnos.
Un botón permite volver a esa posición. Es una preferencia de presentación,
no una inferencia de horario operativo ni de disponibilidad. Los filtros se
ajustan al ancho mobile. Cuando hay desborde interno, las flechas recorren
columnas completas y el scroll horizontal sigue disponible.
