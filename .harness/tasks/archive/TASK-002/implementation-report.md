# TASK-002 — Implementation Report

**Rol:** Implementer  
**Estado:** `READY_FOR_REVIEW`  
**Fecha:** 2026-09-18  
**Branch:** `task/002-react-big-calendar-spike`

## Resultado ejecutivo

Se implementó un spike aislado y descartable de React Big Calendar en
`/spikes/react-big-calendar`, exclusivamente con datos ficticios deterministas y sin Supabase,
autenticación, red, persistencia ni lógica productiva del dominio.

El spike produce evidencia reproducible para Día, Semana y Mes. Los checks automatizados y el
build están en verde. La experiencia es usable directamente en desktop; tablet y mobile requieren
scroll horizontal para preservar el ancho mínimo de las columnas. La vista Semana conserva días
como columnas y muestra simultáneos lado a lado, pero exige no usar recursos de la librería en esa
vista y la identidad profesional se trunca parcialmente en el ancho mínimo.

Este informe **no adopta ni rechaza React Big Calendar**. La decisión definitiva sigue pendiente de
review y de una tarea de decisión posterior.

## Implementación

- Ruta experimental: `src/app/spikes/react-big-calendar/`.
- Composición y estado del experimento: `src/modules/agenda/spike/react-big-calendar-spike.tsx`.
- Mock data y transformaciones puras: `mock-calendar-data.ts`.
- Localización y formatos: `calendar-config.ts`.
- Controles propios: `calendar-controls.tsx`.
- Componentes propios de evento, recurso y celda mensual: `calendar-presentation.tsx`.
- CSS base de la librería importado sólo desde el layout de la ruta y overrides acotados en
  `react-big-calendar-spike.css`.
- Tests unitarios/componentes junto al módulo y E2E en
  `tests/e2e/react-big-calendar-spike.spec.ts`.

La fecha de referencia es el miércoles 15 de abril de 2026. Se construye con fecha local explícita
y `getNow` también queda fijado para eliminar dependencia del reloj. El mock contiene exactamente
tres profesionales, turnos de 20, 30 y 45 minutos en el día de referencia y dos turnos simultáneos
el martes 14 de abril a las 10:00.

## Dependencias y compatibilidad evaluada

| Paquete / runtime | Versión | Uso / resultado |
| --- | --- | --- |
| React Big Calendar | 1.20.0 | Candidato evaluado. Peer range declarado incluye React 19. |
| date-fns | 4.4.0 | Único localizador directo, con locale español. |
| @types/react-big-calendar | 1.16.3 | Necesario porque 1.20.0 no publica tipos propios. Compila con TS 6. |
| Next.js | 16.3.5 | Ruta App Router prerenderizada correctamente. |
| React / React DOM | 19.3.0 | Render, hidratación e interacciones E2E correctas. |
| TypeScript | 6.0.3 | `tsc --noEmit` y build en verde. |
| Tailwind CSS | 4.3.3 | Layout, controles, estados y shell propios. |
| Playwright / Chromium | 1.63.0 / Chromium 153 | Interacciones, geometría y responsive reales. |

Cambios directos de dependencias: sólo `react-big-calendar`, `date-fns` y
`@types/react-big-calendar`, con versiones exactas en `package.json` y lockfile actualizado.
React Big Calendar instala 23 paquetes transitivos y distribuye adaptadores para varias librerías de
fechas aunque el spike use únicamente `date-fns`; este peso debe ser evaluado por el Reviewer.

Cambios de configuración relacionados con la verificación:

- Vitest limita el descubrimiento a `src/**/*.test.{ts,tsx}` para no ejecutar specs de Playwright
  como JSDOM.
- Playwright usa `http://localhost:3000`, el origen anunciado por Next; `127.0.0.1` hacía que Next 16
  bloqueara recursos de desarrollo y dejara HTML sin hidratar.
- `agentRules: false` evita que `next dev` modifique automáticamente el `AGENTS.md` del repositorio.

No se agregaron otras dependencias ni se modificó la home.

## Matriz de criterios de aceptación

