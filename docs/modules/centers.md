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
