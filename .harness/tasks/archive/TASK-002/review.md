# Review — TASK-002 React Big Calendar Spike

**Rol:** Reviewer / Verifier independiente  
**Fecha:** 2026-09-18  
**Branch verificada:** `task/002-react-big-calendar-spike`  
**Base:** `main` / `d563cc7`  
**Resultado general del Review:** `PASS`

## Conclusión

El review independiente es `PASS`: el spike está aislado, es reproducible, cubre todos los criterios
del Task Brief y aporta evidencia suficiente para una etapa posterior de análisis y cierre.

Este resultado no significa que React Big Calendar haya aprobado todos los criterios funcionales ni
que deba adoptarse. El candidato obtiene resultados `PARTIAL` en legibilidad de simultáneos y en la
experiencia responsive de mobile/tablet. Esas limitaciones están demostradas y son precisamente parte
del resultado útil del spike.

No se decide en este review adoptar, rechazar ni reemplazar React Big Calendar. La decisión definitiva
permanece pendiente.

## Resultado resumido del candidato

| Área evaluada | Estado | Conclusión |
| --- | --- | --- |
| Aislamiento y determinismo | PASS | Ruta experimental, tres profesionales y mocks locales fijos; sin backend ni persistencia. |
| Vista Día | PASS | Recursos por profesional, duraciones y geometría correctas, selección libre verificable. |
| Vista Semana | PARTIAL | Días como columnas y simultáneos reales, pero un nombre queda truncado en el solapamiento. |
| Vista Mes | PASS | Resumen diario propio, navegación y drill-down a Día. |
| Responsive | PARTIAL | 1280 px es directo; 375 y 768 px requieren scroll horizontal y no muestran todo el período. |
| Compatibilidad técnica | PASS | React 19.3, TypeScript 6, Next 16.3 y Tailwind 4 verificados con checks y build. |
| Evidencia para decidir | PASS | Código, pruebas, capturas y limitaciones permiten una decisión informada posterior. |

## Matriz completa de criterios

### Aislamiento del spike y datos

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| A1 | Ruta aislada y navegable, sin reemplazar la home | PASS | `src/app/spikes/react-big-calendar/`; el build lista `/` y `/spikes/react-big-calendar` por separado y no hay cambios en la página home. |
| A2 | Mock local con exactamente tres profesionales diferenciados | PASS | `PROFESSIONALS` contiene Ana, Bruno y Clara; Vitest verifica cardinalidad e IDs; UI usa nombre, especialidad y color. |
| A3 | Sin Supabase, auth, DB, Actions, Route Handlers o lógica productiva | PASS | Revisión de imports y búsqueda en `src/app/spikes`, `src/modules/agenda/spike` y E2E: no hay acceso a infraestructura. La mención a Supabase es sólo copy informativo. |
| A4 | Fechas y datos deterministas | PASS | Referencia fija 15/04/2026, `getNow` fijo, fechas locales explícitas y datos en memoria. Instalación, tests y capturas se reprodujeron. |

### Vista Día

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| D1 | Muestra un único día | PASS | Vista controlada `day`; evidencia visual y DOM muestran sólo el 15/04/2026. |
| D2 | Profesionales como columnas/recursos | PASS | `resources` se activa en Día; tres headers propios y tres columnas verificadas en Chromium. |
| D3 | Turnos de 20, 30 y 45 minutos | PASS | Mock y test unitario contienen las tres duraciones exactas en el día de referencia. |
| D4 | Posicionamiento temporal correcto | PASS | Verificación ad hoc en Chromium: 09:00/20 min = `top 10%`, `height 3.33333%`; 09:30/30 min = `15%`, `5%`; 10:15/45 min = `22.5%`, `7.5%` dentro de 08:00–18:00. El E2E permanente además compara orden y alturas. |
| D5 | Detectar y clickear un espacio libre | PASS | `selectable="ignoreEvents"`; interacción real sobre una columna genera respuesta visible. |
| D6 | Respuesta con profesional, fecha y hora, sin persistencia | PASS | Chromium devolvió `Dra. Ana Torres, 15/04/2026 a las 13:30. No se guardó ningún turno.` No existe mutación ni fuente persistente. |
| D7 | Columna y evento identifican al profesional | PASS | Header muestra nombre/especialidad; evento propio muestra nombre, título, hora y color consistente. |

