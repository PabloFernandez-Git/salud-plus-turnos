# 8. PostgreSQL

## ¿Qué es?

PostgreSQL es una base de datos relacional que utiliza SQL.

Permite organizar información en tablas y establecer relaciones entre ellas mediante claves y restricciones.

En nuestro producto tendremos relaciones como:

- Centro ↔ Usuario;
- Centro ↔ Profesional;
- Persona ↔ PacienteEnCentro;
- Profesional ↔ ProfesionalEnCentro;
- Turno ↔ PacienteEnCentro;
- Turno ↔ ProfesionalEnCentro;
- Turno ↔ Especialidad.

## ¿Por qué lo elegimos?

Nuestro dominio es claramente relacional.

PostgreSQL permite expresar bien:

- relaciones;
- claves foráneas;
- restricciones;
- unicidad;
- integridad de datos;
- consultas complejas;
- transacciones.

Además, el conocimiento aprendido con PostgreSQL es conocimiento SQL real y transferible a otros sistemas relacionales.

## ¿Por qué no MySQL?

MySQL también podría resolver el proyecto.

Elegimos PostgreSQL porque encaja especialmente bien con un dominio con muchas relaciones y restricciones, y porque Supabase utiliza PostgreSQL como base.

La diferencia no implica que MySQL sea una mala opción; simplemente PostgreSQL resulta más conveniente para este proyecto.

---
