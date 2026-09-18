# MVP 1 — Gestor de turnos para consultorios y centros médicos

**Versión:** 0.3

## 1. Objetivo

Construir una primera versión funcional para pequeños consultorios o centros médicos que permita gestionar:

- centros;
- usuarios y roles;
- profesionales;
- especialidades;
- pacientes;
- disponibilidad;
- turnos;
- agenda;
- actividad diaria.

## 2. Flujo principal

Paciente se comunica con el centro  
→ Recepción busca al paciente  
→ Si la Persona existe pero no está registrada en ese centro, crea su relación PacienteEnCentro  
→ Si la Persona no existe, registra la Persona y luego su relación con el centro  
→ Selecciona especialidad  
→ Selecciona profesional  
→ Consulta disponibilidad  
→ Selecciona fecha y horario  
→ Crea el turno  
→ El turno aparece en la agenda  
→ Se actualiza su estado el día de la atención.

Estados:

- Pendiente
- Confirmado
- Atendido
- Cancelado
- Ausente

## 3. Centro

El MVP permite crear y configurar un centro con:

- nombre;
- teléfono;
- email;
- dirección;
- logo.

## 4. Usuarios y acceso a centros

El MVP permite:

- crear la cuenta inicial del Administrador;
- crear nuevos usuarios desde la administración;
- asignar una contraseña inicial;
- permitir el cambio posterior de contraseña;
- dar acceso a un usuario a uno o varios centros;
- asignar un rol por centro;
- activar o desactivar el acceso de un usuario a un centro.

Roles:

- Administrador
- Recepción
- Profesional

## 5. Especialidades

El MVP permite crear, editar, consultar, activar y desactivar especialidades.

## 6. Profesionales

El MVP permite:

- registrar profesionales;
- editar sus datos generales;
- vincularlos a uno o varios centros;
- activar o desactivar su participación en cada centro;
- asignar especialidades por centro;
- vincular opcionalmente un profesional con un usuario.

Datos obligatorios:

- nombre;
- apellido;
- DNI o documento;
- email.

Datos opcionales:

- matrícula;
- teléfono.

## 7. Personas y pacientes

El MVP distingue entre Persona y PacienteEnCentro.

La UI puede seguir presentando este proceso como “Registrar paciente”.

Datos obligatorios al registrar:

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

El sistema debe:

- detectar si ya existe una Persona con la misma identidad;
- reutilizar esa Persona cuando corresponda;
- impedir dos relaciones PacienteEnCentro para la misma Persona y el mismo Centro.

Los datos administrativos de un centro no se comparten automáticamente con otros centros.

## 8. Disponibilidad

La disponibilidad pertenece a Profesional + Centro.

Cada relación ProfesionalEnCentro puede tener:

- duración habitual de turno;
- días de atención;
- una o varias franjas horarias por día.

## 9. Turnos

Cada turno pertenece a un único centro.

Contiene:

- PacienteEnCentro;
- ProfesionalEnCentro;
- especialidad;
- fecha;
- hora;
- estado;
- observación administrativa opcional.

## 10. Agenda

El MVP incluye:

- Día
- Semana
- Mes

La vista diaria se organiza prioritariamente mediante columnas por profesional.

## 11. Dashboard

Administrador y Recepción ven la actividad del centro activo.

El Profesional ve únicamente su propia actividad.

## 12. Fuera del MVP

No se implementan todavía:

- historia clínica;
- disponibilidad avanzada;
- turnos recurrentes;
- sobreturnos;
- lista de espera;
- reserva pública;
- recordatorios;
- WhatsApp;
- facturación;
- pagos;
- gestión completa de obras sociales;
- roles personalizados;
- SSO;
- 2FA;
- reportes avanzados.

## 13. Criterio de finalización

El MVP está funcionalmente terminado cuando:

1. Un usuario crea una cuenta y un centro.
2. Se convierte en Administrador.
3. Crea especialidades.
4. Registra y vincula profesionales.
5. Configura disponibilidad.
6. Crea usuarios adicionales y les asigna acceso y rol.
7. Registra un paciente.
8. Si la Persona ya existía, se reutiliza su identidad sin compartir automáticamente datos administrativos de otros centros.
9. Crea un turno.
10. El turno aparece en Día, Semana y Mes.
11. Recepción puede confirmar, reprogramar o cancelar.
12. El Profesional puede consultar su agenda y marcar Atendido o Ausente.
13. La ficha del paciente refleja próximos turnos e historial.
14. El Dashboard refleja la actividad del día.
15. Un mismo profesional o usuario puede participar en más de un centro manteniendo separados roles, disponibilidad, pacientes y turnos.
