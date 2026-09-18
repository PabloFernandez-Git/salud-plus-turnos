# 35. Organización por módulos de dominio

El proyecto se organizará principalmente por funcionalidades del negocio.

Ejemplo:

```text
modules/
├── appointments/
├── patients/
├── professionals/
├── availability/
├── specialties/
├── users/
└── centers/
```

## ¿Por qué?

En una estructura puramente por tipo, una funcionalidad puede quedar repartida entre muchas carpetas:

```text
schemas/
services/
actions/
components/
types/
```

Con módulos de dominio, el objetivo es mantener juntas las piezas relacionadas.

Esto también ayuda al Agent Harness: una tarea sobre turnos puede cargar el módulo `appointments`, su documentación y sus tests sin necesitar recorrer todo el proyecto.

La estructura interna exacta de cada módulo se definirá en la siguiente decisión.
