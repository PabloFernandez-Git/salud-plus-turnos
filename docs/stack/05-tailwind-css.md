# 5. Tailwind CSS

## ¿Qué es?

Tailwind CSS es un sistema de estilos basado en clases utilitarias.

En lugar de crear una clase CSS específica para cada elemento, permite componer estilos directamente desde el componente.

Ejemplo conceptual:

```tsx
<button className="px-4 py-2 rounded-md font-semibold">
  Nuevo turno
</button>
```

## ¿Por qué lo elegimos?

Nuestro producto tendrá muchas interfaces administrativas:

- formularios;
- tablas;
- filtros;
- paneles;
- agenda;
- sidebar;
- estados;
- modales.

Tailwind permite construir estas interfaces con rapidez y mantener los estilos cerca de los componentes.

También facilita mantener una estética consistente sin depender de una biblioteca visual cerrada.

## ¿Qué costo tiene?

Las clases pueden resultar verbosas al principio.

Requiere acostumbrarse a leer y componer utilidades directamente en el markup.

Aceptamos ese costo porque ofrece flexibilidad y velocidad para un proyecto de interfaz rica.

---
