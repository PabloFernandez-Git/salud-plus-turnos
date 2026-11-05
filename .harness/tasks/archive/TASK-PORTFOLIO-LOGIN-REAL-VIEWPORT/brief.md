# TASK-PORTFOLIO-LOGIN-REAL-VIEWPORT — aire vertical con viewport útil real

## Objetivo

En `/login`, dar a «Iniciar sesión» un poco más de margen exterior arriba y abajo con `window.innerHeight` cercano a 608 px en un monitor físico de 1366 × 768, sin scroll ni pérdida de controles.

## Criterios de aceptación

- Registrar `window.innerHeight` y `matchMedia` a 1366 × 608; confirmar si la regla anterior de 740–800 px aplica.
- Comparar captura anterior y resultado nuevo. El panel queda más separado de los bordes del viewport sin crecer ni desequilibrar la tarjeta.
- A 1366 × 608, ambas pestañas muestran widget, error, reintento, botones y enlaces; `scrollHeight === innerHeight`.
- 1366 × 680, 1366 × 768, 1440 × 900 y 390 × 844 conservan el comportamiento validado.
- Sin cambios de autenticación, Turnstile, marca, tipografía ni diseño general. Un commit local adicional, sin push ni deploy, si la verificación pasa.

## Impacto y riesgos

Solo CSS del login DEMO acotado al rango de altura útil bajo. El riesgo es recortar el estado más alto de Turnstile o afectar «Demo invitado». La verificación usa un widget visual de 300 × 65 px y el mensaje de error simultáneo, sin simular acceso real.
