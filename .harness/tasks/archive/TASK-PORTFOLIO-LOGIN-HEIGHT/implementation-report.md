# Implementación y verificación — altura real del login DEMO

## Causa

La primera compactación se midió hasta un viewport de 680 px. Con 1366 × 608, el estado de carga ocupa 534 px de shell y no desborda. El widget visible de 300 × 65 px lleva el shell a 607 px y el documento a 639 px. Si se muestra además el mensaje de error con reintento, el shell sube a 635 px y el documento a 667 px: **59 px de scroll**. La altura mínima del shell ya estaba anulada; el exceso procede de la suma del widget, el error y los espacios verticales del formulario.

## Ajuste

En `src/app/globals.css` se añadió un media query para escritorio (`min-width: 768px`) con viewport de `max-height: 670px`. Solo se activa cuando la pestaña «Iniciar sesión» está seleccionada. Reduce el padding vertical exterior y del panel, el espacio bajo las pestañas, el padding vertical de la tarjeta y los márgenes entre bloques del formulario. No cambia ancho, tipografía, tamaño del widget, colores, controles ni comportamiento de Turnstile. «Demo invitado» no recibe estas reglas.

## Verificación visual

Playwright/Chromium local a zoom 100 %. El navegador de prueba representó Turnstile con un rectángulo de **300 × 65 px**, sin cambiar la aplicación. Los callbacks controlados permitieron inspeccionar carga, widget presente, verificación completada y widget junto con error y reintento. No se envió un formulario ni se simuló autenticación real. Se inspeccionaron capturas de los estados.

| Viewport | Estado de «Iniciar sesión» | `scrollHeight` | Resultado |
| --- | --- | ---: | --- |
| 1366 × 608 | Carga | 608 px | Completo |
| 1366 × 608 | Widget visible | 608 px | Completo |
| 1366 × 608 | Verificación completada | 608 px | Completo |
| 1366 × 608 | Widget + error + reintento | 608 px | Completo; botón y enlace inferior visibles |
| 1366 × 680 | Los cuatro estados | 680 px | Completos; se conservan reglas anteriores |
| 1440 × 900 | Los cuatro estados | 900 px | Completos; se conservan reglas anteriores |
| 390 × 844 | Carga, widget, completada | 844 px | Completos, sin scroll horizontal |
| 390 × 844 | Widget + error + reintento | 887 px | Scroll vertical móvil natural; sin scroll horizontal ni cambio de estilos |

El estado de error también se comprobó a 1366 × 660 (660 px de documento) y 1366 × 671 (671 px de documento), a ambos lados del nuevo breakpoint. «Demo invitado» a 1366 × 608 mide 608 px con widget + error y conserva su disposición. [Captura del caso prioritario](1366x608-error.png), con la representación visual controlada.

## Verificaciones técnicas y límites

- `pnpm bootstrap`: Node y pnpm correctos; se detuvo porque falta `.env.local` en este worktree.
- Prettier focal, ESLint focal, `pnpm typecheck` y `git diff --check`: PASS.
- Vitest focal de login y Turnstile con `--configLoader runner`: 11/11 PASS.
- Turnstile real no completó el desafío en localhost por la restricción de dominio; no se probaron autenticación ni ingreso real. No se ejecutó build porque el worktree no dispone de `.env.local`.