### Vista Semana

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| S1 | Días como columnas principales | PASS | Semana se renderiza sin recursos y contiene siete headers de día. |
| S2 | Uno o varios profesionales mediante control explícito | PASS | Tres checkboxes visibles, filtrado probado en E2E y protección contra selección vacía. |
| S3 | Dos profesionales con turnos simultáneos | PASS | Ana y Bruno coinciden el 14/04/2026 a las 10:00; Chromium confirma mismo eje Y y distinto eje X. |
| S4 | Simultaneidad legible sin ocultar identidad | PARTIAL | Los eventos quedan lado a lado y conservan color/nombre, pero `Dr. Bruno Silva` desborda el ancho disponible: 50/83 px a 375 y 768, 65/83 px a 1280. La captura muestra truncamiento. |
| S5 | Navegación semanal anterior/siguiente/referencia | PASS | Controles propios y E2E verifican cambio de período y retorno determinista. |
| S6 | Cada evento identifica claramente al profesional | PARTIAL | La identidad se conserva por color y texto parcial, pero el nombre completo de Bruno no es visible en el simultáneo incluso a 1280 px. Es evidencia útil, no una resolución completa del requisito de claridad. |

### Vista Mes

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| M1 | Resumen diario en lugar de slots/eventos horarios | PASS | Mes recibe `events=[]`; no hay `.rbc-event` y cada celda usa `MonthDateHeader`. |
| M2 | Contenido diario personalizado y útil | PASS | Muestra cantidad de turnos y nombres de profesionales activos según filtro. |
| M3 | Navegación mensual anterior/siguiente/referencia | PASS | Controles reproducidos en E2E y retorno a abril de 2026 verificado. |
| M4 | Selección de día hacia vista detallada | PASS | Click en 15/04 cambia a Día en la misma ruta experimental. |

### Criterios técnicos adicionales

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| T1 | Personalización visual sobre la base | PASS | Paleta por profesional, shell, headers de recursos, eventos, resumen mensual y estados propios. |
| T2 | Tailwind razonable y CSS específico acotado | PASS | Tailwind compone layout/controles; CSS de RBC se importa desde el layout del spike y los overrides propios están bajo `.rbc-spike`. |
| T3 | Componente propio para eventos | PASS | `AppointmentEvent`; también existen `ProfessionalResourceHeader` y `MonthDateHeader`. |
| T4 | Verificación a 375, 768 y 1280 px | PASS | Playwright volvió a generar nueve capturas y verificó overflow por viewport. |
| T5 | Usabilidad/workaround documentado por ancho | PASS | 375 y 768 requieren scroll horizontal; 1280 no. La capacidad responsive del candidato se clasifica aparte como `PARTIAL`. |
| T6 | Separación de data, adaptación, controles y presentación | PASS | Página de Next delgada y archivos separados para mocks, config, controles, presentación, composición y CSS. |
| T7 | Workarounds con severidad, impacto y alternativa | PASS | El informe contiene tabla completa; este review ajusta la interpretación de legibilidad a `PARTIAL` y agrega matices de severidad abajo. |
| T8 | Compatibilidad con stack mediante install, tipos, tests y build | PASS | Instalación congelada, peer check, lint, TS 6, Vitest, Playwright y build pasaron. |
| T9 | Dependencias nuevas mínimas y justificadas | PASS | Directas nuevas: `react-big-calendar@1.20.0`, `date-fns@4.4.0` y `@types/react-big-calendar@1.16.3`. No se agregó otro auxiliar directo. |

### Evidencia y verificabilidad

