# Centros

Un centro es el espacio operativo que aísla agenda, profesionales, especialidades, pacientes administrativos y turnos.

## MVP

Datos:

- nombre;
- teléfono;
- email;
- dirección;
- logo;
- timezone IANA.

Valor inicial de timezone: `America/Argentina/Buenos_Aires`.

Un usuario puede acceder a más de un centro. El centro activo determina el contexto operativo.

El centro activo se representa explícitamente en `/centers/[centerId]/...`. Una membership activa
redirige directamente; varias muestran selector; ninguna muestra un estado sin acceso. No se guarda
`last_active_center_id` en TASK-005.

## Administración global

PLATFORM_ADMIN administra centros desde `/platform` sin obtener acceso operativo al tenant. La
pantalla permite listar, crear, activar y desactivar centros y muestra datos administrativos básicos
con contadores agregados de memberships, ProfessionalCenter y Specialty activos.

Un centro nuevo activo se crea atómicamente con su primer ADMIN activo. Todo centro activo debe
conservar al menos un ADMIN activo. Desactivar un centro conserva memberships y datos, pero bloquea
toda operación tenant. Tampoco se permite remover al último ADMIN de un centro inactivo; reactivarlo
vuelve a comprobar la invariante como defensa adicional.

Cambiar timezone con turnos existentes es una operación sensible y puede restringirse en MVP.

## Experiencia de administración

En `/platform`, «Crear centro» abre un diálogo con resolución del email del administrador inicial,
datos del centro y revisión de solo lectura. Una cuenta existente se reutiliza sin cambiar sus datos
ni contraseña; una cuenta nueva requiere repetir exactamente la contraseña inicial. El envío final
conserva la intención idempotente y el mismo `operation_id` ante resultados inciertos; la contraseña
no se almacena. Tras éxito, el diálogo permanece abierto para cerrar o crear otro centro.
El botón de alta se ubica junto a «Centros registrados», separado de la navegación y el cierre de
sesión del encabezado. El diálogo mantiene encabezado y pie visibles; sólo su contenido se desplaza.
Al validar, enfoca el primer campo inválido y desplaza el contenido hasta mostrar su error. La
etiqueta visible «Zona horaria» muestra ciudad, país o territorio y offset GMT actual. El valor
enviado conserva el identificador IANA exacto en un campo oculto. El campo ofrece sugerencias
buscables por ciudad, país o identificador. También admite introducir
un identificador IANA válido que no figure en las sugerencias, incluidos alias como
`America/Argentina/Buenos_Aires`; el valor elegido se conserva literalmente en la revisión y el
envío. No se convierte a un offset fijo.
El primer paso valida el email con el schema de la aplicación y muestra el error bajo el campo,
sin aviso nativo del navegador; la validación del servidor permanece intacta.

Si el resultado de una creación es incierto, el diálogo conserva el `operation_id` y sólo permite
reintentar o verificar esa operación. Cerrar conserva la intención sin contraseña para retomarla.
No se ofrece iniciar otra alta hasta obtener éxito, confirmación idempotente o un fallo concluyente.
Si la intención guardada es ilegible, el diálogo bloquea una nueva alta: hay que conservar la sesión,
comprobar en «Centros registrados» si el centro existe y solicitar una revisión administrativa de la
operación si el resultado sigue sin poder determinarse.

La página ofrece «Ir a mi centro» cuando existe un único centro accesible y activo,
«Seleccionar centro» cuando hay varios, y omite el enlace si no hay ninguno. Un fallo al consultar
accesos se informa como error. El encabezado del dashboard de un centro muestra «Administrar
plataforma» sólo cuando el usuario posee PLATFORM_ADMIN global, independientemente de su rol en ese
centro. En los módulos interiores permanece «Volver al inicio» sin repetir el enlace global.

El listado conserva la tabla completa en escritorio y muestra tarjetas en móvil con el mismo orden,
datos administrativos, contadores agregados y acción de estado.
El contacto institucional se rotula «Email del centro». La lista de ADMIN actuales queda pendiente:
la RPC global no devuelve identidades y RLS de memberships/usuarios no concede lectura global al
PLATFORM_ADMIN. La persona usuaria no autorizó una RPC adicional en TASK-033, así que no se muestra
el administrador inicial histórico como si fuera el actual.

El encabezado de `/platform` ocupa la franja superior y muestra la cuenta, el enlace al centro y
«Cerrar sesión». Desactivar y reactivar un centro comparten un diálogo de confirmación accesible que
identifica el centro; cerrar o volver no ejecuta la acción. El diálogo informa carga y errores, y
el éxito se anuncia junto a la acción del listado.

El encabezado de plataforma mantiene esa estructura con menor altura. Su espera de datos muestra
el `AppLoader` compartido en lugar de tarjetas vacías; «Ir a mi centro» ofrece el mismo indicador
mientras la navegación está pendiente. Los errores de consulta y autorización siguen resolviéndose
en la página y el servidor.

El selector de zona horaria usa una lista local buscable por ciudad, país o identificador. Se ubica dentro
del diálogo, fuera de la región con scroll, y se desplaza hacia arriba si falta espacio debajo del
campo, sin cubrir el pie de acciones. Acepta elección con mouse o teclado y conserva la entrada libre para alias IANA válidos.
Durante el envío del alta se muestra «Creando centro…»; la advertencia de resultado incierto aparece
cuando la respuesta no confirma el resultado o se reabre una intención persistida.
