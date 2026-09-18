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

Cambiar timezone con turnos existentes es una operación sensible y puede restringirse en MVP.
