# TASK-PORTFOLIO-LOGIN-ICONS — iconos del login DEMO

## Objetivo

Agregar iconos outline decorativos a las dos pestañas y a los dos controles inferiores de cambio de pestaña del login DEMO, de acuerdo con la referencia aprobada, sin rediseñar la vista ni alterar la autenticación.

## Criterios de aceptación

- «Iniciar sesión» lleva User y «Demo invitado» lleva CirclePlay; el icono hereda el color del estado activo o inactivo y se alinea con el texto sin cambiar el ancho de las dos columnas.
- El control inferior de cada pestaña mantiene su texto y muestra CirclePlay o User antes y ArrowRight después, dentro de un único botón con focus y acción existentes.
- Los SVG son decorativos, sin nombre accesible adicional. La navegación con teclado y el Turnstile compartido siguen funcionando.
- Panel izquierdo, curvas, tarjeta, campos, botones principales, dimensiones y login fuera de DEMO no cambian.
- Pasan tests focales, typecheck, ESLint, Prettier y build DEMO con webpack; revisión visual en localhost:3001 si está disponible; commit local sin publicación.

## Riesgos e impacto

- El texto largo del control inferior debe permanecer en línea en escritorio y caber en móvil sin scroll horizontal.
- Los iconos no deben cambiar el nombre accesible de los tabs ni crear superficies interactivas independientes.
- Lucide no está instalado; se usarán SVG inline de 20 px en el componente existente, sin dependencias.