### Aislamiento y datos

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| A1 | Ruta aislada y navegable sin reemplazar home | PASS | Build lista `/` y `/spikes/react-big-calendar` como rutas estáticas independientes. |
| A2 | Mock local con tres profesionales diferenciados | PASS | `PROFESSIONALS`; test de cardinalidad; headers, filtros y colores por profesional. |
| A3 | Sin Supabase, auth, DB, Actions, Route Handlers o lógica productiva | PASS | Escaneo de `src/app/spikes` y `src/modules/agenda/spike`; no hay imports ni llamadas. La única mención a Supabase es copy informativo. |
| A4 | Fechas y datos deterministas | PASS | `REFERENCE_DATE`, fechas explícitas, `getNow` fijo y tests reproducibles. |

### Día

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| D1 | Un único día | PASS | Vista controlada `day`; evidencia desktop/mobile. |
| D2 | Profesionales como recursos/columnas | PASS | API nativa `resources` sólo en Día; tres `resourceHeader` personalizados; E2E cuenta tres recursos. |
| D3 | Turnos de 20, 30 y 45 minutos | PASS | Mock y test unitario exacto; tres eventos visibles el 15/04. |
| D4 | Posición temporal correcta | PASS | E2E real verifica orden vertical y alturas crecientes 20 < 30 < 45; grilla de 5 minutos. |
| D5 | Detectar y clickear espacio libre | PASS | `selectable="ignoreEvents"`; E2E hace click en espacio libre de una columna. |
| D6 | Respuesta identifica profesional, fecha y hora sin persistencia | PASS | Mensaje `aria-live` verificado por E2E e incluye “No se guardó ningún turno”. |
| D7 | Columna y evento identifican profesional | PASS | Header propio con nombre/especialidad y evento propio con nombre/color. |

### Semana

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| S1 | Días como columnas principales | PASS | Vista `week` sin `resources`; E2E verifica siete headers diarios. |
| S2 | Uno o varios profesionales filtrables | PASS | Tres filtros explícitos; se impide selección vacía; E2E reduce de tres a uno. |
| S3 | Simultáneos de al menos dos profesionales | PASS | Ana y Bruno, martes 14/04 a las 10:00. |
| S4 | Simultaneidad legible sin ocultar identidad | PASS | E2E verifica mismo eje Y y distinto eje X; nombre/color presentes. En el ancho mínimo hay truncado parcial, documentado como limitación. |
| S5 | Navegación anterior, siguiente y referencia | PASS | Controles propios; E2E verifica cambio de período y retorno. |
| S6 | Cada evento identifica profesional | PASS | `AppointmentEvent` siempre muestra nombre y color; comprobado visualmente. |

### Mes

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| M1 | Resumen diario, no slots horarios | PASS | Se omiten eventos RBC en Mes y cada celda muestra resumen. E2E confirma cero `.rbc-event` en la grilla mensual. |
| M2 | Contenido diario personalizado útil | PASS | `MonthDateHeader`: cantidad de turnos y profesionales activos según filtros. |
| M3 | Navegación anterior, siguiente y referencia | PASS | Controles propios y E2E de cambio/retorno mensual. |
| M4 | Selección de día abre vista detallada | PASS | Drill-down soportado por RBC; E2E 15/04 → Día. |

### Técnicos adicionales

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| T1 | Personalización visual | PASS | Paleta por profesional, headers, estados, grilla y shell personalizados. |
| T2 | Integración Tailwind y CSS acotado | PASS | Tailwind para layout/controles; CSS de RBC y overrides sólo en layout del spike. |
| T3 | Componente propio de evento | PASS | `AppointmentEvent`. También hay componentes propios de recurso y Mes. |
| T4 | Verificación 375 / 768 / 1280 px | PASS | Tres E2E y nueve capturas generadas. |
| T5 | Usabilidad/workaround documentado por ancho | PASS | 375 y 768: usable con scroll horizontal; 1280: usable directamente sin scroll. |
| T6 | Separación de data, adaptación, controles y presentación | PASS | Archivos independientes; página de Next delgada. |
| T7 | Workarounds con severidad, impacto y alternativa | PASS | Tabla específica más abajo. |
| T8 | Compatibilidad stack mediante install, tipos, tests y build | PASS | Instalación reproducible, `typecheck`, 8 tests, 7 E2E y build en verde. |
| T9 | Dependencias nuevas mínimas y justificadas | PASS | Candidato + localizador + tipos; sin auxiliares directos. |

