# 3. TypeScript

## ¿Qué es?

TypeScript es una extensión de JavaScript que permite declarar tipos.

Ejemplo:

```ts
type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "attended"
  | "cancelled"
  | "no_show";
```

Esto permite detectar muchos errores durante el desarrollo antes de ejecutar la aplicación.

## ¿Por qué lo elegimos?

Nuestro dominio tiene muchas entidades relacionadas:

- centros;
- usuarios;
- profesionales;
- pacientes;
- especialidades;
- disponibilidad;
- turnos;
- estados;
- permisos.

TypeScript ayuda a expresar esas estructuras de manera explícita.

También mejora:

- autocompletado;
- refactors;
- navegación del código;
- documentación implícita;
- trabajo con Codex y otros agentes de desarrollo.

En un proyecto que irá creciendo por etapas, tener contratos claros entre las distintas partes del sistema nos resulta especialmente útil.

## ¿Qué costo tiene?

TypeScript agrega algo de trabajo inicial porque debemos definir tipos y resolver errores del compilador.

Aceptamos ese costo porque esperamos que reduzca errores y facilite el mantenimiento a medida que el proyecto crezca.

---
