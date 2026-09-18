# 18. Organización interna por módulos de dominio

## Decisión aprobada

**La estructura principal de `src/` estará orientada a módulos del dominio.**

### Principio general

El código se organizará principalmente según las áreas funcionales del producto, por ejemplo:

```text
src/
├── modules/
│   ├── appointments/
│   ├── patients/
│   ├── professionals/
│   ├── availability/
│   ├── specialties/
│   ├── users/
│   └── centers/
│
├── components/
├── lib/
└── app/
```

### Motivos principales

- mantiene juntas las piezas relacionadas con una misma funcionalidad;
- facilita navegar el código a medida que el proyecto crece;
- reduce la dispersión entre carpetas globales como `services/`, `schemas/` y `actions/`;
- mejora el context routing del harness;
- permite que una tarea sobre un módulo cargue principalmente su código, documentación y tests relacionados;
- favorece ownership y límites más claros entre áreas del dominio.

### Pendiente

Todavía debe definirse la estructura interna de cada módulo, incluyendo dónde viven:

- schemas Zod;
- queries de Supabase;
- Server Actions;
- lógica de negocio;
- tipos;
- componentes específicos;
- tests.

También deberá definirse qué código permanece global y qué código pertenece a un módulo.

### Estado

**Aprobado**
