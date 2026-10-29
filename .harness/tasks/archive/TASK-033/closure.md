# TASK-033 — Cierre documental de Centros y Administración de Plataforma

**Estado propuesto: CLOSED / ARCHIVED.** La implementación ya está integrada en `main`. El cierre formal será efectivo únicamente cuando la persona usuaria autorice y fusione el PR documental de archivo; hasta entonces, TASK-033 sigue ACTIVE.

## Integración y alcance

- Implementación: [PR #42](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/42), commit `985dcd82bed88c4b4c308080d66503fa63c57e79` y squash merge `784d8cc8ddbda3f5cd81b41e2172a8de48bdb0cf` en `main` el **2026-10-29, 13:21:22 UTC−03:00**. GitHub confirma `MERGED` y Git confirma que el árbol de `origin/main` contiene la implementación.
- Navegación entre dashboard tenant y `/platform` condicionada al permiso global PLATFORM_ADMIN, destinos según los centros accesibles y estados de carga y error.
- Creación guiada de centros en tres etapas, con validación de email y contraseña, revisión previa, foco accesible, descarte protegido y recuperación idempotente mediante el mismo `operation_id` ante resultados inciertos.
- Listado con tabla de escritorio y tarjetas móviles, confirmación accesible de activación/desactivación, email institucional identificado como «Email del centro» y selector de zona horaria con etiquetas legibles que conserva el valor IANA y DST.
- Sin cambios de SQL, RPC, RLS, Auth, migraciones ni contratos de servidor.

## Aprobaciones y evidencia histórica

- La persona usuaria aprobó visualmente el resultado final. El [gate técnico](gate-report.md) quedó **APPROVED** y la [revisión independiente de implementación](review.md) terminó **PASS**, sin bloqueantes.
- El job [`verify` del PR #42](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40909403858/job/123572937614) terminó en **SUCCESS**.
- En el gate previo al PR, `pnpm check` pasó en la segunda corrida completa: **929/929 Vitest** y **31/31 tooling**; las pruebas focales TASK-033 pasaron **107/107**. La primera corrida tuvo tres fallos intermitentes bajo carga, investigados en el reporte.
- El [brief](brief.md), [plan](plan.md), [informe de implementación](implementation-report.md), [revisión](review.md), [resultados visuales de la sexta iteración](evidence/sixth-iteration/results.json), [resultados de loaders](evidence/fifth-iteration/results.json), scripts y capturas de todas las iteraciones permanecen en este expediente. Las capturas usan datos sintéticos.

## Límites y pendientes conservados

1. La columna «Administrador» fue diferida por decisión de la persona usuaria. Mostrar emails de ADMIN actualmente activos exige una lectura autorizada por lote: la RPC actual no entrega identidades y las políticas RLS actuales no permiten esa lectura global para PLATFORM_ADMIN. No forma parte del cierre.
2. Persiste el riesgo **P2 de disponibilidad**: si falla la consulta adicional a `platform_admins`, puede fallar la carga de una página tenant válida. El riesgo fue aceptado y documentado, sin remediación en el gate final; no implica acceso indebido.
3. El gate no ejecutó E2E autenticados contra Supabase real ni operaciones en DEV/PROD. Las capturas sintéticas no prueban un despliegue.
4. El formato global señaló **264 archivos ajenos** a TASK-033; el formato focal del cambio pasó. No se reformatearon archivos ajenos.

Este cierre documental se prepara el **2026-10-29**. El PR de archivo sólo traslada el expediente y actualiza su estado; no reabre la implementación, modifica TASK-029, despliega ni aplica migraciones. La [revisión documental independiente](closure-review.md) cubre el alcance propuesto.
