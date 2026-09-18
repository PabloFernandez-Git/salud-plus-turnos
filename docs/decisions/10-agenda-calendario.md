# 10. Agenda / calendario

## Decisión aprobada

**Adoptar React Big Calendar como librería base de la agenda para el MVP.**

La decisión se toma después del spike de TASK-002, su verificación independiente con resultado
`PASS` y la revisión humana de las evidencias visuales. La versión validada fue React Big Calendar
1.20.0, integrada con React 19.3, Next.js 16.3, TypeScript 6, Tailwind CSS 4 y `date-fns` 4.4.

Esta adopción define la base técnica para la futura implementación productiva. No convierte el spike
experimental en la agenda del producto ni amplía el alcance funcional del MVP.

## Evidencia validada por el spike

- **Día:** permite mostrar profesionales como recursos/columnas, posicionar correctamente turnos de
  20, 30 y 45 minutos, identificar profesional y evento, y seleccionar espacios libres sin
  persistencia.
- **Semana:** conserva los días como columnas principales, permite filtrar uno o varios
  profesionales, representa turnos simultáneos lado a lado y soporta navegación semanal.
- **Mes:** permite reemplazar el detalle horario por un resumen diario propio, navegar entre meses y
  abrir un día en una vista detallada.
- **Personalización:** admite componentes propios para eventos, encabezados de recursos y celdas de
  Mes, además de controles propios y estilos acotados sobre la hoja base de la librería.
- **Integración:** instalación congelada, peers, formato, lint, tipos, tests unitarios, E2E y build
  pasaron con las versiones actuales del repositorio.
- **Responsive:** la experiencia fue utilizable a 375 px, 768 px y 1280 px; en los dos anchos menores
  necesita desplazamiento horizontal para preservar una densidad legible.

## Motivo de adopción

React Big Calendar resuelve las capacidades estructurales más costosas de la agenda: vistas
temporales, posicionamiento proporcional, navegación, selección, recursos, solapamientos y puntos de
extensión. Las adaptaciones necesarias quedaron localizadas por vista y no exigen un workaround de
severidad alta. Frente a construir la grilla completa desde cero, ofrece una base comprobada y
suficientemente flexible para el MVP.

## Enfoque para el MVP

- La agenda será **desktop-first**.
- En anchos menores se preservará la operabilidad mediante scroll horizontal cuando la densidad no
  permita mostrar todas las columnas a la vez.
- Día y Semana usarán configuraciones distintas del modelo de recursos: recursos por profesional en
  Día y días como columnas principales sin recursos de la librería en Semana.
- Mes usará un resumen diario personalizado en lugar de eventos horarios.
- La implementación productiva se realizará en una tarea posterior; no debe promoverse el código del
  spike sin revisar su encaje con datos, permisos y reglas reales.

## Limitaciones aceptadas

Para la primera versión del MVP se aceptan conscientemente como no bloqueantes:

- la vista Semana puede truncar parcialmente nombres cuando existe mucha simultaneidad;
- alrededor de 375 px y 768 px la agenda puede requerir scroll horizontal;
- Día y Semana necesitan configuraciones diferentes del modelo de recursos.

Si estas limitaciones dejan de ser aceptables por volumen, accesibilidad o necesidades mobile, se
podrá reevaluar un renderer específico o una solución híbrida sin cambiar las reglas de negocio de la
agenda.

Como consideración de mantenimiento, React Big Calendar requiere CSS base externo y tipos
comunitarios actualmente desfasados respecto de la versión runtime. Sus actualizaciones deberán
verificarse con peers, tipos, tests y build.

## Estado

**Adoptada para el MVP**
