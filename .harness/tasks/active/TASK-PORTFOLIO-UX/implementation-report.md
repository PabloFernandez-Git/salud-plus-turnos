# TASK-PORTFOLIO-UX — implementación local

## Ajuste posterior: acciones visibles y deshabilitadas

- Las acciones de escritura vuelven a sus lugares en listados, encabezados y detalles. En DEMO usan botones `disabled` nativos; los enlaces a crear turno se convierten en botones deshabilitados sin ruta de navegación.
- Agenda vuelve a permitir consultar horarios disponibles mediante selección de franja; el enlace final para crear turno queda deshabilitado. Las vistas y filtros siguen operables.
- El detalle de paciente mantiene sus campos de lectura y muestra Guardar, Desactivar o Reactivar deshabilitados. Usuarios y configuración recuperan columnas y acciones originales con bloqueo en DEMO.
- Fuera de DEMO se conservan los controles y flujos CRUD. Las protecciones de Server Actions y PostgreSQL siguen intactas.
- Verificación del ajuste: 211/211 pruebas en nueve suites focales, typecheck, ESLint focal y build de producción con `PORTFOLIO_DEMO_MODE=true` y webpack: PASS. Turbopack no admite el junction local de `node_modules` fuera del worktree; el build con webpack pasó. `pnpm bootstrap` tampoco puede usar ese junction, por lo que se ejecutaron las herramientas instaladas directamente con Node.

- Las páginas de servidor leen `PORTFOLIO_DEMO_MODE` y pasan `isPortfolioDemo` a las vistas afectadas. El layout muestra el aviso: «Disponible en la versión completa. Esta demo es de solo lectura».
- El commit anterior ocultaba controles de escritura y bloqueaba la selección de horarios en Agenda; el ajuste posterior descrito arriba reemplaza esa presentación. La ruta directa de nuevo turno sigue mostrando un aviso y enlace de regreso.
- El login conserva la entrada, pero oculta recuperación; sus rutas directas muestran el aviso sin formularios. Fuera de DEMO, los componentes usan `isPortfolioDemo=false` por defecto y preservan el CRUD anterior.
- No se tocaron Server Actions, migraciones, grants, Supabase ni TASK-029.

## Verificación

- Pruebas focales de diez archivos: 219/220 en el primer pase. Un test existente de Turnos cruzó el milisegundo exacto de inicio; se fijó el reloj de ese caso y el archivo completo pasó 32/32. Las otras nueve suites pasaron inicialmente.
- Auth y listado de Turnos tras las últimas adaptaciones: 7/7; Auth tras ajustar el texto del callback: 2/2.
- Typecheck, ESLint focal, Prettier, `git diff --check`, build de producción normal y build con `PORTFOLIO_DEMO_MODE=true`: PASS.
- `pnpm bootstrap` se intentó; pnpm rechazó el junction de `node_modules` compartido por estar fuera del worktree. Las herramientas instaladas se ejecutaron directamente con Node, sin modificar dependencias.

La verificación en el sitio Vercel corresponde al despliegue posterior de este commit; no se hizo push ni despliegue durante esta tarea.
