# Reglas de negocio

**Versión:** 0.4

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
7. Existe una sola relación Usuario-Centro y un único rol en esa relación.
8. Una relación con rol Profesional debe vincularse a un ProfesionalEnCentro del mismo centro; los
   roles Administrador y Recepción no llevan ese vínculo.
9. Los roles combinados quedan fuera del MVP.
10. Todo centro activo debe conservar al menos una membership ADMIN activa.
11. No se puede desactivar, degradar ni autodesactivar al último ADMIN activo de un centro.
12. La contraseña inicial tiene un mínimo de 10 caracteres, sin exigir reglas artificiales de
    composición ni cambio obligatorio en el primer login.
13. Si un email ya pertenece a una cuenta, se reutilizan su identidad Auth y su `User`; no se
    modifican automáticamente contraseña, email, nombre/apellido ni accesos de otros centros.
14. `auth.users.email` es la fuente de verdad y `public.users.email` es una proyección lowercase,
    única y protegida por RLS. El cambio de email queda fuera del alcance inicial de Auth.
15. Toda operación que cruce Auth y PostgreSQL usa un `operation_id` estable, creado antes de
    iniciar el intento y vinculado a un hash inmutable de su intención.
16. Repetir el mismo `operation_id` devuelve el resultado confirmado; reutilizarlo con otro payload
    falla y nunca crea un segundo Center o una segunda membership.
17. Una excepción después de invocar PostgreSQL exige reconciliar primero. Sólo se elimina el Auth
    user creado por esa operación cuando el lock de operación confirma que no hubo commit; ante
    incertidumbre se preserva la identidad sin acceso.
18. Un `ProfessionalCenter` admite como máximo una membership `PROFESSIONAL` activa. Las
    memberships inactivas pueden conservar el vínculo como historial; asistentes, delegados o
    cuentas compartidas requieren un modelo explícito diferente.
19. Desactivar una membership `PROFESSIONAL` sin cambiar su rol ni vínculo debe ser posible aunque
    el `ProfessionalCenter` ya esté inactivo. Crear, reactivar, cambiar a `PROFESSIONAL` o cambiar el
    vínculo exige un `ProfessionalCenter` activo y perteneciente al mismo centro.

## 2.1. Administración global de plataforma

1. `PLATFORM_ADMIN` es un permiso global separado de los roles de `CenterMembership`.
2. Ser PLATFORM_ADMIN no crea ni implica acceso a ningún centro.
3. Ser ADMIN de un centro no concede acceso a `/platform`.
4. PLATFORM_ADMIN puede listar, crear, activar y desactivar centros y provisionar el primer ADMIN.
5. Puede consultar datos administrativos básicos del centro y contadores agregados de memberships,
   ProfessionalCenter y Specialty activos.
6. PLATFORM_ADMIN no obtiene por ese rol acceso a pacientes, Person, PatientCenter, agenda,
   appointments, notas administrativas ni disponibilidad.
7. Un centro nuevo y activo se crea junto con exactamente una primera membership ADMIN activa.
8. Desactivar un centro no borra datos ni desactiva memberships; impide la operación tenant.
9. Reactivar un centro exige que exista al menos un ADMIN activo.
10. El primer PLATFORM_ADMIN se crea una única vez mediante tooling seguro sobre una plataforma
    todavía no inicializada. Los centros posteriores se crean desde `/platform`.

## 3. Profesional

1. Usuario y Profesional son entidades diferentes.
2. Un Profesional puede existir sin Usuario.
3. Un Profesional puede trabajar en varios centros.
4. Cada relación Profesional-Centro determina:
   - estado;
   - especialidades;
   - disponibilidad.
5. Desactivar al profesional en un centro no afecta otros centros.
6. La identidad del Profesional se deduplica por nacionalidad ISO alpha-2 + documento normalizado.
7. La matrícula es opcional, pertenece a la relación Profesional-Centro y no es única en el MVP.
8. Person y Professional continúan siendo entidades separadas.

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
12. La nacionalidad usa ISO 3166-1 alpha-2 y PostgreSQL es la autoridad del documento normalizado;
    se conserva también el documento original.

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
5. La duración habitual por ProfesionalEnCentro es un default operativo de 30 minutos, admite de 5
   a 480 minutos en múltiplos de 5 y no obliga a que todos los turnos tengan esa duración.

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
8. La doble reserva se controla por ProfesionalEnCentro, no globalmente por Profesional.
9. Pendiente, Confirmado, Atendido y Ausente bloquean horario; Cancelado conserva historia pero
   libera el slot.

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
