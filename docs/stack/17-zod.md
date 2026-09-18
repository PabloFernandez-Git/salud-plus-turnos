# 17. Zod

## ¿Qué es?

Zod es una librería de validación para TypeScript.

Permite definir qué forma debe tener un dato y verificarlo mientras la aplicación está ejecutándose.

Ejemplo conceptual:

```ts
const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
});
```

## ¿Por qué lo elegimos?

TypeScript ayuda durante el desarrollo, pero no valida automáticamente los datos reales que llegan desde formularios o peticiones.

Zod permite comprobar esos datos antes de utilizarlos.

La regla será:

```text
Datos externos
→ Zod
→ lógica de negocio
→ PostgreSQL
```

## ¿Dónde se utilizará?

Principalmente en:

- formularios;
- server actions;
- route handlers;
- inputs de creación y edición;
- parámetros provenientes del cliente.

## Cliente y servidor

Zod puede utilizarse en el cliente para mostrar errores rápidamente.

Sin embargo, las operaciones que modifican datos deberán validar nuevamente en el servidor.

```text
Cliente
→ validación para UX

Servidor
→ validación de confianza
```

## Relación con TypeScript

Zod puede inferir tipos TypeScript:

```ts
type PatientInput = z.infer<typeof patientSchema>;
```

Esto permite reutilizar una misma definición para validación y tipado de inputs.

## Qué no debe hacer Zod

Zod valida la forma y reglas inmediatas del dato.

No reemplaza:

- lógica de negocio;
- permisos;
- restricciones de base de datos;
- foreign keys;
- UNIQUE;
- RLS.

Ejemplo:

```text
"14:00" es una hora válida
→ Zod

El profesional no trabaja a las 14:00
→ lógica de negocio
```

Mantener esta separación será parte importante del diseño del proyecto.
