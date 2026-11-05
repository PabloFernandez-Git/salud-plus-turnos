# Implementación

- El panel azul ocupa 47% de la grilla; el panel claro se superpone 24 px, dejando aproximadamente 44–45% azul visible. Dos radios de 5rem en el borde izquierdo claro forman únicamente las curvas superior e inferior, con tramo central vertical.
- El panel izquierdo conserva la cruz CSS translúcida y suma una línea verde bajo «Salud Plus» y dos ondas verdes/turquesas bajas. No se incorporaron imágenes ni dependencias.
- El contenido activo se muestra en una tarjeta blanca interior con radio amplio, sombra y padding. Las pestañas quedan arriba y el enlace de cambio queda fuera de esa tarjeta y fuera del formulario.
- Se mantuvieron las mismas acciones, campos y el único Turnstile compartido. `AuthCard` fuera de DEMO no cambió.

## Verificación

- Tests focales: 4 archivos, 14 tests PASS con `vitest --configLoader runner`.
- `pnpm typecheck`, ESLint focal y Prettier: PASS.
- Build de producción DEMO con webpack: PASS con valores sintéticos limitados al proceso; no se creó ni editó `.env.local`.
- Revisión visual en producción local a 1280 × 800, 900 × 800 y 375 × 812: sin scroll horizontal; tabs a la misma altura al alternar; título invitado en una línea en escritorio/tablet y dos en móvil. Separación visual con dos curvas y tramo central recto.
- `pnpm bootstrap`: Node y pnpm correctos; falla por ausencia preexistente de `.env.local`.

## Límite local

El script externo de Turnstile no completó la carga durante las capturas locales, por lo que se mostró su error previsto. El token, su expiración y reset siguen cubiertos por tests. La imagen original de referencia no está disponible como archivo en este worktree; la geometría se ajustó según el texto aprobado.
