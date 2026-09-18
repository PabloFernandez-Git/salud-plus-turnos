# 23. Spike de React Big Calendar

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

El spike no usará Supabase ni datos reales.

Trabajará con:

```text
3 profesionales
+
turnos ficticios
+
duraciones de 20 / 30 / 45 minutos
```

y probará:

- vista día;
- vista semana;
- vista mes;
- eventos simultáneos;
- selección de espacios libres;
- personalización;
- responsive;
- integración con Tailwind.

## Criterio de decisión

Si React Big Calendar resuelve estos casos con una implementación clara y sin workarounds importantes, podrá adoptarse.

Si aparecen limitaciones relevantes, se reconsiderará la estrategia.

Por lo tanto:

> React Big Calendar es actualmente el candidato principal, no una decisión definitiva.
