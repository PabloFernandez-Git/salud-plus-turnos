# Dashboard

Dashboard operativo, no analítica histórica.

## Inicio actual del centro

`/centers/[centerId]` muestra el nombre del centro, la identidad y el rol de la membership
activa, y tarjetas de navegación agrupadas en Operación diaria y Administración del centro.
Las tarjetas conservan las rutas y la visibilidad por rol: ADMIN ve los siete módulos;
RECEPTION ve Agenda, Turnos, Pacientes y Disponibilidad; PROFESSIONAL ve Agenda, Turnos
y su Disponibilidad. Cada ruta mantiene su autorización del lado del servidor.

La grilla usa tres columnas en desktop, dos en tablet y una en mobile. Este inicio no consulta
estadísticas ni crea datos operativos adicionales.

## Identidad visual del centro

El layout de `/centers/[centerId]` comparte el encabezado de centro activo, identidad del usuario
y rol. En Inicio muestra Cerrar sesión; en las pantallas internas, Volver al inicio conserva la
sesión y el centro activo. Cada módulo presenta un encabezado
con enlace a Inicio, título, descripción y las acciones que le corresponden. El contenido usa un
ancho común de hasta 1400 px; Agenda dispone de más espacio para el calendario.

## Evolución prevista

Administrator / Reception:
- total de turnos de hoy;
- pendientes;
- atendidos;
- cancelados;
- ausentes;
- próximos turnos;
- profesionales que trabajan hoy;
- alertas;
- accesos rápidos.

Professional:
- su actividad del día;
- próximos turnos;
- acceso a su agenda.

Puede existir un checklist de onboarding cuando el centro está vacío.