### Evidencia y verificabilidad

| ID | Criterio | Estado | Evidencia |
| --- | --- | --- | --- |
| E1 | Tests deterministas sin geometría frágil en JSDOM | PASS | Vitest cubre datos/controles; geometría queda en Playwright. |
| E2 | Posicionamiento y visuales verificados en navegador | PASS | Chromium real, cajas de eventos y capturas. |
| E3 | Matriz completa PASS / PARTIAL / FAIL | PASS | Esta sección cubre todos los criterios del Brief. |
| E4 | Versiones, reproducción, evidencia responsive y comandos | PASS | Secciones de dependencias, evidencia y verificaciones. |
| E5 | Distingue nativo, personalización y workaround | PASS | Secciones específicas debajo. |
| E6 | Decisión definitiva pendiente y opciones futuras | PASS | No se declara adopción; opciones reiteradas al final. |
| E7 | Reviewer independiente verifica | PARTIAL | Pendiente por diseño de etapa; el estado queda `READY_FOR_REVIEW`. |

## Evidencia visual

Las nueve capturas son artefactos reproducibles del E2E:

| Ancho | Día | Semana | Mes | Evaluación |
| --- | --- | --- | --- | --- |
| 375 px | [captura](evidence/mobile-375-día.png) | [captura](evidence/mobile-375-semana.png) | [captura](evidence/mobile-375-mes.png) | Usable con scroll horizontal. Se ve una columna profesional en Día y unas tres columnas diarias en Mes. |
| 768 px | [captura](evidence/tablet-768-día.png) | [captura](evidence/tablet-768-semana.png) | [captura](evidence/tablet-768-mes.png) | Usable con scroll horizontal; Semana conserva densidad, con texto simultáneo parcialmente truncado. |
| 1280 px | [captura](evidence/desktop-1280-día.png) | [captura](evidence/desktop-1280-semana.png) | [captura](evidence/desktop-1280-mes.png) | Usable directamente, sin scroll horizontal. |

## Capacidades nativas observadas

- Recursos y headers de recurso en Día.
- Posicionamiento temporal y alturas proporcionales.
- Selección de slots y eventos.
- Vistas Día, Semana y Mes con navegación/drill-down.
- Layout de eventos solapados lado a lado.
- Puntos de extensión para evento, recurso y fecha mensual.
- Localizador externo y mensajes/formatos configurables.

## Personalizaciones soportadas usadas

- Toolbar deshabilitada y controles propios con Tailwind.
- `AppointmentEvent` para contenido e identidad profesional.
- `ProfessionalResourceHeader` para nombre/especialidad.
- `MonthDateHeader` para resumen diario y acceso a Día.
- `eventPropGetter` para color consistente por profesional.
- Mensajes, formatos y locale español.

## Workarounds y costo técnico

| Workaround | Severidad | Impacto | Alternativa posible |
| --- | --- | --- | --- |
| Activar `resources` sólo en Día y desactivarlos en Semana | media | RBC anida recursos dentro de cada día en Semana, lo que cambia la jerarquía requerida y multiplica columnas. La adaptación depende de la vista. | Agenda propia/híbrida o renderer semanal específico si se requiere una jerarquía distinta. |
| Ancho mínimo + scroll horizontal en 375 y 768 px | media | RBC no es responsive por sí misma. Evita columnas ilegibles, pero el usuario no ve todo el período simultáneamente. | Vista mobile alternativa, selector de día o calendario propio responsive. |
| Texto de simultáneos parcialmente truncado en Semana | media | Nombre y color siguen presentes, pero la información secundaria puede cortarse en columnas divididas. | Mayor ancho mínimo, tooltip/popover, densidad adaptativa o vista por profesional. |
| Ocultar eventos nativos en Mes e inyectar resumen mediante `dateHeader` | baja | Es personalización soportada, pero requiere alimentar el componente mediante closure y mantener resumen separado. | Componente mensual propio o wrapper dedicado. |
| CSS base global importado en layout de ruta + overrides scoped | baja | La librería necesita su stylesheet y reglas de altura/ancho; hay especificidad externa que mantener. | Encapsular más con CSS Modules o elegir una solución headless. |
| Granularidad de 5 minutos (`step=5`, `timeslots=6`) | baja | Posiciona 20/30/45 min correctamente, pero aumenta densidad de líneas y cantidad de slots DOM. | Ocultar subdivisiones visuales o usar renderer de grilla propio. |
| Tipos comunitarios 1.16.3 para runtime 1.20.0 | baja | Existe desfase de versión; el código actual compila con TS 6, pero una API nueva podría carecer de tipos. | Declaración local mínima o reevaluar al actualizar la librería. |
| `localhost` en Playwright para Next dev | baja | Evita bloqueo de recursos/hidratación por origen distinto; afecta sólo configuración de tests. | Configurar `allowedDevOrigins`, menos acotado. |

