# Review local — TASK-PORTFOLIO-LOGIN-HEIGHT

**PASS para commit local adicional.** El diff de producto agrega solo reglas de padding y separación vertical en `globals.css`, limitadas a escritorios de hasta 670 px de alto con «Iniciar sesión» activa. La captura de 1366 × 608 con widget de 300 × 65 px y error muestra formulario, botón, mensaje, reintento y enlace inferior completos. `scrollHeight === innerHeight` en los cuatro estados. 1366 × 680, 1440 × 900 y móvil se comprobaron; «Demo invitado» conserva el layout. Prettier, ESLint, typecheck y 11 pruebas focales pasan.

Límite: el widget es una representación visual controlada; la restricción de dominio impide validar Turnstile real y no se probó ingreso. En móvil el estado de error combinado requiere scroll vertical natural, igual que antes de esta regla de escritorio.
