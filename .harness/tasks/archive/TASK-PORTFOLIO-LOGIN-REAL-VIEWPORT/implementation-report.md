# Implementación y verificación — viewport útil real del login DEMO

## Breakpoint y comparación

En Chromium con viewport fijado a 1366 × 608, `window.innerHeight === 608`. `matchMedia('(min-width: 1200px) and (min-height: 740px) and (max-height: 800px)').matches` devolvió **false**; la regla de `27ed830` no se aplicaba. La regla de baja altura (`min-width: 768px`, `max-height: 670px`) devolvió **true**.

La captura actual antes de este ajuste coincidía con la [captura anterior](../TASK-PORTFOLIO-LOGIN-HEIGHT/1366x608-error.png): en el estado más alto (widget de 300 × 65 px más error y reintento), el panel ocupaba y=13–596, 583 px de alto. La tarjeta interior medía 433 px; el documento, 608 px.

## Ajuste

Se añadió una regla CSS para escritorios de al menos 1200 px de ancho y hasta 640 px de alto, solo con «Iniciar sesión» seleccionada. El padding vertical exterior aumenta de 8 a 16 px; se recuperan esos 16 px con ajustes pequeños en el padding del panel claro, la separación pestañas–tarjeta y las dos separaciones del bloque inferior. **La tarjeta interior permanece en 433 px y el widget en 300 × 65 px.** El panel final mide 567 px y queda en y=21–588: gana 8 px de margen exterior por lado sin aumentar el documento.

## Verificación visual

Playwright/Chromium local a zoom 100 %. Se usó una representación visual controlada de Turnstile, con callbacks de carga, widget, completada y error, sin enviar formularios ni simular autenticación. [Captura nueva a 1366 × 608 con widget y error](1366x608-error-login.png).

| Viewport | Pestaña / estado | `innerHeight` | `scrollHeight` | Resultado |
| --- | --- | ---: | ---: | --- |
| 1366 × 608 | Login: carga, widget, completada, error + reintento | 608 | 608 | Todo visible; panel de error y=21–588 |
| 1366 × 608 | Demo invitado: los mismos cuatro estados | 608 | 608 | Medidas intactas; error con panel de 495 px |
| 1366 × 680 | Ambos tabs con widget + error | 680 | 680 | Sin cambios respecto al ajuste previo |
| 1366 × 768 | Ambos tabs con widget + error | 768 | 768 | Sigue aplicando la regla de 740–800 px solo al login |
| 1440 × 900 | Ambos tabs con widget + error | 900 | 900 | Sin cambios |
| 390 × 844 | Login con widget + error | 844 | 887 | Scroll vertical móvil natural; sin scroll horizontal ni cambio de CSS |
| 390 × 844 | Demo invitado con widget + error | 844 | 844 | Sin cambios ni scroll horizontal |

En el caso prioritario, el botón de ingreso termina en y=504 y el enlace inferior en y=577; ambos están completos. El error y el reintento permanecen visibles. Las capturas de 608 px antes y después se inspeccionaron visualmente.

## Validaciones y límites

- Prettier, ESLint y typecheck: PASS.
- Vitest focal de login y Turnstile con `--configLoader runner`: 11/11 PASS.
- `pnpm bootstrap`: Node y pnpm correctos; detenido porque falta `.env.local` en este worktree.
- No se ejecutó build ni acceso real. La restricción de dominio impide completar Turnstile real en localhost; la verificación acredita el layout con widget visual, no el ingreso.
