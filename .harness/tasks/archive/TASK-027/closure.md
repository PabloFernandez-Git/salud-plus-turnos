# TASK-027 — Cierre documental

**Fecha:** 2026-10-26

**Estado:** `CLOSED / ARCHIVED` propuesto en esta rama documental; pendiente de integración del PR de cierre.

## Resultado

El [PR #32](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/32) fue aprobado y fusionado en `main` mediante `07f273fa82a49c69d53cac8d543a02778aa7dd10`. GitHub confirmó `merged=true` y base `main`; esta rama documental parte de ese `origin/main`.

El detalle de Disponibilidad simplifica el encabezado y ofrece regreso al listado general del mismo centro para ADMIN/RECEPTION. Guardar duración se habilita sólo ante un cambio válido. Agregar, editar y quitar horarios usan modales; la salida con cambios pendientes pide confirmar el descarte y el retiro requiere confirmación específica. Los campos de hora admiten `HH:mm` e insertan `:` automáticamente tras dos dígitos, con validaciones consistentes con el MVP. Las siete tarjetas muestran franjas compactas, separadores, rangos y duraciones locales visibles. Los controles tienen una altura de interacción uniforme de 44 px y la presentación fue comprobada a 390, 556 y 1440 px.

El alcance, los criterios, los riesgos, la implementación y el review de producto originales se conservan sin editar en [brief.md](brief.md), [plan.md](plan.md), [implementation-report.md](implementation-report.md) y [review.md](review.md). La documentación del módulo ya se actualizó en el PR de implementación.

## Evidencia de aceptación

- [CI del PR #32](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40345185100): `success`.
- Pruebas focales de Disponibilidad: 62/62 PASS. Verificación general: 791/791 Vitest y 31/31 tooling PASS; TypeScript y ESLint PASS (una advertencia preexistente de ESLint). Build y CI: PASS.
- Chromium local con datos sintéticos a 390, 556 y 1440 px: formularios, separador de hora, modales, descarte, franjas, navegación, foco, cursores, altura de 44 px y ausencia de desbordamiento. La ruta temporal de prueba se retiró; estas comprobaciones no ejecutaron Actions ni usaron una sesión remota.
- La persona usuaria aprobó visualmente la interfaz en `localhost:3000` el 2026-10-26. Esta aprobación visual se registra separada de las pruebas automatizadas con datos sintéticos.
- [review.md](review.md): revisión técnica focal PASS, sin hallazgos abiertos antes del merge de implementación.

## Decisiones y límites

La implementación no modificó SQL, migrations, RPC, RLS, permisos, contratos del servidor ni reglas de negocio. Este cierre tampoco modifica código funcional, Profesionales, Especialidades ni Disponibilidad. No se realizaron pruebas funcionales remotas, acceso a Supabase DEV/PROD, migrations ni despliegues durante el cierre.

Los cuatro archivos originales pasan íntegros de `tasks/active/` a `tasks/archive/`; [closure-review.md](closure-review.md) verifica sus blobs Git y el alcance del diff. No se requieren cambios adicionales en arquitectura, decisiones técnicas o documentación del módulo. El PR documental queda pendiente de aprobación humana antes del merge.
