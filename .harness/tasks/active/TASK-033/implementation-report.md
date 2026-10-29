# TASK-033 — Informe de implementación local

**Estado:** ACTIVE, pendiente de segunda revisión visual humana. **Rama:** codex/task-033-centers-ux.

## Diagnóstico

requirePlatformAdmin lee platform_admins, independiente del rol tenant. requireCenterMembership exige membership y centro activos. getAccessOverview devuelve sólo accesos activos a centros activos y propaga errores. /select-center redirige con un solo centro. Antes, el encabezado tenant no ofrecía /platform, la página de plataforma enlazaba siempre a /select-center si había accesos y «Crear centro» apuntaba a un formulario inline. platform_list_centers entrega sólo datos administrativos y agregados. La resolución del email, la acción de alta, el operation_id, la reconciliación y la activación permanecen en sus servicios existentes.

## Cambios

- Encabezado tenant: enlace «Administrar plataforma» condicionado a consulta real de platform_admins; /platform sigue protegido por requirePlatformAdmin.
- Plataforma: enlace directo a un único centro, selector para varios, ninguno si no hay accesos y aviso separado ante fallo de consulta.
- Alta: diálogo accesible con email, datos y revisión local sin mutación. Confirmación exacta de contraseña sólo para identidad nueva; el campo de confirmación no tiene name, no se envía ni persiste. Contraseñas borradas tras submit o descarte.
- Éxito abierto, con cierre y otra alta. Los resultados confirmed se distinguen de una creación nueva. same-operation conserva intención y datos bloqueados; new-operation conserva un estado terminal visible hasta que se cree una intención nueva.
- Tabla conservada en escritorio; tarjetas móviles con todos los valores, agregados y acción actual de estado. No hubo cambios de RPC, RLS, migraciones, esquema ni reglas de negocio.

## Verificación

- node scripts/bootstrap.mjs: PASS. pnpm bootstrap: bloqueado por reconciliación de node_modules sin TTY; no se reinstaló.
- Vitest focal: 22/22 PASS. Regresiones de acceso, autorización, administración, acciones, intención, schema y alta de usuarios: 94/94 PASS.
- TypeScript, ESLint focal, Prettier focal, git diff --check: PASS.
- Tooling TASK-007: 11/11; TASK-021: 20/20 PASS.
- Chromium con componentes reales montados y datos sintéticos a 390/556/1440 px: PASS, sin overflow de documento; apertura, Escape/descarte, foco, etapas, revisión sin mutación y éxito. No se utilizó Supabase ni se detuvo el servidor Next.js existente.

## Capturas

Archivos bajo evidence/: platform-list-{390,556,1440}.png, modal-step1-_, modal-step2-_, modal-step2-bottom-_, modal-step3-_, modal-success-_, center-header-_, modal-keyboard-390.png y results.json. El script reproducible es visual-check.mjs.

## Límites

Las capturas usan datos sintéticos y acciones simuladas; no acreditan un entorno Supabase desplegado. La confirmación de activar/desactivar conserva el diálogo nativo actual, no reproducido en capturas. Un fallo de la consulta de platform_admins en el layout tenant produce un error de página; no concede acceso ni muestra el enlace.

## Archivos de TASK-033

- Aplicación: src/app/platform/page.tsx, src/app/platform/page.test.tsx, src/app/centers/[centerId]/layout.tsx y layout.test.tsx.
- Módulo: src/modules/access/server/access.ts; componentes center-header.tsx, create-center-panel.tsx y su test, platform-centers-table.tsx y su test, use-platform-operation-intent.ts.
- Documentación: docs/modules/access.md, docs/modules/centers.md, docs/status.md y este expediente activo con capturas y script.
- next-env.d.ts y los untracked ajenos ya estaban presentes antes de la tarea y se conservaron sin intervención.

No se realizó commit, push, PR, merge, despliegue ni operación Supabase DEV/PROD. TASK-029 y su checkpoint se preservaron.

## Ajuste visual posterior: iconos de navegación

Se añadieron SVG locales decorativos a «Administrar plataforma» (edificio) y «Ir a mi centro» (panel), ambos de 17 px, gap de 8 px, trazo currentColor y aria-hidden. El enlace de selección para varios centros no recibió icono. No cambian permisos, destinos, modal ni reglas.

