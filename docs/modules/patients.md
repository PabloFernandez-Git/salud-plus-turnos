# Personas y pacientes

## Persona

`Person` representa identidad común dentro de la plataforma.

Criterio principal de deduplicación MVP:

```text
nacionalidad + documento normalizado
```

Coincidencia exacta: reutilizar Persona. Coincidencia ambigua: no fusionar automáticamente.

## PatientCenter

Representa el registro administrativo de una Persona dentro de un centro.

La misma Persona no puede tener dos `PatientCenter` para el mismo centro.

Datos requeridos al registrar:
- nombre;
- apellido;
- documento;
- fecha de nacimiento;
- nacionalidad;
- teléfono.

Opcionales:
- email;
- obra social/prepaga;
- notas administrativas.

Los datos administrativos son privados por centro. La existencia de una Persona común no revela otros centros ni comparte automáticamente turnos/notas/cobertura.

La UI puede presentar la operación simplemente como “Registrar paciente”.
