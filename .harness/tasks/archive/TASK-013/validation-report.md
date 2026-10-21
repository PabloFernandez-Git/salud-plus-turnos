# TASK-013 — Informe consolidado de validación integral

Fecha: 2026-10-21. Proyecto: Supabase DEV `ehllxymqyzrofydrvtzo`. RunId exitoso: `27fcd681-4cb4-4450-8644-378bf343bcbb`.

## Resultado

**13/13 escenarios Playwright PASS**, sin retries ni skips (`test-results/.last-run.json: passed`). Build de producción PASS. Un Center aislado `America/New_York`, dos profesionales, dos especialidades, cinco disponibilidades, paciente ficticio y seis turnos iniciales alimentaron las vistas. Se creó un séptimo turno desde un slot devuelto por PostgreSQL; al perderse la respuesta CREATE, la UI reconcilió el resultado sin segundo CREATE (`browserAppointmentId` registrado en el ledger).

| # | Escenario | Resultado | Captura |
| --- | --- | --- | --- |
| 1 | Desktop 1440×900: Día con dos turnos simultáneos | PASS | [desktop-day.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-day.png) |
| 2 | Desktop: Semana con simultaneidad y turno del jueves | PASS | [desktop-week.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-week.png) |
| 3 | Desktop: Mes con resumen del día poblado | PASS | [desktop-month.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-month.png) |
| 4 | Desktop: 01:30 repetida por DST, GMT-4 y GMT-5 | PASS | [desktop-dst.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-dst.png) |
| 5 | Desktop: filtros por ID de especialidad, profesional y CANCELLED | PASS | Ver aserciones del spec |
| 6 | Desktop: slot PostgreSQL 12:00 y Crear turno preseleccionado | PASS | [slot](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-slot.png), [alta](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-prefill.png) |
| 7 | Mobile 390×844: Día con turnos | PASS | [mobile-day.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-day.png) |
| 8 | Mobile: Semana con simultaneidad | PASS | [mobile-week.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-week.png) |
| 9 | Mobile: Mes poblado | PASS | [mobile-month.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-month.png) |
| 10 | Mobile: 01:30 repetida por DST, GMT-4 y GMT-5 | PASS | [mobile-dst.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-dst.png) |
| 11 | Mobile: filtros por ID de especialidad, profesional y CANCELLED | PASS | Ver aserciones del spec |
| 12 | Mobile: slot PostgreSQL 12:30 y Crear turno preseleccionado | PASS | [slot](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-slot.png), [alta](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/mobile-prefill.png) |
| 13 | Desktop: CREATE con respuesta perdida y reconciliación sin duplicado | PASS | [desktop-after-create.png](evidence/27fcd681-4cb4-4450-8644-378bf343bcbb/desktop-after-create.png) |

Los contextos del navegador usaron UTC en desktop y Pacific/Honolulu en mobile para contrastar la hora del Center. Las capturas de filtros no se hicieron por separado; sus aserciones se ejecutaron en ambos tamaños. Las 13 imágenes existen y sus SHA-256 coinciden con el ledger. No se configuró `trace.zip` en esta corrida PASS; se conserva el resultado Playwright y las capturas.

## Primera corrección visual local (sustituida por el ajuste final de abajo)

Las capturas pobladas mostraron dos defectos de presentación: el contenido de turnos de 30 minutos se partía o recortaba verticalmente en Día/Semana, y un nombre sintético largo en el selector de especialidad ensanchaba el documento mobile. Se ajustó sólo la presentación: eventos de una línea con el detalle completo disponible en texto/tooltip, anchos acotados de filtros y una indicación de scroll horizontal. La validación local posterior comprobó 390/390 px de ancho, selector dentro del contenedor y contenido de evento de 16 px dentro de su altura de 20 px; a 1440 px no hubo desborde. Vitest focal 7/7, ESLint, Prettier, TypeScript y build final PASS. El cambio no altera RPC, datos, autorización ni flujos ejercitados por los 13 escenarios; conforme al review simplificado, no se repitió DEV.

## Cleanup y límites

El ledger local, preservado fuera de Git en `archive/TASK-013/validation-ledger.json`, registra `stage=cleaned`, `authDeleted=true`, `residueZero=true`, `inventoryRestored=true` y el UUID del único turno creado en navegador. El inventario final de 14 recursos y 23 migrations coincide con el baseline; no quedaron filas sintéticas. El run previo `4a8f9648-3820-4dc4-9ceb-ff755d4e32b0` falló antes de Playwright por `public.users.email`, fue limpiado con residuo cero y se conserva localmente en `attempts/` sin reutilizarlo. No hubo acceso PROD, migrations ni cambios RLS/permisos.

## Ajustes finales de experiencia visual — 2026-10-21

