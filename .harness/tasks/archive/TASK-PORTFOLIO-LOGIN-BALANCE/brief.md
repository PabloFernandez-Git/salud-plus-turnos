# TASK-PORTFOLIO-LOGIN-BALANCE — aire vertical del login DEMO

## Objetivo

Dar un poco más de aire vertical a «Iniciar sesión» en `/login` a 1366 × 768, manteniendo su diseño y el resultado sin scroll de los viewports bajos.

## Criterios de aceptación

- A 1366 × 768, «Iniciar sesión» tiene más espacio vertical alrededor de la tarjeta y dentro de ella; widget, botón y enlace inferior siguen completos sin scroll.
- «Demo invitado» no recibe cambios visibles.
- A 1366 × 608, widget de tamaño completo, error y reintento siguen sin scroll; 1366 × 680 y 390 × 844 no empeoran.
- No se modifican estructura, marca, tipografía, autenticación ni Turnstile.
- Prettier, ESLint, typecheck y pruebas focales pasan; después se crea un único commit local sin push ni deploy.

## Impacto y riesgos

Solo CSS del login DEMO en un rango de altura de escritorio donde existe holgura. El riesgo es recuperar scroll en estados de Turnstile más altos o alterar «Demo invitado»; se miden ambas pestañas y los estados de carga, widget, completada y error con un widget visual controlado de 300 × 65 px.