| ID | Criterio | Estado | Evidencia independiente |
| --- | --- | --- | --- |
| E1 | Tests deterministas sin geometría frágil en JSDOM | PASS | Vitest cubre mocks y controles; la geometría queda en Playwright/Chromium. |
| E2 | Visuales y posicionamiento verificados en navegador | PASS | E2E permanente, nueve capturas y medición adicional exacta de `top`/`height`. |
| E3 | Informe con matriz completa PASS/PARTIAL/FAIL | PASS | Todos los criterios están enumerados. El Reviewer corrige S4/S6 a `PARTIAL`; la evidencia original ya reconocía el truncamiento. |
| E4 | Versiones, reproducción, responsive y comandos documentados | PASS | El informe incluye versiones, pasos, capturas y resultados; fueron reproducidos. |
| E5 | Distingue capacidades nativas, personalización y workarounds | PASS | Secciones separadas y coherentes con el código inspeccionado. |
| E6 | Decisión definitiva pendiente y opciones futuras | PASS | No declara adopción; mantiene abiertas las cuatro estrategias. |
| E7 | Reviewer independiente verifica | PASS | Satisfecho por este review y sus verificaciones reproducidas. |

## Dependencias y compatibilidad verificadas

| Componente | Versión verificada | Resultado |
| --- | --- | --- |
| React Big Calendar | 1.20.0 | Runtime funcional; peer range declara React `^19`. |
| Tipos comunitarios | 1.16.3 | Compilan con el uso actual, pero no corresponden a la versión runtime. |
| date-fns | 4.4.0 | Localizador español funcional. |
| React / React DOM | 19.3.0 | Sin peer issues; render e interacciones pasan. |
| Next.js | 16.3.5 | Build de producción y prerender de la ruta pasan. |
| TypeScript | 6.0.3 | `tsc --noEmit` pasa. |
| Tailwind CSS | 4.3.3 | Clases aplicadas correctamente en layout/controles. |
| Playwright | 1.63.0 | 7 E2E en Chromium pasan. |

`pnpm peers check` informó `No peer dependency issues found`. El paquete runtime no publica campo
`types`/`typings`, por lo que depende de tipos comunitarios. El lockfile confirma las tres dependencias
directas nuevas y muestra que React Big Calendar incorpora, entre otros, adaptadores transitivos para
Day.js, Globalize, Luxon y Moment aunque el spike sólo use date-fns.

## Responsive y evidencia visual

| Ancho | Estado del candidato | Evidencia |
| --- | --- | --- |
| 375 px | PARTIAL | Contenedor 315 px / canvas 960 px en Semana. Requiere scroll; se ven aproximadamente dos días a la vez. |
| 768 px | PARTIAL | Contenedor 668 px / canvas 960 px en Semana. Requiere scroll; no entra la semana completa. |
| 1280 px | PASS | Contenedor y canvas 1164 px; no hay overflow horizontal. |

Las nueve capturas bajo `evidence/` fueron regeneradas por Playwright durante el review. La navegación,
los filtros, los resúmenes y los eventos siguen siendo operables con scroll; no se verificó experiencia
táctil en dispositivo real.

## Workarounds y limitaciones