Pruebas de navegación: 11/11 PASS; TypeScript, ESLint focal y Prettier focal: PASS. Chromium verificó los botones reales a 390, 556 y 1440 px, incluido tamaño, separación y atributos accesibles. Capturas de botones: evidence/navigation-to-center-{390,556,1440}.png y evidence/navigation-to-platform-{390,556,1440}.png. TASK-033 sigue ACTIVE a la espera de revisión visual.

## Segunda iteración visual

- Dashboard: «Administrar plataforma» y «Cerrar sesión» tienen el mismo ancho y alto medidos en Chromium. El primero se limita al dashboard y sigue condicionado a PLATFORM_ADMIN global; los módulos interiores sólo muestran «Volver al inicio». Los iconos decorativos permanecen.
- `/platform`: navegación y cierre de sesión se mantienen en el encabezado; «Crear centro» pasa junto a «Centros registrados». La descripción se divide en dos párrafos de ajuste natural. El cierre de sesión usa variante secundaria.
- Modal: el paso 1 explica el email y usa el pie común; el paso 2 y la revisión colocan acciones en un pie fuera del contenido desplazable. La etiqueta visible es «Zona horaria» y el valor IANA no cambia. Ante validación local o del servidor, se enfoca el primer campo inválido y se desplaza sólo la región interna hasta mostrar el mensaje. Revisión y éxito mantienen contenido y acciones sin mutaciones adicionales.
- Investigación de superposición: el pie anterior era `sticky` dentro de `overflow-y-auto`, de modo que compartía el scroll con los campos y podía cubrir visualmente contenido o errores. No era un elemento posicionado por encima de todo el diálogo; el problema era de estructura y desplazamiento. Ahora el encabezado, el scroll y el pie son hermanos flex; Chromium comprueba que sus rectángulos no se superponen a 390, 556 y 1440 px, incluso con 540 px de alto.
- Pruebas finales: 9 suites relacionadas, 89/89 PASS; TypeScript, ESLint y Prettier focales, `git diff --check`: PASS. Chromium sintético 390/556/1440: PASS. Incluye Tab/Shift+Tab, Escape, borrador conservado, foco/error de contraseña fuera de vista, scroll interno, ausencia de scroll horizontal, revisión sin mutación, doble envío bloqueado y éxito. No se reinició Next.js ni se usó DEV/PROD.
- Capturas nuevas: `evidence/second-iteration/` contiene dashboard, módulo interior, encabezado y sección de plataforma, pasos 1/2/3, desplazamiento a contraseñas, error, descarte, éxito y viewport bajo. `results.json` registra los tres anchos. La simulación monta componentes reales con Auth/acciones sintéticas; no acredita integración de backend desplegado.
- Revisión independiente: PASS sin hallazgos bloqueantes. Conserva una observación de resiliencia preexistente: un fallo de la consulta `platform_admins` aborta el layout de centro; no amplía permisos y queda fuera de esta iteración.

TASK-033 sigue ACTIVE a la espera de revisión visual humana. Sin commit, push, PR, merge, despliegue, migración ni operación Supabase. TASK-029 y archivos locales preexistentes se preservaron.

## Tercera iteración visual

