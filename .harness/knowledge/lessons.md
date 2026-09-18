# Lessons

Lecciones recurrentes y concisas del harness.

- Antes de fijar versiones del stack, validar los rangos peer del grafo real y confirmar con una instalación congelada; la major más reciente no implica compatibilidad entre TypeScript, ESLint y los plugins del framework.
- En scripts Node multiplataforma, los binarios provistos por pnpm pueden ser shims `.cmd` en Windows: usar `ComSpec` en `win32` con argumentos separados y mantener ejecución directa en POSIX. Un smoke test debe distinguir el lanzamiento del proceso de la disponibilidad del servicio externo.
- En spikes de UI dependientes de geometría, cubrir la lógica determinista en JSDOM y reservar navegador real para posiciones, solapamientos y overflow; documentar como `PARTIAL` cualquier workaround que conserve operabilidad sin satisfacer por completo la legibilidad o el ajuste responsive.
