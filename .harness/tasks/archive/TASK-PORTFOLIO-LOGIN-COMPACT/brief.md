# TASK-PORTFOLIO-LOGIN-COMPACT — compactar login DEMO

## Objetivo

Mostrar completas ambas pestañas de `/login` en un escritorio de 1366 × 768 al 100 %, con margen para la interfaz del navegador, sin scroll.

## Criterios de aceptación

- En «Iniciar sesión» se ven campos, CAPTCHA, botón y enlace inferior.
- En «Demo invitado» se ven contenido, CAPTCHA, botón y enlace inferior.
- Una pantalla grande conserva el aspecto actual y la vista móvil sigue siendo usable sin recortes.
- Se conservan colores, degradados, cruz, columnas, tipografía, controles, bordes, lógica y tamaño del widget Turnstile.
- Los cambios se limitan a dimensiones, padding y espaciados verticales; no se usa `transform: scale()` ni se oculta contenido.
- Hay verificación visual, revisión y un único commit local; sin push ni deploy.

## Impacto y riesgos

Solo afectan las clases de presentación del shell y el formulario DEMO en `src/modules/access/components/`. El riesgo principal es que el widget Turnstile o su mensaje de error aumenten la altura y generen scroll, o que la compactación afecte móvil y monitores altos. Se verifican ambos estados de pestaña, escritorio grande y móvil. Si Turnstile falla por dominio en localhost, se valida el layout sin alterar CAPTCHA ni afirmar acceso real.
