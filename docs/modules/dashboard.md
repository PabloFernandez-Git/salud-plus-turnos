# Dashboard

Dashboard operativo, no analítica histórica.

## Navegación del centro

`/centers/[centerId]` usa un encabezado de ancho completo y, debajo, una barra lateral persistente
en escritorio junto al contenido. El carril de 64 px muestra iconos y el módulo activo; con mouse
o foco se expande a 240 px sobre el contenido situado debajo del encabezado, sin desplazarlo, y
muestra los nombres. Incluye Dashboard y los módulos
agrupados en Operación diaria y Administración del centro.
ADMIN ve los ocho módulos; RECEPTION ve Agenda, Turnos, Pacientes y Disponibilidad;
PROFESSIONAL ve Agenda, Turnos y su Disponibilidad. La ruta activa se resalta, incluso en
pantallas de detalle. Cada ruta mantiene su autorización del lado del servidor.

En móvil y en pantallas táctiles, un botón abre el mismo menú con texto en un diálogo modal que se
cierra al elegir una ruta o con Escape. Las tarjetas de navegación ya no aparecen en el Dashboard.

## Identidad visual del centro

El layout de `/centers/[centerId]` comparte el encabezado de centro activo, identidad del usuario
y rol. La marca Salud Plus a la izquierda enlaza al Dashboard del centro activo. El encabezado
mantiene Cerrar sesión y el enlace opcional a plataforma en todas las
pantallas del centro. La sidebar permite cambiar de módulo sin volver a Inicio. Cada módulo
presenta título, descripción y las acciones que le corresponden. Las pantallas de detalle y edición
conservan breadcrumbs para regresar a la lista anterior. Los controles del encabezado se alinean
en una fila cuando hay espacio y se adaptan al ancho móvil. El nombre del centro permanece en el encabezado
compartido, fuera del encabezado del módulo. Las descripciones usan el estilo compartido de
`ModuleHeader`: ancho máximo `max-w-3xl`, salvo Pacientes, cuyo ancho flexible fue aprobado en
TASK-015 para ocupar una línea cuando cabe y ajustarse naturalmente en mobile. El contenido usa un
ancho común de hasta 1400 px; Agenda dispone de más espacio para el calendario.

## Dashboard operativo TASK-021

El inicio muestra Actividad de hoy y Próximos turnos de hoy. La fecha civil y hora de actualización se presentan en lenguaje natural según `centers.timezone`, a partir de la referencia temporal de la RPC PostgreSQL. Los horarios de los turnos conservan el offset UTC necesario para distinguir cambios por DST. Los cuatro indicadores forman una grilla de dos columnas en móvil y cuatro en escritorio. ADMIN y RECEPTION ven los conteos y hasta cinco turnos del centro; PROFESSIONAL sólo su propia actividad, sin conteo de profesionales ni nombres de otros profesionales. El total excluye cancelados y Por atender suma pendientes y confirmados.

La consulta usa el cliente Supabase de sesión en servidor y una RPC distinta por alcance. La Server Action permite relecturas, mientras los errores limpian el resumen y conservan la navegación. Ante un error, la pantalla muestra sólo la acción Reintentar, sin fecha pendiente ni botón Actualizar; cuando hay datos, Actualizar funciona normalmente. Se actualiza manualmente, al recuperar visibilidad y al cruzar medianoche local, sin polling. La UI distingue cero turnos vigentes, actividad sin próximos y error. Los próximos enlazan al detalle autorizado.

Durante la lectura inicial, el inicio usa el `AppLoader` compartido en lugar de mostrar información
operativa incompleta. Una actualización posterior mantiene el último resumen del mismo centro y rol,
deshabilita el botón de recarga y anima su icono hasta obtener datos nuevos o un error. La animación
respeta la preferencia de movimiento reducido. El enlace «Administrar plataforma» del encabezado ofrece el mismo indicador sólo mientras
la navegación está pendiente; la autorización sigue resolviéndose en servidor.

Gate A estructural y Gate B funcional obtuvieron PASS en Supabase DEV, con 25 migrations, Chromium autenticado y cleanup `residue=0` según la ejecución de la persona usuaria y su ledger local. No se accedió a PROD ni se aplicó allí la migration.

## Evolución pendiente

Las alertas operativas requieren una regla específica. Un checklist de onboarding para distinguir la ausencia de pacientes o profesionales activos requiere lecturas autorizadas adicionales; no se infiere de cero turnos. No hay métricas históricas ni gráficos en TASK-021.

## Refinamiento UX TASK-023

Históricamente, el inicio presentaba las agrupaciones Operación diaria y Administración del centro
después del Dashboard operativo. TASK-037 trasladó esas rutas a la barra lateral compartida.