- Los dos botones del dashboard se compactaron de 256 a 232 px en escritorio y conservan igualdad de ancho y alto; en móvil siguen adaptándose al contenedor. El acceso global sigue condicionado a PLATFORM_ADMIN y ausente de módulos interiores.
- Los dos párrafos de `/platform` mantienen ajuste natural con 6 px de separación. El paso 1 no muestra divisores entre encabezado, contenido y pie, conserva explicación y email, y centra «Continuar». Los grupos de acciones de los pasos 2/3, descarte y éxito se centran en escritorio y se apilan en móvil.
- «Zona horaria» usa un `input[list]` nativo con sugerencias buscables de `Intl.supportedValuesOf("timeZone")`, etiquetas legibles, el alias predeterminado `America/Argentina/Buenos_Aires` y UTC. El campo sigue admitiendo cualquier IANA válido que acepte la validación existente, incluso alias no enumerados como `US/Eastern`; se conserva exactamente el valor para revisión y envío. No hay conversión a offset ni cambios de servidor.
- Se aplicó cursor de interacción a botones habilitados de plataforma, encabezado y modal; los deshabilitados muestran `not-allowed`. Enlaces de navegación muestran `pointer`. El campo editable conserva cursor de texto y las opciones del datalist son nativas.
- Diagnóstico del aviso pendiente: la intención no secreta se guarda antes de la acción, por lo que el aviso durante «Guardando…» es esperado. La revisión normal no lo muestra. A petición expresa, se eliminó «Abandonar e iniciar nueva alta» de los estados inciertos: sólo se puede reintentar/verificar con el mismo `operation_id`. Cerrar conserva la intención. Un snapshot ilegible bloquea otra alta y explica la verificación manual en el listado y la revisión administrativa; los resultados concluyentes vuelven a permitir una nueva intención. No cambió backend, contrato ni mecanismo de idempotencia.
- Capturas nuevas y reproducibles: `evidence/third-iteration/`, generadas por `visual-check-third.mjs` a 390/556/1440 px. Incluyen dashboard, descripción, pasos 1/2/3, selector enfocado, descarte, éxito, revisión normal y envío retenido intencionalmente. Las acciones y Auth son sintéticas, sin Supabase real ni reinicio del Next.js existente.
- Revisión independiente: PASS sin hallazgos bloqueantes tras el cambio de estado incierto. La observación previa de resiliencia ante error de `platform_admins` continúa fuera de alcance.
- Verificación final: 9 suites relacionadas, 92/92 PASS; TypeScript, ESLint focal, Prettier focal y `git diff --check`: PASS. Chromium con componentes reales y servicios sintéticos: PASS a 390, 556 y 1440 px; sin desbordamiento horizontal ni superposición del modal. `pnpm bootstrap` conserva la limitación de TTY ya documentada; no se reinstalaron dependencias.

TASK-033 permanece ACTIVE para revisión visual humana; sin commit, push, PR, merge, despliegue ni operación Supabase. TASK-029, `.env.local`, `next-env.d.ts` y archivos ajenos permanecen intactos.

## Cuarta iteración visual

- `/platform` usa una franja superior horizontal a todo el ancho, con la misma estructura responsive del encabezado de centro. Conserva identidad, descripción, cuenta, destino del centro y cierre de sesión. El listado y el alta siguen en `main`.
- «Desactivar» abre un diálogo propio con nombre del centro, consecuencia conocida, «Volver» y confirmación roja. Como «Reactivar» compartía `window.confirm()`, usa el mismo patrón con textos y color apropiados. La mutación de servidor sigue siendo `setPlatformCenterActiveAction`; no cambian sus reglas. Cierre y Escape no mutan; un latch y el estado pendiente impiden doble envío y cierre accidental. El error queda en el diálogo y el éxito se anuncia junto a la acción.
- Chromium demostró que el `datalist` nativo no seleccionaba una zona al buscar «Buenos» con flecha y Enter: el valor quedaba en «Buenos». Se sustituyó sólo el control por una lista local buscable que conserva entrada libre y validación IANA existentes. La lista se renderiza dentro del diálogo, fuera del scroll interno, se alinea y cambia de lado según el espacio. Mouse, flechas, Enter, Escape y selección fueron comprobados. El valor predeterminado, alias y contrato enviado permanecen intactos.
- El aviso de incertidumbre ya no aparece durante la solicitud en curso por el solo hecho de persistir la intención; se ve «Creando centro…». Una respuesta `same-operation` o la reapertura de una intención guardada sigue mostrando el aviso, bloquea nuevas altas y conserva el `operation_id`. Éxito y fallo concluyente conservan el flujo aprobado. Sin cambios de backend, SQL, Auth ni idempotencia.
- Verificación: 21/21 pruebas focales; 233/233 en 26 suites relacionadas; TypeScript, ESLint y Prettier focales PASS. `visual-check-fourth.mjs` PASS a 390/556/1440 px con componentes reales y acciones sintéticas, incluyendo encabezado, diálogo de estado, foco/Tab/Escape, cancelación sin mutación, confirmación única, selector con lista y viewport de 540 px, progreso, incertidumbre y éxito. Capturas en `evidence/fourth-iteration/` y resultado en `results.json`.
- Limitación: el viewport de 540 px simula la reducción de área útil por teclado móvil; Chromium automatizado no muestra un teclado virtual real. Las acciones sintéticas no acreditan integración desplegada. El servidor Next.js existente en `localhost:3000` no se detuvo ni reinició.
- Revisión independiente del diff completo: **PASS**, sin hallazgos bloqueantes. Un detalle P3 de cursor en el diálogo nuevo se corrigió y verificó; el P2 previo de resiliencia de `platform_admins` en el layout tenant permanece documentado fuera del alcance.