**PASS local de presentación y review focal.** No se accedió a DEV ni se repitieron
los 13 escenarios remotos. Su evidencia funcional y de cleanup permanece vigente.

### Cambios y comprobaciones

- **Turnos de 30 minutos:** la reproducción inicial confirmó sólo 20 px de alto.
  Ahora miden 45,98 px en Día/Semana: paciente y horario/profesional/estado en dos
  líneas. La distribución evita superponer tarjetas. En columnas con simultáneos
  sigue existiendo truncamiento horizontal; la lista desplegable muestra todos los
  datos completos y enlaces al detalle, también en touch, sin depender del tooltip.
  Se comprobó la navegación al detalle desde esa lista y desde el evento con Enter.
  Se corrigió el defecto demostrado de teclado: Enter/Espacio no activaban el evento.
- **Mobile:** flechas de 44 px con estados de inicio/fin y desplazamiento por columnas;
  conserva el scroll nativo. Se comprobó cada una de las tres columnas de profesional
  y los siete días completos de Semana/Mes, incluyendo domingo y regreso al comienzo.
- **Altura y horas:** calendario acotado a 60vh (mínimo 420, máximo 620 px),
  con las 24 horas intactas. Abre 30 minutos antes del primer horario representable;
  sin turnos abre a las 08:00. Botón para volver a esa posición. Se alcanzaron las
  00:00 y el turno de las 22:30 y se volvió a las 09:00. No se infiere disponibilidad
  ni horario operativo desde los espacios de la grilla.
- **Especialidad mobile:** nombre largo seleccionado dentro del control; documento
  de 390/390 px en las tres vistas, sin desborde de página. El nombre se recorta en
  el select cerrado conforme a su ancho; conserva la opción completa nativa.

### Evidencia local actualizada

`node scripts/task013-agenda-visual/local-visual.mjs` renderiza el componente de
producción y React Big Calendar reales en Chromium con props sintéticas. Sustituye
sólo navegación Next por destinos locales y excluye disponibilidad/servidor. No
lee credenciales ni archivos de entorno; bloquea requests fuera de loopback. No es
una nueva validación autenticada ni una prueba de contratos PostgreSQL.

**6/6 combinaciones PASS** (1440×900 y 390×844), sin errores de página ni requests
externos. Capturas full-page, excepto el recorte de la lista. Resultados y medidas:
[results.json](evidence/local-visual-final/results.json). Se conservan las seis
capturas anteriores en `evidence/local-visual-before/` para comparación.

| Vista | Desktop | Mobile | Últimas columnas mobile |
| --- | --- | --- | --- |
| Día | [Captura](evidence/local-visual-final/desktop-day.png) | [Captura](evidence/local-visual-final/mobile-day.png) | [Último profesional](evidence/local-visual-final/mobile-day-last-columns.png) |
| Semana | [Captura](evidence/local-visual-final/desktop-week.png) | [Captura](evidence/local-visual-final/mobile-week.png) | [Sábado y domingo](evidence/local-visual-final/mobile-week-last-columns.png) |
| Mes | [Captura](evidence/local-visual-final/desktop-month.png) | [Captura](evidence/local-visual-final/mobile-month.png) | [Hasta domingo](evidence/local-visual-final/mobile-month-last-columns.png) |

Otras capturas inspeccionadas: [lista legible de simultáneos](evidence/local-visual-final/mobile-week-list.png),
[especialidad larga](evidence/local-visual-final/mobile-specialty.png) y
[turno nocturno](evidence/local-visual-final/desktop-day-night.png).

### Verificación y alcance final

- Bootstrap, 7/7 pruebas focales de componentes, TypeScript, build y diff check PASS.
- ESLint del alcance y formato PASS. Lint global sin errores, con un warning
  preexistente por `oid` no utilizado en tooling de TASK-009 (no modificado).
- Review focal: sólo UI, pruebas locales y documentación del alcance. Sin cambios
  de contratos, permisos, disponibilidad, migraciones, dependencias ni Harness.
- `next-env.d.ts` preservado byte por byte: SHA-256
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- TASK-010, TASK-011 y TASK-012 intactas. Sin bloqueos materiales pendientes
  en este ajuste visual.

### Cierre y publicación

El cierre aplica el protocolo `close-task.md`: review PASS, expediente archivado,
estado y módulo actualizados. Los ledgers operativos de ambos runs y las seis
capturas comparativas previas permanecen sólo en el workspace local. El PR incluye
el informe, las 13 capturas sintéticas DEV y las 12 capturas locales finales, sin
credenciales ni datos de pacientes reales. Los scripts de validación de TASK-013
quedan como evidencia histórica, sin autorización para una nueva escritura DEV.
