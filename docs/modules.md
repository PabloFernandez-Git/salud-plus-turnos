# Módulos del producto

**Versión:** 0.3

1. Centro, usuarios y roles
2. Especialidades y profesionales
3. Personas y pacientes
4. Disponibilidad
5. Turnos
6. Agenda
7. Dashboard

## 1. Centro, usuarios y roles

### Usuario

Cuenta global que puede acceder a uno o varios centros.

### Acceso al centro

Relaciona Usuario + Centro y define:

- rol;
- estado.

Roles:

- Administrador
- Recepción
- Profesional

## 2. Especialidades y profesionales

### Profesional

Datos obligatorios:

- nombre;
- apellido;
- DNI o documento;
- email.

Datos opcionales:

- matrícula;
- teléfono.

### Profesional en centro

Relaciona Profesional + Centro y define:

- estado;
- especialidades;
- disponibilidad.

## 3. Personas y pacientes

### Persona

Representa una identidad común dentro de la plataforma.

Puede relacionarse con uno o varios centros.

### Paciente en centro

Relaciona Persona + Centro.

Representa el registro administrativo de esa Persona dentro del centro.

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

Cada centro mantiene de forma independiente su información administrativa.

No se comparten automáticamente entre centros:

- teléfono;
- email;
- obra social o prepaga;
- notas;
- estado;
- turnos.

La misma Persona no puede tener dos relaciones PacienteEnCentro con el mismo Centro.

## 4. Disponibilidad

Pertenece a ProfesionalEnCentro.

Cada relación puede definir:

- duración habitual del turno;
- días;
- franjas horarias.

## 5. Turnos

Cada turno pertenece a un centro y relaciona:

- PacienteEnCentro;
- ProfesionalEnCentro;
- Especialidad;
- fecha;
- hora;
- estado.

## 6. Agenda

Vistas:

- Día
- Semana
- Mes

Filtros:

- profesional;
- especialidad;
- estado.

## 7. Dashboard

Administrador y Recepción ven actividad del centro activo.

Profesional ve únicamente su propia actividad.

## Relación general

```text
USUARIO
  └── ACCESO_AL_CENTRO
         ├── CENTRO
         └── ROL

PROFESIONAL
  └── PROFESIONAL_EN_CENTRO
         ├── CENTRO
         ├── ESPECIALIDADES
         └── DISPONIBILIDAD

PERSONA
  └── PACIENTE_EN_CENTRO
         ├── CENTRO
         ├── DATOS ADMINISTRATIVOS
         └── TURNOS
```

## Preparación para evolución clínica

Persona funciona como punto de identidad común para una futura historia clínica longitudinal.

No se implementa historia clínica en MVP 1.

La existencia de Persona no habilita acceso cruzado entre centros.