## Limitaciones del spike

- No evalúa datos reales, volumen alto, reglas de disponibilidad, estados ni permisos.
- No evalúa drag/drop, resize, persistencia, Server Actions o integración con backend.
- Los viewports mobile/tablet se ejecutan en Chromium desktop redimensionado; no sustituyen pruebas táctiles
  en dispositivos reales.
- No se hizo auditoría completa de accesibilidad ni screen readers, aunque los controles propios tienen
  roles/nombres y la respuesta usa `aria-live`.
- No se evaluaron zonas horarias múltiples o DST; el mock usa fechas locales fijas deliberadamente.
- La semana de siete días es densa. El spike no define si producto mostrará semana laboral o siete días.
- El paquete trae un número apreciable de dependencias transitivas y varios adaptadores de fechas no usados.
- La identidad de simultáneos es visible pero parcialmente truncada en el ancho mínimo; el estándar de
  legibilidad final requiere decisión de UI.

## Verificaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `pnpm bootstrap` | PASS — Node 24.21.0 y pnpm 11.26.0; warning esperado por ausencia de `.env.local`. |
| `pnpm install --frozen-lockfile` | PASS — lockfile reproducible, sin cambios ni descargas pendientes. |
| `pnpm format:check` | PASS — todos los archivos incluidos usan Prettier. |
| `pnpm lint` | PASS. |
| `pnpm typecheck` | PASS — TypeScript 6.0.3. |
| `pnpm test` | PASS — 3 archivos, 8 tests. |
| `pnpm test:e2e` | PASS — 7 tests Chromium, incluidas 9 capturas responsive. |
| `pnpm build` | PASS — compilación, typecheck interno y prerender de `/spikes/react-big-calendar`. |
| `git diff --check` | PASS — sin errores de whitespace. |
| Escaneo de imports/efectos externos | PASS — sin Supabase, auth, red o persistencia en el spike. |

Pasos de reproducción:

1. `pnpm install --frozen-lockfile`
2. `pnpm bootstrap`
3. `pnpm dev`
4. Abrir `http://localhost:3000/spikes/react-big-calendar`
5. `pnpm test`
6. `pnpm test:e2e`
7. `pnpm build`

Si el runtime de Playwright no tiene Chromium 1243, ejecutar una vez
`.\\node_modules\\.bin\\playwright.cmd install chromium` en Windows.

## Dudas para el Reviewer

1. ¿La identificación truncada pero distinguible por nombre/color en simultáneos cumple el umbral de
   legibilidad o debería marcarse `PARTIAL`?
2. ¿El scroll horizontal obligatorio en 375 y 768 px es aceptable como costo del candidato para una
   agenda operativa, o exige una vista mobile alternativa antes de considerar adopción?
3. ¿El desfase entre runtime 1.20.0 y tipos 1.16.3 introduce un riesgo de mantenimiento mayor al
   clasificado como bajo?
4. ¿El footprint transitivo, incluidos adaptadores de fechas no usados, es aceptable para el bundle?
5. ¿La semana final debería conservar siete días o evaluarse una semana laboral? El spike no debe tomar
   esa decisión de producto.
6. ¿Corresponde aceptar `agentRules: false` para evitar que `next dev` ensucie `AGENTS.md`, o prefiere el
   equipo administrar el bloque generado por Next de otra manera?

## Decisión pendiente

El Reviewer debe verificar esta evidencia de forma independiente. Después, en una decisión separada,
se podrá elegir entre adoptar React Big Calendar, evaluar otra librería, construir una agenda propia o
usar una solución híbrida. TASK-002 no resuelve esa elección.
