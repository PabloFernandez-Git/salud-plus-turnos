# Dashboard

Dashboard operativo, no analítica histórica.

## Navegación del centro

`/centers/[centerId]` muestra el nombre del centro, la identidad y el rol de la membership
activa, y tarjetas de navegación agrupadas en Operación diaria y Administración del centro.
Las tarjetas conservan las rutas y la visibilidad por rol: ADMIN ve los siete módulos;
RECEPTION ve Agenda, Turnos, Pacientes y Disponibilidad; PROFESSIONAL ve Agenda, Turnos
y su Disponibilidad. Cada ruta mantiene su autorización del lado del servidor.

La grilla usa tres columnas en desktop, dos en tablet y una en mobile. Las tarjetas no crean datos operativos adicionales.

## Identidad visual del centro

El layout de `/centers/[centerId]` comparte el encabezado de centro activo, identidad del usuario
y rol. En Inicio muestra Cerrar sesión; en las pantallas internas, Volver al inicio conserva la
sesión y el centro activo. Cada módulo presenta breadcrumb con enlace a Inicio, título,
descripción y las acciones que le corresponden. El nombre del centro permanece en el encabezado
compartido, fuera del encabezado del módulo. Las descripciones usan el estilo compartido de
`ModuleHeader`: ancho máximo `max-w-3xl`, salvo Pacientes, cuyo ancho flexible fue aprobado en
TASK-015 para ocupar una línea cuando cabe y ajustarse naturalmente en mobile. El contenido usa un
ancho común de hasta 1400 px; Agenda dispone de más espacio para el calendario.

## Dashboard operativo TASK-021

El inicio muestra Actividad de hoy y Próximos turnos de hoy antes de las tarjetas de navegación existentes. La fecha civil y hora de actualización se presentan en lenguaje natural según `centers.timezone`, a partir de la referencia temporal de la RPC PostgreSQL. Los horarios de los turnos conservan el offset UTC necesario para distinguir cambios por DST. Los cuatro indicadores forman una grilla de dos columnas en móvil y cuatro en escritorio. ADMIN y RECEPTION ven los conteos y hasta cinco turnos del centro; PROFESSIONAL sólo su propia actividad, sin conteo de profesionales ni nombres de otros profesionales. El total excluye cancelados y Por atender suma pendientes y confirmados.

La consulta usa el cliente Supabase de sesión en servidor y una RPC distinta por alcance. La Server Action permite relecturas, mientras los errores limpian el resumen y conservan la navegación. Ante un error, la pantalla muestra sólo la acción Reintentar, sin fecha pendiente ni botón Actualizar; cuando hay datos, Actualizar funciona normalmente. Se actualiza manualmente, al recuperar visibilidad y al cruzar medianoche local, sin polling. La UI distingue cero turnos vigentes, actividad sin próximos y error. Los próximos enlazan al detalle autorizado.

Mientras una lectura de la actividad está pendiente, el inicio usa el `AppLoader` compartido en
lugar de mostrar tarjetas incompletas. Al concluir, presenta los datos o el error y retira el
loader. El enlace «Administrar plataforma» del encabezado ofrece el mismo indicador sólo mientras
la navegación está pendiente; la autorización sigue resolviéndose en servidor.

Gate A estructural y Gate B funcional obtuvieron PASS en Supabase DEV, con 25 migrations, Chromium autenticado y cleanup `residue=0` según la ejecución de la persona usuaria y su ledger local. No se accedió a PROD ni se aplicó allí la migration.

## Evolución pendiente

Las alertas operativas requieren una regla específica. Un checklist de onboarding para distinguir la ausencia de pacientes o profesionales activos requiere lecturas autorizadas adicionales; no se infiere de cero turnos. No hay métricas históricas ni gráficos en TASK-021.

## Refinamiento UX TASK-023

El inicio presenta las agrupaciones Operación diaria y Administración del centro directamente después del Dashboard operativo; se retiraron el encabezado y la descripción introductorios redundantes. Las tarjetas, rutas, permisos y distribución responsive se conservan.
