# TASK-PORTFOLIO-LOGIN-HEIGHT — altura real del login DEMO

## Objetivo

Eliminar el scroll vertical de «Iniciar sesión» en `/login` con viewport de 1366 × 608 al 100 %, incluso si el widget Turnstile de tamaño completo y su mensaje de error con reintento se muestran simultáneamente.

## Criterios de aceptación

- En 1366 × 608 se ven formulario, CAPTCHA, botón y enlace inferior sin scroll en los estados carga, widget visible, verificación completada y error con reintento.
- Se comprueban visualmente y por `scrollHeight` 1366 × 608, 1366 × 680, 1440 × 900 y 390 × 844.
- «Demo invitado» mantiene su aspecto; escritorio grande y móvil no sufren regresiones.
- Se preservan diseño, tipografía, controles, tamaño de Turnstile, autenticación y seguridad. No se usa `transform: scale()` ni se oculta contenido.
- Si las verificaciones pasan, se crea un único commit local adicional sin push ni deploy.

## Impacto y riesgos

Solo clases de presentación de `/login` y un ajuste CSS acotado a escritorio bajo. El riesgo principal es que el estado de error de Turnstile agregue altura inesperada o que las reglas afecten «Demo invitado». Se mide el estado combinado widget + error con una representación controlada en el navegador de prueba, sin simular autenticación real.
