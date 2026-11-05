# Implementación y verificación — aire vertical del login DEMO

## Criterio aplicado

El ajuste anterior dejaba en 1366 × 768 una tarjeta de 433 px con widget completado, padding vertical de 24 px y separaciones internas de 12 px. Había espacio disponible en el viewport. Se añadió en `src/app/globals.css` una regla para escritorios de al menos 1200 px de ancho y 740–800 px de alto que se activa solo cuando «Iniciar sesión» está seleccionada. Incrementa ligeramente el padding vertical del panel claro y la tarjeta, la separación entre pestañas y tarjeta, los espacios del formulario y el espacio sobre el enlace inferior. No cambia tamaños horizontales, controles, tipografía, colores ni lógica.

## Verificación visual

Playwright/Chromium local a zoom 100 %, con representación visual controlada de Turnstile de **300 × 65 px**. No se envió el formulario ni se simuló autenticación. Se revisaron capturas y dimensiones del documento.

| Viewport y estado | Antes | Después | Resultado |
| --- | --- | --- | --- |
| 1366 × 768, login completado | Shell 607 px; tarjeta 433 px | Shell 639 px; tarjeta 449 px | Más aire, `scrollHeight` 768 px; botón y enlace visibles |
| 1366 × 768, login con widget + error + reintento | Shell 635 px | Shell 667 px | `scrollHeight` 768 px; enlace inferior termina en y=693 |
| 1366 × 768, Demo invitado con error | Shell 495 px; tarjeta 321 px | Idéntico | Sin cambio visible ni scroll |
| 1366 × 608, login con widget + error + reintento | Shell 583 px | Idéntico | `scrollHeight` 608 px; todo visible |
| 1366 × 680, login con widget + error + reintento | Shell 635 px | Idéntico | `scrollHeight` 680 px; todo visible |
| 390 × 844, login con widget + error + reintento | Documento 887 px | Idéntico | Scroll vertical móvil natural; sin scroll horizontal |

La regla no alcanza los viewports de 608 y 680 px ni móvil. [Captura de login en 1366 × 768](1366x768-complete-login.png) con el widget visual controlado.

## Validaciones y límites

- Prettier, ESLint y typecheck: PASS.
- Vitest focal de login y Turnstile: 11/11 PASS (`--configLoader runner`).
- `pnpm bootstrap`: Node y pnpm correctos; se detuvo por ausencia de `.env.local` en este worktree.
- No se ejecutó build ni acceso real. Turnstile real no completó el desafío en localhost por la restricción de dominio; la verificación es de layout.
