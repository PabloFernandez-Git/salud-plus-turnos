# 19. Estructura interna de los módulos

## Decisión aprobada

**Arquitectura modular con capas ligeras dentro de cada módulo.**

### Principio general

La organización interna seguirá estas responsabilidades:

```text
app/
→ routing, layouts, pages y composición

modules/
→ funcionalidades del producto

module/components/
→ UI específica del módulo

module/schemas/
→ schemas Zod

module/queries/
→ operaciones de lectura

module/actions/
→ operaciones que modifican estado

module/domain/
→ lógica de negocio pura

components/
→ UI reutilizable global

lib/
→ infraestructura y utilidades compartidas
```

### Crecimiento progresivo

No se crearán carpetas vacías ni capas por anticipado.

Un módulo pequeño podrá comenzar con pocos archivos en su raíz y evolucionar hacia subcarpetas cuando la complejidad real lo justifique.

### Lógica de negocio

Se utilizará preferentemente `domain/` para reglas puras de negocio en lugar de un `services/` genérico.

Ejemplos:

- validación de transiciones de estado;
- cálculo de disponibilidad;
- detección de solapamientos;
- reglas que no necesitan React ni Supabase.

### Datos

Las lecturas habituales estarán en `queries/`.

Las operaciones que cambian estado estarán en `actions/` y deberán coordinar, cuando corresponda:

- autenticación;
- autorización;
- Zod;
- reglas de negocio;
- persistencia.

### Tipos

Se evitará duplicar tipos innecesariamente.

Cuando corresponda se preferirá inferir tipos desde:

- schemas Zod;
- tipos generados de Supabase.

Se crearán tipos propios únicamente cuando representen conceptos de dominio que realmente lo necesiten.

### Testing

Los tests unitarios y de componentes se colocarán cerca del código que prueban.

Los tests End-to-End vivirán de forma separada, por ejemplo:

```text
tests/e2e/
```

### Next.js App Router

`src/app/` deberá mantenerse relativamente delgado.

Su responsabilidad principal será:

- routing;
- layouts;
- páginas;
- composición.

La lógica del producto deberá permanecer en los módulos.

### Dependencias entre módulos

Los módulos podrán consumir APIs públicas de otros módulos, evitando imports profundos a archivos internos.

Cuando sea útil, cada módulo podrá exponer una API pública mediante `index.ts`.

Ejemplo:

```ts
import { getPatientById } from "@/modules/patients";
```

en lugar de importar desde rutas internas profundas.

### Relación con el harness

Esta estructura facilita el context routing.

Por ejemplo:

```text
Tarea: reprogramar turno

Contexto principal:
- modules/appointments
- modules/availability

Documentación:
- docs/modules/appointments.md
- docs/modules/availability.md
```

### Estado

**Aprobado**
