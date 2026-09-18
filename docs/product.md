# Salud Plus — Gestión de Turnos

**Versión:** 0.3

## 1. Visión del producto

Aplicación web orientada a pequeños consultorios y centros médicos que permita centralizar la gestión diaria de pacientes, profesionales, especialidades, disponibilidad y turnos.

El sistema busca ofrecer un único espacio desde el cual cada centro pueda organizar su actividad cotidiana, evitando agendas separadas, planillas y procesos manuales.

El corazón del producto es la agenda.

## 2. Tipo de organización

Cada centro tiene su propio espacio operativo dentro del sistema.

Un centro puede tener:

- usuarios con acceso al centro;
- profesionales vinculados al centro;
- especialidades;
- pacientes registrados en el centro;
- disponibilidad de sus profesionales;
- turnos.

Los datos operativos de cada centro se mantienen aislados.

## 3. Usuarios del sistema

Una cuenta de usuario puede tener acceso a uno o varios centros.

El rol del usuario pertenece a su relación con cada centro y no globalmente a la cuenta.

Roles del MVP:

- Administrador
- Recepción
- Profesional

**Recepción → administra la agenda.**

**Profesional → consulta y atiende.**

## 4. Usuario y Profesional son conceptos diferentes

Un Usuario representa una cuenta con acceso al sistema.

Un Profesional representa a una persona que presta atención.

Un profesional:

- puede trabajar en uno o varios centros;
- puede existir sin tener un usuario;
- puede tener especialidades diferentes según el centro;
- puede tener disponibilidad diferente según el centro.

## 5. Persona/Paciente y relación con los centros

El sistema distingue entre:

### Persona

Representa la identidad común de una persona dentro de la plataforma.

Puede relacionarse con uno o varios centros.

### Paciente en un centro

Representa el registro administrativo de esa persona dentro de un centro concreto.

Una misma persona puede ser paciente de varios centros:

- Persona Juan Pérez
  - Paciente en Centro A
  - Paciente en Centro B

Cada centro mantiene su propio registro administrativo del paciente.

Los centros no comparten automáticamente:

- teléfono;
- email;
- obra social o prepaga;
- notas administrativas;
- estado dentro del centro;
- turnos;
- información operativa.

La existencia de una identidad común tampoco permite que un centro conozca automáticamente en qué otros centros se atiende una persona.

Esta separación deja abierta una futura evolución hacia una historia clínica longitudinal asociada a la Persona, sin obligar a compartir automáticamente información entre centros.

## 6. Núcleo del producto

Paciente se comunica con el centro  
→ Recepción busca al paciente  
→ Si no está registrado en ese centro, lo registra  
→ Selecciona especialidad  
→ Selecciona profesional  
→ Consulta disponibilidad  
→ Selecciona fecha y horario  
→ Crea el turno  
→ El turno aparece en la agenda  
→ El día del turno se actualiza su estado.

Estados:

- Pendiente
- Confirmado
- Atendido
- Cancelado
- Ausente

## 7. Entidades principales

- Centro
- Usuario
- Acceso al centro
- Rol
- Profesional
- Profesional en centro
- Persona
- Paciente en centro
- Especialidad
- Turno
- Disponibilidad

## 8. Relaciones principales

```text
USUARIO
   │
   └── ACCESO_AL_CENTRO
          ├── CENTRO
          └── ROL

PROFESIONAL
   │
   └── PROFESIONAL_EN_CENTRO
          ├── CENTRO
          ├── ESPECIALIDADES
          └── DISPONIBILIDAD

PERSONA
   │
   └── PACIENTE_EN_CENTRO
          ├── CENTRO
          ├── DATOS ADMINISTRATIVOS
          └── TURNOS
```

## 9. Agenda

La agenda es la funcionalidad central.

Debe disponer de:

- vista diaria;
- vista semanal;
- vista mensual.

La organización visual prioriza a los profesionales.

## 10. Disponibilidad

La disponibilidad pertenece a la relación entre Profesional y Centro.

Un mismo profesional puede tener diferentes horarios según el centro donde trabaja.

## 11. Pacientes

Datos obligatorios al registrar un paciente:

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

El sistema debe evitar registros duplicados de la misma Persona y evitar también registrar dos veces a la misma Persona como paciente dentro del mismo centro.

## 12. Profesionales y especialidades

Datos obligatorios del profesional:

- nombre;
- apellido;
- DNI o documento;
- email.

Datos opcionales:

- matrícula;
- teléfono.

Un profesional puede trabajar en uno o varios centros.

## 13. Dashboard

Administrador y Recepción visualizan principalmente:

- turnos del día;
- pendientes;
- atendidos;
- cancelados;
- ausentes;
- próximos turnos;
- profesionales que atienden ese día;
- alertas operativas;
- accesos rápidos.

El Profesional visualiza únicamente su propia actividad.

## 14. Personalización del centro

Cada centro puede configurar:

- nombre;
- teléfono;
- email;
- dirección;
- logo.

## 15. Preparación para una futura historia clínica

La historia clínica no forma parte del MVP 1.

El modelo Persona + PacienteEnCentro deja abierta una futura evolución en la que una historia clínica longitudinal pueda asociarse a la Persona y ser consultada por profesionales autorizados de distintos centros.

La existencia de una Persona común no implica acceso automático a información clínica.

Una futura funcionalidad deberá definir expresamente:

- autorización y consentimiento;
- profesionales y centros autorizados;
- auditoría de accesos;
- autoría de cada registro;
- fecha y centro de origen;
- reglas de edición y corrección;
- seguridad y privacidad.

## 16. Fuera del alcance inicial

No forman parte del MVP 1:

- historia clínica;
- diagnósticos;
- antecedentes médicos;
- recetas;
- estudios;
- medicación;
- archivos clínicos;
- facturación;
- gestión estructurada de obras sociales;
- pagos;
- ART;
- reserva pública por pacientes;
- recordatorios automáticos;
- WhatsApp;
- reportes históricos avanzados.
