# TASK-PORTFOLIO-LOGIN-VISUAL — refinamiento final DEMO

## Objetivo

Refinar solo la presentación del login DEMO para acercarla a la referencia aprobada: división con dos grandes curvas, panel izquierdo azul/verde y tarjeta blanca interior en el panel derecho.

## Criterios de aceptación

- El contenedor sigue centrado, con dos paneles en escritorio y panel decorativo oculto en móvil.
- La división presenta únicamente las curvas superior e inferior del borde izquierdo del panel claro; entre ellas es vertical.
- El panel izquierdo ocupa aproximadamente 43–45% visible y contiene Salud Plus, línea verde, cruz translúcida y ondas verdes inferiores.
- Las pestañas permanecen arriba; el formulario activo está dentro de una tarjeta blanca con sombra; el enlace de cambio está debajo de ella.
- Copy, títulos, campos, botones, navegación, Turnstile compartido, autenticación y estados siguen funcionando igual.
- No hay desbordamiento móvil. Pasan tests focales, typecheck, ESLint, Prettier y build DEMO con webpack.

## Riesgos e impacto

- El solapamiento y los radios no deben ocultar contenido ni causar scroll horizontal en tablet/móvil.
- Mover el enlace fuera del formulario no debe alterar el cambio de pestaña ni disparar Auth.
- Solo se modifican componentes visuales DEMO, pruebas focales y documentación del harness/status. Sin cambios en login real, Auth, Supabase, Cloudflare, Vercel, variables, migraciones, main, DEV ni TASK-029.
