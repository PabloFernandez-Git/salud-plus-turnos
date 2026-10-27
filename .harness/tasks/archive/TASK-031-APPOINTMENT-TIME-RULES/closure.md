# TASK-031 — Cierre documental de restricciones temporales de turnos

**Estado:** cierre `CLOSED / ARCHIVED` propuesto en este PR documental. Será efectivo sólo si la persona usuaria aprueba y se fusiona el PR. La implementación ya está integrada en `main`; la activación en bases hospedadas sigue pendiente.

## Integración y alcance

- Implementación: [PR #38](https://github.com/PabloFernandez-Git/salud-plus-turnos/pull/38), fusionado en el commit `e0f7c6bf54905abcdc2212f52c07b76740f0ba70`. Se confirmó su pertenencia a `origin/main`.
- El job `verify` posterior al merge terminó en [SUCCESS](https://github.com/PabloFernandez-Git/salud-plus-turnos/actions/runs/40540164882/job/122316085934).
- La [revisión independiente de implementación](review.md) fue **APPROVED**, sin hallazgos bloqueantes. La persona usuaria aprobó visualmente modales, controles temporales y mensajes con iconos de reloj.
- Este PR sólo traslada y documenta el expediente. No cambia código, SQL, tests funcionales, dependencias ni infraestructura. TASK-029 permanece separada y `ACTIVE / PRE-PROD BLOCKED`.

## Reglas integradas

| Acción | Condición evaluada en PostgreSQL |
|---|---|
| Confirmar | `ahora < starts_at` |
| Marcar atendido | `ahora >= starts_at` |
| Marcar ausente | `ahora >= ends_at` |

PostgreSQL es la autoridad final. La RPC lee `clock_timestamp()` una vez después del bloqueo de fila `FOR UPDATE`, y conserva autorización, aislamiento por centro, roles, estados y CAS. Atendido y Ausente admiten registro retrospectivo sin plazo máximo. No hay transiciones automáticas. Cancelar y Reprogramar conservan sus reglas funcionales.

## Experiencia implementada

Las acciones prematuras muestran botones temporalmente deshabilitados y explicaciones accesibles. La presentación actualiza el estado temporal mientras se consulta el detalle y al recuperar foco; la RPC revalida al ejecutar. Confirmar, Atendido, Ausente y Cancelar tienen modales con paciente, fecha y horario, botones centrados y una acción destructiva diferenciada para Cancelar. Los iconos de reloj son decorativos. La persona usuaria aprobó el comportamiento responsive a 390 y 1440 px.

## Migración y activación

La migración `20261027120000_add_appointment_status_time_rules.sql` está integrada en el repositorio, pero **NO fue aplicada ni verificada en Supabase DEV o PROD**. La integración en GitHub no equivale a un despliegue ni activa la regla en una base hospedada. Este cierre documental no autoriza aplicar la migración.

## Verificaciones históricas de la implementación

Estos resultados corresponden al gate de implementación de PR #38 y a su CI posterior. **No se ejecutaron nuevamente para este cierre documental.** El detalle está en el [informe original](implementation-report.md), el [review](review.md) y las [capturas y resultados](evidence/results.json).

| Comprobación | Resultado histórico |
|---|---|
| Replay local de 26 migraciones | PASS |
| Suite SQL de Turnos | PASS |
| Concurrencia al cruzar límite temporal bajo bloqueo | PASS |
| Vitest | 866/866 PASS |
| Tooling | 31/31 PASS |
| TypeScript | PASS |
| ESLint | 0 errores; 1 advertencia preexistente |
| Prettier focal | PASS |
| Revisión independiente del diff de implementación | APPROVED |
| Evidencia visual Chromium sintética | PASS |
| CI GitHub posterior al merge | SUCCESS |

`pnpm check` local no pudo iniciarse por la reconciliación de `node_modules` sin TTY; sus comprobaciones equivalentes se ejecutaron por separado. La igualdad exacta de los límites se comprobó con expresiones SQL deterministas, sin ejecutar una RPC en un microsegundo coordinado. Las capturas sintéticas no acreditan despliegue en DEV o PROD.

## Integridad del archivo

Se trasladaron los **21 archivos versionados** del expediente activo sin reescribirlos: brief, plan, informe, review, dos scripts históricos, resultados JSON y 14 capturas responsive. Cada blob se comparó con el árbol del commit de integración antes y después del traslado. Ver [manifiesto de hashes Git](integrity-manifest.md). Los scripts quedan como evidencia histórica y no se ejecutaron desde el archivo.

## Pendientes fuera de este PR

1. Aplicar controladamente la migración en DEV mediante autorización separada.
2. Verificar en DEV reglas y permisos tras esa aplicación.
3. Evaluar compatibilidad y planificar migraciones pendientes, teniendo en cuenta TASK-029.
4. Planificar un despliegue futuro sujeto a autorización.
5. Considerar una revisión futura de las reglas temporales de Cancelar y Reprogramar.

Ninguna de estas acciones se realizó durante el cierre documental.
