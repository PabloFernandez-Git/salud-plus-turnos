# 6. shadcn/ui

## ¿Qué es?

shadcn/ui ofrece componentes de interfaz que se incorporan directamente al código del proyecto.

No funciona como una gran biblioteca cerrada de la que importamos todo.

Cuando necesitamos un componente, por ejemplo:

- Button;
- Dialog;
- Select;
- Table;

agregamos ese componente al proyecto y su código queda disponible dentro del repositorio.

Ejemplo conceptual:

```text
components/
└── ui/
    ├── button.tsx
    ├── dialog.tsx
    └── select.tsx
```

## ¿Por qué lo elegimos?

Nos permite evitar construir desde cero componentes comunes y complejos, especialmente aquellos que requieren buen comportamiento y accesibilidad.

Al mismo tiempo conserva un alto nivel de control:

- podemos leer el código;
- modificarlo;
- adaptarlo;
- eliminarlo;
- integrarlo con nuestro diseño.

## ¿Agrega peso innecesario?

No se incorpora automáticamente todo shadcn/ui.

La regla del proyecto será:

> agregar únicamente los componentes que realmente necesitamos.

Por lo tanto, si usamos Button, Dialog y Select, no estamos incorporando automáticamente calendarios, gráficos, tablas avanzadas u otros componentes.

Algunos componentes complejos pueden sumar dependencias propias, pero solo cuando los incorporamos.

## ¿Qué rol cumple dentro del diseño?

shadcn/ui será una base técnica de componentes, no la identidad visual del producto.

La aplicación deberá seguir teniendo decisiones propias de:

- layout;
- espaciado;
- tipografía;
- jerarquía;
- responsive;
- estados;
- identidad visual.

---