TASK-033 sigue ACTIVE y requiere aprobación visual antes de publicar. Se preservaron TASK-029, `.env.local`, `next-env.d.ts` y archivos ajenos; no hubo commit, push, PR, merge, despliegue ni operación Supabase.

## Quinta iteración: loaders y encabezado

### Diagnóstico

- `/platform/loading.tsx` dibujaba dos tarjetas blancas de esqueleto; por eso se veían vacías durante la navegación.
- El dashboard inicia `refreshDailyDashboardAction` en cliente. Antes de recibir respuesta, `DailyDashboardPanel` renderizaba tarjetas de actividad con contenido parcial. El `loading.tsx` del segmento cubre la página de servidor, pero no esa espera cliente.
- El layout del centro espera membership y permiso global antes de renderizar; el `loading.tsx` ubicado dentro de ese layout no cubre su propia espera. Se mantuvo la autorización en su lugar para conservar redirects y resultados HTTP; los dos enlaces muestran feedback durante la transición pendiente mediante `useLinkStatus`.
- Una prueba inicial con loader fijo dentro del dashboard reveló que `PageReveal` contenía su posicionamiento y que `space-y-10` alteraba su altura. La solución final usa el loader dentro del área principal: conserva `PageReveal` y el espaciado original, deja el encabezado disponible y evita controles de navegación invisibles durante la espera.

### Cambios

- `src/app/platform/loading.tsx` y el estado cliente del dashboard reutilizan `AppLoader`. El dashboard lo muestra dentro del contenido hasta recibir éxito o error; entonces reaparecen los módulos de navegación. La espera rápida conserva el retardo visual ya existente en CSS, sin demoras de datos.
- `NavigationLoader`, descendiente de los enlaces aprobados y portaled a `body`, usa `useLinkStatus` de Next para mostrar el mismo loader mientras la navegación espera. Durante esa transición marca el contenido anterior como `inert` y mueve el foco al loader; al terminar restaura el estado previo. Los `href`, permisos y consultas no cambian.
- El encabezado de plataforma conserva ancho completo y botones; reduce `py-6` a `py-5`, el gap de 5 a 4 y ligeramente las separaciones entre título, descripción y cuenta. No se modificó el encabezado tenant.

### Evidencia y límites

`visual-check-fifth.mjs` monta componentes reales con usuarios, centros y acciones sintéticos; sus capturas de `evidence/fifth-iteration/` muestran dashboard y plataforma en carga y listos, feedback de ambos enlaces y encabezado a 390/556/1440 px. El script simula la navegación, incluida repetición, acceso directo, recarga y error; **no representa una transición del router Next real ni una prueba de Supabase**. El fallback del layout tenant antes de completar autorización no se convirtió en streaming para no cambiar semántica de redirect/404. El servidor Next.js existente en `localhost:3000` no se detuvo ni reinició.

Verificación: Vitest completo 100/100 suites, 914/914 pruebas PASS antes del ajuste final de accesibilidad; después, Vitest focal 6/6 suites y 23/23 pruebas PASS. TypeScript PASS; ESLint completo exit 0 con una advertencia preexistente fuera de TASK-033 en `scripts/task009-gate-d/preflight-dev-readonly.mjs:238`; ESLint y Prettier focales PASS; `git diff --check` PASS. Chromium sintético a 390/556/1440 px PASS; el encabezado de plataforma mide 367/311/199 px respectivamente y no hay overflow horizontal. El script comprueba que el loader del dashboard permanezca bajo el encabezado, que no haya módulos de navegación ocultos durante esa carga y que el contenido anterior esté `inert` durante las dos transiciones.

