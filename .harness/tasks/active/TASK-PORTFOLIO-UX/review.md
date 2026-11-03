# TASK-PORTFOLIO-UX — review local

## Revisión del ajuste de botones deshabilitados

**PASS para commit local.** Los controles de escritura recuperan su posición en encabezados, listados y detalles; en DEMO son botones nativos deshabilitados y no abren formularios ni navegan a creación. La selección de horarios de Agenda conserva la consulta, con la continuación a creación deshabilitada. Los controles de lectura siguen activos y las pruebas de CRUD fuera de DEMO permanecen verdes. Se comprobaron 211 pruebas focales, typecheck, ESLint focal y build DEMO con webpack. No se cambió la autorización de servidor ni PostgreSQL. Queda pendiente la inspección visual del sitio tras una publicación autorizada.

**PASS para commit local.**

Se revisaron las entradas de escritura de Agenda, Turnos, Pacientes, Profesionales, Especialidades, Disponibilidad, Usuarios, Configuración y recuperación Auth. En DEMO no se presenta un formulario de escritura operable; las rutas de lectura, filtros, enlaces de detalle y login permanecen disponibles. Los tests existentes de CRUD fuera de DEMO pasaron. Las protecciones de Server Actions y PostgreSQL del Portfolio MVP no cambiaron.

Riesgo residual: la interfaz depende de configurar `PORTFOLIO_DEMO_MODE=true` en el despliegue; la seguridad de datos sigue dependiendo de los grants y RLS ya aplicados. La UI publicada requiere un smoke visual después de publicar este commit. La API directa de Supabase Auth para cambiar credenciales propias conserva el límite operativo documentado en `docs/portfolio-demo.md`.
