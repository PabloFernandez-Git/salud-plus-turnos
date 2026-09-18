# TASK-002 — React Big Calendar Spike

**Estado:** `READY_FOR_REVIEW`

## Objetivo

Realizar un spike técnico, aislado y descartable de React Big Calendar que permita comprobar con datos ficticios si la librería puede cubrir las vistas Día, Semana y Mes requeridas por Salud Plus sin introducir complejidad o workarounds desproporcionados.

El resultado de la tarea debe ser evidencia reproducible para una decisión posterior e independiente. Esta tarea no adopta React Big Calendar como dependencia definitiva ni construye la agenda productiva.

## Preguntas que debe responder el spike

- ¿La vista Día puede representar profesionales como recursos/columnas y posicionar turnos de distintas duraciones con precisión?
- ¿La vista Semana puede conservar días como columnas y mostrar uno o varios profesionales, incluidos turnos simultáneos, de forma legible?
- ¿La vista Mes permite reemplazar el detalle horario por un resumen diario útil y navegar desde un día hacia una vista detallada?
- ¿La librería se integra razonablemente con Next.js, React, TypeScript y Tailwind CSS en las versiones actuales del repositorio?
- ¿Qué personalizaciones y workarounds son necesarios, y cuál es su costo técnico?
- ¿El resultado sigue siendo utilizable en anchos de pantalla representativos de mobile, tablet y desktop?

## Contexto relevante

- `AGENTS.md`
- `.harness/README.md`
- `.harness/protocols/startup.md`
- `docs/product.md`
- `docs/status.md`
- `docs/modules/agenda.md`
- `docs/decisions/10-agenda-calendario.md`
- `docs/stack/01-next-js.md`
- `docs/stack/02-react.md`
- `docs/stack/05-tailwind-css.md`
- `docs/stack/07-decision-conjunta-de-ui.md`
- `docs/stack/23-spike-de-react-big-calendar.md`
- `docs/decisions/09-testing.md`
- `docs/coding-conventions.md`

## Alcance y supuestos del experimento

- El spike se expone en una ruta aislada, propuesta como `/spikes/react-big-calendar`, sin convertirla en la pantalla productiva principal.
- Se usan exactamente tres profesionales ficticios y un conjunto determinista de turnos ficticios.
- Los datos del spike viven en memoria y no dependen de la fecha actual, red, variables de entorno ni servicios externos.
- El horario visible y cualquier regla usada para la demo son decisiones del experimento, no reglas de negocio aprobadas.
- Seleccionar un espacio libre sólo debe mostrar una respuesta visible con profesional, fecha y hora seleccionados; no crea ni persiste un turno.
- Seleccionar un día en Mes debe abrir una vista más detallada del mismo spike, preferentemente Día.
- La UI puede incluir controles mínimos propios para alternar vistas, navegar y filtrar profesionales.

## Criterios de aceptación

### Aislamiento del spike y datos

- [ ] Existe una ruta aislada y navegable para el spike, sin reemplazar la home productiva ni presentar la experiencia como agenda terminada.
- [ ] El spike usa exclusivamente mock data local con tres profesionales claramente diferenciados.
- [ ] No hay imports, llamadas ni configuración de Supabase, autenticación, base de datos, Server Actions, Route Handlers o lógica productiva.
- [ ] Las fechas de referencia y los datos son deterministas para que la demo y las pruebas sean reproducibles.

### Vista Día

- [ ] Muestra un único día.
- [ ] Presenta a los profesionales como columnas/recursos.
- [ ] Incluye turnos de 20, 30 y 45 minutos.
- [ ] Cada evento comienza y termina en la posición temporal correcta según sus datos ficticios.
- [ ] Permite detectar y clickear un espacio libre.
- [ ] La respuesta al click identifica claramente profesional, fecha y hora del espacio seleccionado, sin persistencia.
- [ ] Cada columna y cada evento permiten identificar claramente al profesional correspondiente.

### Vista Semana

- [ ] Muestra los días como columnas principales.
- [ ] Permite visualizar un profesional o varios mediante un control explícito.
- [ ] Incluye al menos dos profesionales con turnos simultáneos en el mismo día y horario.
- [ ] La simultaneidad es visualmente legible y no oculta la identidad de los profesionales.
- [ ] Permite navegar a la semana anterior y siguiente y volver a la fecha de referencia.
- [ ] Cada evento identifica claramente al profesional, incluso al mostrar varios profesionales.

### Vista Mes

- [ ] Muestra un resumen de actividad por día en lugar de intentar representar cada slot horario.
- [ ] El contenido diario está personalizado y expone información útil de la mock data, como cantidad de turnos y/o profesionales activos.
- [ ] Permite navegar al mes anterior y siguiente y volver a la fecha de referencia.
- [ ] Permite seleccionar un día y pasar a una vista más detallada del mismo spike.

### Criterios técnicos adicionales

