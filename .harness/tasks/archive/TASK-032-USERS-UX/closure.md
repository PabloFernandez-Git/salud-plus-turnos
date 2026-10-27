# TASK-032 — Cierre documental de Gestión de usuarios

**Estado propuesto: CLOSED / ARCHIVED.** La implementación ya está integrada en `main`. Este cierre documental será efectivo únicamente si la persona usuaria autoriza y fusiona el PR de archivo. Hasta entonces, TASK-032 sigue ACTIVE.

## Integración y evidencias históricas

- Implementación: [PR #40](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/40), [commit `d6e37e2`](https://github.com/PabloFernandez-Git/salud-plus-turnos/commit/d6e37e26e596b3e9be1e8d3103ed9bd43d803e37) y [merge `0fdb6f0`](https://github.com/PabloFernandez-Git/salud-plus-turnos/commit/0fdb6f0068682c54aab89c29953e7c528cc8abd7).
- [CI posterior al merge](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40593197450/job/122502398242): SUCCESS.
- [Revisión independiente del diff completo](review.md): APPROVED, sin hallazgos bloqueantes.
- La persona usuaria aprobó visualmente el resultado definitivo.
- [Informe de implementación](implementation-report.md), [brief](brief.md), [plan](plan.md), [resultados responsive](evidence/results.json), [resultados del modal](evidence/modal/results.json) y [manifiesto de integridad](integrity-manifest.md) conservan la evidencia de la tarea. Las capturas usan datos sintéticos.

## Alcance integrado

**Listado.** La tabla de escritorio y las tarjetas móviles muestran nombre, email, rol, estado y profesional asociado. Cada tarjeta permite administrar acceso. El listado evita desplazamiento horizontal innecesario y no cambia de posición al abrir el alta.

**Administrar acceso.** La revisión se habilita sólo ante cambios semánticos reales y completos. Las validaciones explican rol y profesional asociado; el último administrador activo está protegido. Se preservaron autorización, concurrencia, CAS y decisión autoritativa de la RPC.

**Incorporación.** Una tarjeta compacta abre un modal accesible con tres etapas: Email, Datos y acceso, y Revisión previa. Los campos corresponden a identidad nueva, existente o acceso inactivo. Hay validaciones inline, contraseña inicial con confirmación exacta para identidad nueva y revisión sin mutaciones ni contraseña visible. Crear o incorporar comienza únicamente tras la confirmación final. El estado de éxito distingue creación, incorporación y confirmación idempotente y ofrece «Cerrar» y «Agregar otro usuario». El flujo permite volver para editar, confirma descartes sólo cuando corresponde, limpia datos sensibles y conserva la intención y el `operation_id` ante resultados inciertos.

**Accesibilidad.** El modal gestiona foco, teclado, Escape y descarte; limita altura y permite scroll interno en móvil. La evidencia sintética cubre 390, 556 y 1440 px.

## Diagnóstico y seguridad

El [diagnóstico funcional](implementation-report.md) documenta ADMIN en servidor, aislamiento por centro, identidad nueva frente a existente, incorporación, reactivación desde Administrar acceso, último ADMIN, errores de preservación de intención y reutilización de `operation_id`. Estas conclusiones proceden de inspección de código y pruebas locales; no acreditan integración con Supabase hospedado.

TASK-032 preservó los controles de autorización existentes. No incorporó migraciones, nuevas RPC, cambios RLS ni cambios generales de Supabase Auth. La confirmación de contraseña permanece en el formulario y no se envía como dato adicional al servidor. Se conservaron los mecanismos de idempotencia y preservación de intención. Este expediente no incluye contraseñas, secretos ni datos personales reales nuevos.

## Gate final de implementación (histórico)

Estos resultados pertenecen al gate de implementación previo al PR #40; no se repitieron durante este cierre documental.

| Comprobación                        | Resultado histórico |
| ----------------------------------- | ------------------- |
| Vitest completo                     | 884/884 PASS        |
| Tooling                             | 31/31 PASS          |
| Pruebas focales                     | 79/79 PASS          |
| TypeScript                          | PASS                |
| ESLint                              | PASS                |
| Prettier de TASK-032                | PASS                |
| `git diff --check`                  | PASS                |
| Chromium sintético, 390/556/1440 px | PASS                |
| Revisión independiente completa     | APPROVED            |
| CI posterior al merge               | SUCCESS             |

`pnpm check` local quedó bloqueado por la reconciliación de `node_modules` sin TTY; sus verificaciones equivalentes se ejecutaron con los binarios disponibles. El Prettier global señaló archivos históricos ajenos a TASK-032. No hubo E2E contra DEV/PROD. Las capturas sintéticas no acreditan un despliegue remoto.

## Limitaciones y pendientes separados

1. El aviso de indisponibilidad del rol Profesional puede aparecer aunque esté seleccionado Recepción; no altera la validación funcional.
2. No se rediseñó la entrega ni la renovación de contraseñas iniciales.
3. No se implementaron invitaciones por email.
4. El manejo global de Back/Forward conserva sus limitaciones documentadas.
5. Las verificaciones locales no equivalen a pruebas en servicios hospedados.
6. TASK-029 sigue ACTIVE / PRE-PROD BLOCKED y separada de este refinamiento.
7. Migraciones pendientes de otras tareas requieren autorización específica para aplicarse en DEV.

Este PR sólo traslada el expediente sin cambiar sus 71 archivos históricos y añade documentación de cierre. No modifica funcionalidad ni accede a Supabase DEV/PROD ni despliega la aplicación. La [revisión independiente documental](closure-review.md) verifica el cierre propuesto.
