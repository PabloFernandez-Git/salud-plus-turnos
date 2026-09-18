# Reglas de negocio

**Versión:** 0.3

## 1. Aislamiento por centro

1. Los turnos pertenecen a un único centro.
2. Las especialidades pertenecen a un único centro.
3. Los accesos de usuarios se definen por centro.
4. La participación de profesionales se define por centro.
5. Los registros administrativos de pacientes se definen por centro.
6. Un usuario sin acceso a un centro no puede consultar ni modificar datos de ese centro.
7. La participación de una Persona o Profesional en varios centros no implica compartir automáticamente datos operativos.

## 2. Usuarios y accesos

1. Una cuenta puede acceder a varios centros.
2. Cada relación Usuario-Centro define rol y estado.
3. El mismo usuario puede tener roles diferentes en centros distintos.
4. Desactivar un acceso no afecta otros centros.
5. Solo un Administrador del centro gestiona sus accesos.
6. El Administrador crea usuarios y asigna una contraseña inicial.

## 3. Profesional

1. Usuario y Profesional son entidades diferentes.
2. Un Profesional puede existir sin Usuario.
3. Un Profesional puede trabajar en varios centros.
4. Cada relación Profesional-Centro determina:
   - estado;
   - especialidades;
   - disponibilidad.
5. Desactivar al profesional en un centro no afecta otros centros.

## 4. Persona y PacienteEnCentro

1. Persona representa la identidad común de una persona dentro de la plataforma.
2. Una Persona puede relacionarse con varios centros.
3. PacienteEnCentro representa el registro administrativo de esa Persona dentro de un centro.
4. La misma Persona solo puede tener una relación PacienteEnCentro por centro.
5. La existencia de una Persona común no permite que un centro vea automáticamente en qué otros centros está registrada.
6. Los datos administrativos de PacienteEnCentro no se comparten automáticamente entre centros.

Datos requeridos al registrar un paciente:

- nombre;
- apellido;
- DNI o documento;
- fecha de nacimiento;
- nacionalidad;
- teléfono.

Datos opcionales:

- email;
- obra social o prepaga;
- notas administrativas.

7. El sistema debe utilizar nacionalidad + documento normalizado como criterio principal para detectar una Persona existente dentro del MVP.
8. Si encuentra una coincidencia exacta, debe reutilizar la Persona.
9. Debe impedir una segunda relación Persona-Centro para la misma combinación.
10. Si la identidad no puede determinarse con seguridad, no debe fusionar automáticamente registros ambiguos.
11. Nombre y fecha de nacimiento pueden utilizarse como señales adicionales para advertir posibles duplicados.

## 5. Privacidad entre centros

1. Un centro solo puede consultar la información administrativa de sus propios PacienteEnCentro.
2. Un centro no puede consultar:
   - notas de otro centro;
   - turnos de otro centro;
   - obra social registrada por otro centro;
   - estado del paciente en otro centro.
3. Persona funciona como identidad técnica común y no como mecanismo de intercambio automático de información.
4. Cualquier futura funcionalidad de intercambio clínico requerirá autorización explícita y reglas propias.

## 6. Disponibilidad

1. Pertenece a ProfesionalEnCentro.
2. Un profesional puede tener horarios distintos por centro.
3. Los turnos de un centro solo afectan la disponibilidad correspondiente a ese centro.
4. Turnos de otro centro no bloquean disponibilidad.

## 7. Turnos

1. Cada turno pertenece a un centro.
2. Debe relacionar:
   - PacienteEnCentro;
   - ProfesionalEnCentro;
   - Especialidad;
   - fecha;
   - hora;
   - estado.
3. El paciente, profesional y especialidad deben estar activos en ese centro.
4. La especialidad debe estar habilitada para ese profesional.
5. El horario debe pertenecer a su disponibilidad.
6. No puede haber doble reserva.
7. No se crean ni reprograman turnos hacia el pasado.

Estados:

- Pendiente
- Confirmado
- Atendido
- Cancelado
- Ausente

## 8. Agenda

1. Dispone de Día, Semana y Mes.
2. La vista Día es la principal vista operativa.
3. La organización visual prioriza profesionales.
4. Los slots libres son interactivos.
5. Filtros:
   - profesional;
   - especialidad;
   - estado.
6. Administrador y Recepción ven la agenda completa del centro activo.
7. Profesional ve únicamente su propia agenda.

## 9. Dashboard

1. Administrador y Recepción ven la actividad del centro activo.
2. Profesional ve únicamente su propia actividad.
3. Reportes históricos avanzados quedan fuera del MVP.

## 10. Integridad histórica

Las entidades con uso histórico deben preferentemente inactivarse en lugar de eliminarse.

## 11. Información clínica futura

1. MVP 1 no administra historia clínica.
2. Persona queda preparada como ancla de identidad para una futura historia clínica longitudinal.
3. La historia clínica futura no debe pertenecer exclusivamente a un PacienteEnCentro.
4. Cada entrada clínica deberá poder conservar al menos:
   - Persona;
   - profesional autor;
   - centro de origen;
   - fecha;
   - autoría.
5. La existencia de una historia clínica asociada a Persona no habilita acceso automático a ningún profesional o centro.
6. Una futura versión deberá definir:
   - autorización;
   - consentimiento;
   - auditoría;
   - permisos;
   - reglas de modificación;
   - seguridad y privacidad.

## 12. Obra social o prepaga

1. Es un dato opcional de PacienteEnCentro.
2. En MVP 1 es solo información administrativa.
3. No existe todavía catálogo, planes, número de afiliado, credenciales, validación de cobertura, autorizaciones ni facturación asociada.
