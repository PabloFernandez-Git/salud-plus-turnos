# TASK-PORTFOLIO-UX — controles de solo lectura

## Objetivo

La demo publicada debe mostrar consultas y navegación sin invitar a completar formularios que no pueden guardar. La rama `codex/portfolio-mvp` conserva todos los controles de escritura en servidor y PostgreSQL.

## Criterios de aceptación

- En `PORTFOLIO_DEMO_MODE=true`, las acciones visibles de crear, editar, activar, desactivar, cancelar o reprogramar no abren formularios ni ejecutan mutaciones; aparece la explicación breve acordada.
- Agenda, turnos, pacientes, profesionales, especialidades, disponibilidad, usuarios y configuración conservan lectura, filtros, navegación y detalle.
- La ruta directa de creación de turno tampoco presenta un formulario operable en DEMO.
- La recuperación y actualización de contraseña no invitan a completar un formulario bloqueado en DEMO; el login sigue disponible.
- Fuera de DEMO, las operaciones CRUD mantienen su comportamiento actual.
- Pruebas focales, typecheck, build y revisión local PASS.

## Impacto y riesgos

- Cambia sólo la presentación de componentes existentes y la transmisión del modo desde el layout de servidor.
- No se modifican migraciones, grants, Supabase, Server Actions, RPC, TASK-029 ni infraestructura.
- El riesgo principal es ocultar accidentalmente una consulta o dejar visible una entrada a formulario; se revisarán todos los módulos indicados y se probarán ambos modos.