| Workaround o limitación | Severidad | Veredicto del Reviewer | Alternativa posterior |
| --- | --- | --- | --- |
| Recursos activos sólo en Día, desactivados en Semana | media | Correctamente informado. Es adaptación condicional de configuración y evidencia que una única estructura de RBC no satisface ambas jerarquías. | Renderer semanal específico, solución híbrida o agenda propia. |
| Ancho mínimo y scroll horizontal a 375/768 | media | Correctamente informado. Mantiene legibilidad local, pero oculta gran parte del período y obliga navegación bidimensional. | Vista mobile por día, semana laboral reducida, selector de fecha o layout propio. |
| Truncamiento de simultáneos | media | La clasificación media es correcta; el informe fue optimista al marcar S4/S6 como PASS. Bruno se trunca incluso a 1280. | Tooltip/popover accesible, contenido adaptativo, mayor ancho o vista por profesional. |
| Resumen Mes mediante `dateHeader` y sin eventos RBC | baja | Punto de extensión soportado y código acotado. | Mes propio si la complejidad futura crece. |
| Stylesheet base global en layout + overrides scoped | baja | Aceptable para el spike; la hoja base sigue siendo global aunque los overrides propios estén scoped. | CSS Module/wrapper o solución headless. |
| Granularidad de cinco minutos | baja | Resuelve 20/30/45 min; aumenta líneas/DOM pero no produjo fallo observable. | Reducir subdivisiones visuales o grilla propia. |
| Runtime 1.20.0 con tipos 1.16.3 | baja en el spike / media ante adopción | El uso actual compila y corre, pero existe riesgo de APIs faltantes o contratos desactualizados en mantenimiento futuro. | Declaraciones locales mínimas, contribuir/esperar tipos o reevaluar candidato. |
| `localhost` en Playwright | baja | Ajuste acotado a la reproducción E2E; no afecta producto. | Configurar orígenes de desarrollo si fuera necesario. |
| `agentRules: false` en Next | baja | Evita mutación automática de `AGENTS.md`; está documentado y no cambia el alcance funcional. | Administrar explícitamente las reglas generadas por Next. |
| Dependencias transitivas de localizadores no usados | media como costo de adopción | No rompe el spike, pero aumenta superficie y peso potencial; debe medirse si el candidato avanza. | Analizar bundle real, tree-shaking o comparar alternativas más acotadas. |

## Verificaciones reproducidas

| Comando / inspección | Resultado |
| --- | --- |
| `git branch --show-current` | PASS — `task/002-react-big-calendar-spike`. |
| `pnpm bootstrap` | PASS — Node 24.21.0, pnpm 11.26.0; warning esperado por falta de `.env.local`. |
| `pnpm install --frozen-lockfile` | PASS — lockfile actualizado y reproducible. |
| `pnpm peers check` | PASS — sin peer dependency issues. |
| `pnpm format:check` | PASS. |
| `pnpm lint` | PASS. |
| `pnpm typecheck` | PASS — TypeScript 6.0.3. |
| `pnpm test` | PASS — 3 archivos, 8 tests. |
| `pnpm test:e2e` | PASS — 7 tests Chromium, incluidas nueve capturas. |
| Verificación ad hoc de geometría/selección/overflow en Playwright | PASS — porcentajes exactos y respuesta completa confirmados; el archivo temporal se eliminó. |
| `pnpm build` | PASS — `/` y `/spikes/react-big-calendar` prerenderizadas de forma separada. |
| `git diff --check` | PASS — sin errores de whitespace. |
| Escaneo de imports, red, persistencia y secretos en el alcance | PASS — sin hallazgos. |

Un intento auxiliar de `pnpm list ... --depth 0` falló con `ERR_SQLITE_ERROR unable to open database
file` en el índice local de pnpm de este entorno. No afecta la instalación ni la verificación: las
versiones se contrastaron en `package.json`, `pnpm-lock.yaml` y los `package.json` instalados; el peer
check, los tests y el build pasaron.

## Scope, seguridad y documentación

- La branch parte del mismo commit que `main`; el spike completo permanece sin commit, conforme a la
  instrucción de no commitear ni cerrar.
- No se reemplazó la home ni se agregó navegación productiva hacia el experimento.
- No hay secretos, datos reales, variables de entorno nuevas, Supabase, auth, persistencia, APIs,
  Server Actions ni Route Handlers en el spike.
- No hay migrations, seeds, cambios de esquema ni impacto RLS.
- Los cambios de `playwright.config.ts`, `vitest.config.ts` y `next.config.ts` están relacionados con
  la reproducción del spike y están explicados en el informe.
- `docs/decisions/10-agenda-calendario.md` no declara adopción definitiva y no fue modificado.
- `docs/status.md` conserva el estado de inicio de la tarea. Su actualización corresponde a la etapa
  posterior de análisis/cierre del Orchestrator, no a este review.

## CHANGES_REQUESTED

Ninguno.

La evidencia es suficiente aunque el candidato tenga resultados `PARTIAL`. TASK-002 queda lista para
la siguiente etapa de análisis y cierre, sin decisión de adopción.
