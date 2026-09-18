# 1. Next.js

## ¿Qué es?

Next.js es un framework construido sobre React.

React se ocupa principalmente de construir la interfaz. Next.js agrega alrededor de React herramientas para crear una aplicación web completa.

Entre otras cosas, incorpora:

- routing;
- layouts;
- código que puede ejecutarse en el servidor;
- endpoints y operaciones backend;
- integración entre frontend y backend dentro del mismo proyecto.

## ¿Por qué lo elegimos?

Nuestro producto no es únicamente una interfaz que consume datos públicos.

Necesitamos resolver cosas como:

- autenticación;
- usuarios;
- roles;
- permisos;
- múltiples centros;
- operaciones sobre base de datos;
- validaciones;
- acciones que no deberían ejecutarse directamente desde el navegador.

Con Next.js podemos mantener frontend y lógica de servidor dentro del mismo proyecto en lugar de crear desde el comienzo una aplicación React y un backend completamente separados.

## ¿Qué costo tiene?

Next.js agrega conceptos que una aplicación React SPA tradicional no necesita necesariamente, por ejemplo:

- Server Components;
- Client Components;
- código server-side;
- layouts;
- distintas estrategias de rendering.

Por ese motivo decidimos usar Next.js de manera conservadora.

No intentaremos utilizar todas sus capacidades desde el principio.

La prioridad será entender y utilizar únicamente aquello que el MVP necesite.

---
