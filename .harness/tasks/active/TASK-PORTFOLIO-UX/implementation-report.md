# TASK-PORTFOLIO-UX — implementación local

- Las páginas de servidor leen `PORTFOLIO_DEMO_MODE` y pasan `isPortfolioDemo` a las vistas afectadas. El layout muestra el aviso: «Disponible en la versión completa. Esta demo es de solo lectura».
- En DEMO se ocultan controles de creación, edición, activación, desactivación, estado, nota y reprogramación. Agenda no permite seleccionar horarios para crear turnos. Pacientes y configuración muestran datos sin campos editables; usuarios conserva listado y roles. La ruta directa de nuevo turno muestra un aviso y enlace de regreso.
- El login conserva la entrada, pero oculta recuperación; sus rutas directas muestran el aviso sin formularios. Fuera de DEMO, los componentes usan `isPortfolioDemo=false` por defecto y preservan el CRUD anterior.
- No se tocaron Server Actions, migraciones, grants, Supabase ni TASK-029.

## Verificación

- Pruebas focales de diez archivos: 219/220 en el primer pase. Un test existente de Turnos cruzó el milisegundo exacto de inicio; se fijó el reloj de ese caso y el archivo completo pasó 32/32. Las otras nueve suites pasaron inicialmente.
- Auth y listado de Turnos tras las últimas adaptaciones: 7/7; Auth tras ajustar el texto del callback: 2/2.
- Typecheck, ESLint focal, Prettier, `git diff --check`, build de producción normal y build con `PORTFOLIO_DEMO_MODE=true`: PASS.
- `pnpm bootstrap` se intentó; pnpm rechazó el junction de `node_modules` compartido por estar fuera del worktree. Las herramientas instaladas se ejecutaron directamente con Node, sin modificar dependencias.

La verificación en el sitio Vercel corresponde al despliegue posterior de este commit; no se hizo push ni despliegue durante esta tarea.
