# TASK-PORTFOLIO-LOGIN-LEFT — refinamiento del panel izquierdo DEMO

## Objetivo

Ajustar exclusivamente el panel decorativo izquierdo y la unión entre paneles del login DEMO para acercarlos a la referencia: dos curvas limpias, degradado azul/turquesa/verde, ondas inferiores, cruz translúcida más grande y nombre centrado en altura.

## Criterios de aceptación

- La curva superior pertenece a la esquina izquierda del panel claro y la inferior a la esquina derecha del azul, como en la captura de referencia. Entre ellas la separación es prácticamente vertical, sin puntas ni cortes.
- Las dos ondas inferiores quedan dentro del fondo izquierdo y no forman parte de la división.
- La cruz es más grande, menos opaca y se sitúa hacia el centro-derecha. «Salud Plus» y su línea verde quedan aproximadamente centrados en altura y alineados a la izquierda.
- El panel derecho, pestañas, tarjeta interior, copy, formularios, Turnstile y acciones permanecen intactos.
- Desktop/tablet no superponen el formulario; móvil mantiene su comportamiento y no hay scroll horizontal.
- Pasan tests focales, typecheck y build DEMO con webpack; se crea un commit local sin push ni deploy.

## Riesgos e impacto

- El fondo azul debe cubrir la curva superior y el claro la inferior sin crear una costura o punta de color.
- El ancho extendido del panel izquierdo no debe cambiar el tamaño ni el contenido del panel derecho.
- Solo se modifica `demo-login-shell.tsx` más pruebas/documentación de la tarea; sin cambios en Auth, Supabase, Cloudflare, Vercel, main, DEV, TASK-029 o dependencias.