TASK-033 permanece ACTIVE, sin commit, push, PR, merge, despliegue ni operación Supabase. TASK-029 y archivos locales ajenos siguen preservados.

## Sexta iteración: email, zonas horarias y contacto institucional

### Diagnóstico y decisión de seguridad

- El paso 1 tenía `type="email"` y `required` sin `noValidate`; Chromium podía bloquear el submit con su aviso nativo antes de que actuara el schema Zod. La acción de servidor ya usa `platformIdentityEmailSchema`.
- `TimezoneInput` mostraba y enviaba el mismo identificador. La lista de sugerencias se ubicaba respecto del borde inferior del diálogo, lo que permitía cubrir el pie en viewport bajo.
- `platform_list_centers()` devuelve email del centro y contadores agregados, no identidades. `center_memberships` une usuario y centro y conserva rol/estado; `public.users.email` proyecta Auth. RLS permite lectura propia o de ADMIN tenant, no lectura global por PLATFORM_ADMIN. Para obtener ADMIN activos de todos los centros sin N+1 haría falta una RPC `SECURITY DEFINER` de lectura por lote, comprobación `private.is_platform_admin()` y retorno mínimo de `center_id`/email. La persona usuaria eligió dejar esa columna pendiente; no se agregó SQL, migración, permiso, RPC ni un dato histórico engañoso.

### Cambios

- El primer formulario usa `noValidate` sólo allí, conserva `type="email"`, valida con el schema compartido antes de llamar a la acción y muestra «Ingresá un email válido.» bajo el campo al intentar continuar. El campo recibe borde de error, `aria-invalid`, descripción y foco. Al editar se limpia el error sin validación prematura; la validación de servidor permanece intacta.
- El selector muestra ciudad, país/territorio y offset GMT para la fecha actual. El valor IANA exacto se envía en un input oculto; admite búsqueda por ciudad, país o identificador y una zona válida fuera de sugerencias. [IANA `zone.tab`](https://github.com/eggert/tz/blob/main/zone.tab), de dominio público, aporta los códigos de país para las zonas sugeridas; `Intl.DisplayNames` localiza el nombre y `Intl.DateTimeFormat` calcula el offset, incluido DST. Alias conocidos y `Etc/GMT` se presentan sin alterar su valor. El desplegable calcula espacio hasta el encabezado y el pie, usa scroll interno y no cubre las acciones. El foco de validación vuelve al combobox visible en vez del input oculto.
- La tabla y las tarjetas nombran el contacto institucional «Email del centro»; los correos largos se ajustan. La columna «Administrador» no aparece hasta contar con una fuente actual y autorizada.

### Verificación y evidencia

Vitest focal 6/6 suites, 48/48 pruebas PASS (modal, tabla, etiquetas, schema, acciones y administración); TypeScript PASS; ESLint y Prettier focales PASS; `git diff --check` PASS. Chromium sintético 390/556/1440 px PASS, sin overflow horizontal ni errores de consola. Capturas en `evidence/sixth-iteration/`: email inválido; selector seleccionado, abierto y en viewport de 540 px; tabla y tarjetas con contacto institucional largo. Se reutilizó el harness de componentes reales con acciones/Auth/datos sintéticos; no acredita consultas reales de Supabase. El servidor Next existente no se detuvo ni reinició.

La revisión independiente terminó PASS sin bloqueantes. Detectó inicialmente el foco del input IANA oculto y una etiqueta confusa para `Etc/GMT+5`; ambos se corrigieron con pruebas. TASK-033 permanece ACTIVE para revisión visual humana, sin commit, push, PR, merge, despliegue ni operación Supabase.

## Gate técnico final

La persona usuaria aprobó formalmente la validación visual. El gate acumulado obtuvo dictamen **APPROVED**, listo para preparar commit selectivo y PR sólo tras autorización posterior. `pnpm check` pasó en su segunda corrida exacta con 929/929 Vitest y 31/31 pruebas de tooling; 107/107 focales y revisión independiente del diff completo PASS. La primera corrida intermitente, el formato global preexistente, los archivos revisados, las verificaciones omitidas y los riesgos residuales están detallados en [gate-report.md](gate-report.md). TASK-033 sigue ACTIVE y sin publicación.
