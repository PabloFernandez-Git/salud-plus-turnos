# 23. Spike de React Big Calendar

**Estado:** completado con Review `PASS`; React Big Calendar adoptado como base de la agenda para el
MVP.

## ¿Qué es un spike?

Un spike es una implementación pequeña y deliberadamente acotada cuyo objetivo no es construir una funcionalidad final, sino responder una duda técnica.

En este caso la pregunta es:

> ¿React Big Calendar puede soportar nuestra agenda sin obligarnos a luchar contra la librería?

## ¿Por qué no decidimos la librería directamente?

Porque nuestra agenda tiene requisitos específicos:

```text
Vista Día
→ profesionales como columnas

Vista Semana
→ días como columnas
→ uno o varios profesionales
→ eventos simultáneos

Vista Mes
→ resumen de actividad
```

La agenda es el corazón operativo del producto, por lo que conviene validar la herramienta antes de comprometer la arquitectura.

## Alcance del spike

El spike no usó Supabase ni datos reales.

Trabajó con:

```text
3 profesionales
+
turnos ficticios
+
duraciones de 20 / 30 / 45 minutos
```

y probó:

- vista día;
- vista semana;
- vista mes;
- eventos simultáneos;
- selección de espacios libres;
- personalización;
- responsive;
- integración con Tailwind.

## Resultado

El spike validó las capacidades centrales en Día, Semana y Mes, la integración con el stack y una
experiencia desktop directa. La review identificó resultados `PARTIAL` en la legibilidad de nombres
bajo simultaneidad y en 375/768 px, donde se requiere scroll horizontal.

La decisión humana posterior aceptó esas limitaciones y adoptó React Big Calendar para el MVP con un
enfoque desktop-first. El detalle de la decisión está en
[`docs/decisions/10-agenda-calendario.md`](../decisions/10-agenda-calendario.md), y la evidencia del
spike queda archivada en `.harness/tasks/archive/TASK-002/`.
