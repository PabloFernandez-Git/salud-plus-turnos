# 10. Agenda / calendario

## Decisión aprobada

**Realizar un spike técnico con React Big Calendar antes de adoptar definitivamente una librería de calendario.**

### Motivo

La agenda es una pieza central del producto y tiene requisitos específicos que no deben darse por compatibles con una librería sin comprobarlos primero.

React Big Calendar será el candidato principal para el spike porque ofrece:

- vistas de calendario;
- posicionamiento temporal de eventos;
- soporte para recursos;
- eventos simultáneos;
- navegación por fechas;
- personalización de eventos;
- licencia MIT.

### Objetivo del spike

El spike utilizará únicamente datos ficticios y deberá validar como mínimo:

#### Vista Día

- un solo día;
- profesionales como columnas;
- turnos de 20, 30 y 45 minutos;
- click en espacio libre;
- eventos correctamente posicionados.

#### Vista Semana

- días como columnas;
- uno o varios profesionales filtrables;
- dos o más profesionales con turnos en el mismo día y horario;
- eventos simultáneos mostrados de forma legible;
- navegación semanal.

#### Vista Mes

- representación resumida de actividad;
- posibilidad de personalizar el contenido diario;
- navegación mensual;
- acceso desde un día hacia una vista más detallada.

### Criterios adicionales

También se deberá comprobar:

- grado de personalización visual;
- integración razonable con Tailwind CSS;
- posibilidad de utilizar componentes propios para los turnos;
- comportamiento responsive;
- claridad del código resultante;
- ausencia de workarounds excesivos.

### Resultado esperado

React Big Calendar **no queda aprobado todavía como dependencia definitiva**.

Después del spike se tomará una nueva decisión:

- adoptar React Big Calendar;
- evaluar otra librería;
- construir una agenda propia;
- usar una estrategia híbrida.

### Estado

**Spike aprobado / librería definitiva pendiente**