- [ ] Se demuestra personalización visual sobre la apariencia base de la librería.
- [ ] Tailwind CSS se usa razonablemente para el layout y los controles propios; cualquier CSS específico requerido por la librería queda acotado e identificado.
- [ ] Al menos un componente propio renderiza el contenido de los eventos.
- [ ] Se verifica el comportamiento en anchos representativos de mobile (375 px), tablet (768 px) y desktop (1280 px).
- [ ] En cada ancho se documenta si la experiencia es usable directamente o si necesita scroll, cambio de vista u otro workaround.
- [ ] El código separa como mínimo mock data, configuración/adaptación del calendario, controles y componentes de presentación; no concentra todo el spike en la página de Next.js.
- [ ] Se registra cada workaround con severidad `baja`, `media` o `alta`, impacto y alternativa posible.
- [ ] Se valida la compatibilidad con las versiones fijadas de Next.js, React, TypeScript y Tailwind CSS mediante instalación reproducible, chequeos de tipos, tests y build.
- [ ] Las dependencias nuevas se limitan a React Big Calendar, sus tipos si fueran necesarios y el localizador mínimo elegido; toda dependencia adicional se justifica en el informe.

### Evidencia y verificabilidad

- [ ] Hay pruebas automatizadas de las interacciones deterministas que no dependan de mediciones frágiles de layout en JSDOM.
- [ ] Las validaciones visuales y de posicionamiento que no resulten confiables en pruebas unitarias se verifican en navegador y quedan documentadas.
- [ ] `.harness/tasks/active/TASK-002/implementation-report.md` incluye una matriz `PASS` / `PARTIAL` / `FAIL` para todos los criterios de este brief.
- [ ] El informe incluye versiones evaluadas, pasos de reproducción, evidencia visual de Día/Semana/Mes y de los tres anchos responsive, y resultados de los comandos de verificación.
- [ ] El informe distingue capacidades nativas, personalizaciones soportadas y workarounds.
- [ ] El informe deja la decisión definitiva explícitamente pendiente y aporta evidencia suficiente para evaluar después: adoptar React Big Calendar, evaluar otra librería, construir una agenda propia o usar una solución híbrida.
- [ ] Un Reviewer independiente verifica el resultado antes de que la tarea pueda cerrarse.

## Impactos

- Security: no — no se procesan datos reales, credenciales ni inputs externos persistentes.
- Authorization: no — el spike no implementa usuarios, roles ni aislamiento por centro.
- Database: no — no se conecta a Supabase ni agrega schema, migrations o seeds.
- Documentation: sí — requiere informe de implementación y, al cierre, actualizar el estado y la documentación de decisión sin adelantar una adopción.
- Testing: sí — requiere pruebas de comportamiento y validación visual reproducible en navegador.
- Dependencies: sí — durante la implementación se incorporará el candidato y su localizador mínimo, con versiones y compatibilidad documentadas.
- Product UI: bajo — se agrega sólo una ruta experimental aislada.

## Riesgos y dudas técnicas a resolver

- La compatibilidad efectiva de React Big Calendar y sus tipos con React 19.3 y TypeScript 6 debe validarse con las versiones realmente resueltas, no suponerse.
- El modelo de recursos de la librería puede resolver bien Día pero producir una grilla distinta de la requerida al combinar días y profesionales en Semana. Debe probarse y documentarse sin reinterpretar el criterio “días como columnas”.
- La convivencia de turnos de 20, 30 y 45 minutos puede exigir una granularidad fina de slots y afectar densidad visual, selección y legibilidad.
- Los eventos simultáneos de profesionales diferentes pueden depender del algoritmo de layout y del modo de agrupación elegido; ocultar solapamientos o perder la identidad profesional es un fallo del criterio.
- La personalización de celdas de Mes podría requerir wrappers o reemplazos parciales; debe medirse cuánto código puente introduce.
- Los estilos base de la librería y su especificidad pueden competir con Tailwind CSS o exigir CSS global. Los overrides deben mantenerse acotados y enumerados.
- React Big Calendar no debe darse por responsive por defecto. Si mobile requiere scroll horizontal, controles alternativos o cambio de vista, debe quedar visible en la demo y registrado como costo.
- El localizador de fechas, el inicio de semana y el locale español pueden sumar una dependencia y producir diferencias de zona horaria. La mock data debe evitar resultados dependientes del equipo.
- Las comprobaciones de geometría real no son fiables sólo con JSDOM; la estrategia de verificación debe combinar tests de comportamiento con navegador real y evidencia visual.

Ninguno de estos riesgos bloquea la delegación: son precisamente hipótesis que el spike debe resolver y reportar.

## Fuera de alcance

- Adoptar definitivamente React Big Calendar.
- Construir la agenda productiva o abstraer prematuramente una API definitiva de calendario.
- Integrar Supabase, autenticación, autorización, RLS, datos reales o persistencia.
- Implementar creación, edición, reprogramación, cancelación o estados reales de turnos.
- Implementar disponibilidad real, reglas de solapamiento o lógica de negocio.
- Drag & drop, resize de eventos, impresión, exportación, sincronización externa o notificaciones.
- Diseñar el sistema visual final del producto.
- Aplicar migrations, seeds o cambios de infraestructura.

## Condición de salida

La tarea sólo puede pasar a verificación y review cuando todos los criterios tengan evidencia. El cierre y cualquier decisión de adopción ocurren en una etapa posterior; el estado inicial de este brief es `READY_FOR_IMPLEMENTATION`.
