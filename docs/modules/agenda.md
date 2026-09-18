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
